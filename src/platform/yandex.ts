/**
 * Единый фасад платформы. Один и тот же интерфейс и на Яндекс Играх, и в
 * локальной заглушке — вызывающему коду не нужно знать, где он работает.
 *
 * Здесь же лежит лечение п. 1.14 («зависания… при определённых действиях
 * пользователя», конкретизировано модератором как зависание после обновления
 * страницы). Прежняя схема давала три независимых пути зависнуть, и все три
 * закрыты именно тут:
 *
 * 1. Три последовательных таймаута по 10 с (загрузка скрипта → init →
 *    getPlayer) складывались в 30 с чёрного экрана. Теперь бюджет ожидания
 *    один на всю инициализацию, и игра стартует по его истечении.
 * 2. Если init() не успевал в таймаут, результат выбрасывался и обёртка
 *    навсегда уходила в mock. В mock-режиме LoadingAPI.ready() никуда не
 *    отправляется — собственный лоадер Яндекса висел поверх игры вечно, что
 *    внешне неотличимо от «игра зависла». Теперь опоздавший init
 *    ПОДХВАТЫВАЕТСЯ (adopt), а запрос ready() буферизуется и уходит в момент
 *    появления SDK — потерять его нельзя в принципе.
 * 3. Рекламные промисы могли не зарезолвиться. Теперь у каждого страховочный
 *    таймаут, резолв гарантирован, снятие паузы — в finally у вызывающего.
 *
 * Лимиты и формулировки — docs/yandex-notes.md.
 */

import { loadSdkScript } from './sdkLoader';
import type {
  YaSdk, YaPlayer, YaLifecycleEvent, YaLeaderboardEntry, YaGetEntriesOptions,
} from './types';

/** Сколько игра готова ждать платформу, прежде чем показать меню. */
export const INIT_BUDGET_MS = 8000;
/** Страховка на рекламный промис: onClose может не прийти, если завис сам SDK. */
export const ADV_TIMEOUT_MS = 30_000;

export const LEADERBOARD_NAME = 'towerScore';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/** Промис с гарантированным резолвом: значение либо fallback по таймауту. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, delay(ms).then(() => fallback)]);
}

export interface AdvResult { wasShown: boolean }
export interface RewardResult { rewarded: boolean }

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  isPlayer: boolean;
}

export class Platform {
  private ysdk: YaSdk | null = null;
  private player: YaPlayer | null = null;

  /** Игра сообщила о готовности — но SDK мог ещё не приехать. */
  private readyRequested = false;
  private readySent = false;

  private gameplayRunning = false;
  private lifecycleBound = false;

  private pauseHandlers = new Set<() => void>();
  private resumeHandlers = new Set<() => void>();

  /** Язык интерфейса площадки; до init считаем по браузеру. */
  lang = 'ru';

  /** true, пока настоящего SDK нет: локальная разработка или отказ платформы. */
  get isMock(): boolean { return this.ysdk === null; }

  /**
   * Запускает подключение и НЕ блокирует вызывающего: возвращает промис,
   * который резолвится либо по завершении инициализации, либо по истечении
   * общего бюджета — что раньше. Инициализация при этом продолжается в фоне.
   */
  boot(budgetMs = INIT_BUDGET_MS): Promise<void> {
    this.lang = (navigator.language || 'ru').toLowerCase().split('-')[0] ?? 'ru';
    const done = this.initInBackground();
    return Promise.race([done, delay(budgetMs)]);
  }

  private async initInBackground(): Promise<void> {
    const loaded = await loadSdkScript();
    // Решаем по наличию глобального объекта, а не по результату загрузки:
    // SDK могла подключить сама площадка, и тогда init() всё равно нужен —
    // иначе платформа навсегда останется в состоянии «W».
    if (!loaded && typeof window.YaGames === 'undefined') return;
    try {
      const ysdk = await window.YaGames!.init();
      if (ysdk) this.adopt(ysdk);
    } catch (e) {
      console.warn('[platform] YaGames.init failed', e);
    }
  }

  /**
   * Подхват SDK — в том числе опоздавшего, уже после старта игры.
   * Немедленно отдаёт накопленные вызовы, которые иначе были бы потеряны.
   */
  private adopt(ysdk: YaSdk): void {
    if (this.ysdk) return;
    this.ysdk = ysdk;
    this.lang = ysdk.environment?.i18n?.lang ?? this.lang;
    this.flushReady();
    this.bindLifecycle();
    void this.fetchPlayer();
  }

  /**
   * Игрок запрашивается ровно один раз за загрузку страницы и кэшируется:
   * getPlayer лимитирован 20 запросами за 5 минут, а сценарий проверки
   * модератора — многократное обновление страницы подряд.
   */
  private async fetchPlayer(): Promise<void> {
    if (!this.ysdk || this.player) return;
    try {
      this.player = await this.ysdk.getPlayer({ scopes: false });
    } catch (e) {
      console.warn('[platform] getPlayer failed, staying on local storage', e);
    }
  }

  // ---------------------------------------------------------------- loading

  /**
   * Сообщить платформе, что игра готова. Вызывать РАНО и безусловно: если SDK
   * ещё не приехал, запрос запоминается и уходит сразу при его появлении.
   * Именно отсюда бралось «вечный лоадер Яндекса поверх игры».
   */
  markLoaded(): void {
    if (this.readyRequested) return;
    this.readyRequested = true;
    this.flushReady();
  }

  private flushReady(): void {
    if (this.readySent || !this.readyRequested || !this.ysdk) return;
    this.readySent = true;
    try {
      this.ysdk.features?.LoadingAPI?.ready?.();
    } catch (e) {
      console.warn('[platform] LoadingAPI.ready failed', e);
    }
  }

  gameplayStart(): void {
    if (this.gameplayRunning) return;
    this.gameplayRunning = true;
    try { this.ysdk?.features?.GameplayAPI?.start?.(); } catch { /* не критично */ }
  }

  gameplayStop(): void {
    if (!this.gameplayRunning) return;
    this.gameplayRunning = false;
    try { this.ysdk?.features?.GameplayAPI?.stop?.(); } catch { /* не критично */ }
  }

  // -------------------------------------------------------------- lifecycle

  onPause(fn: () => void): void { this.pauseHandlers.add(fn); }
  onResume(fn: () => void): void { this.resumeHandlers.add(fn); }

  private emitPause = (): void => { this.pauseHandlers.forEach((fn) => fn()); };
  private emitResume = (): void => { this.resumeHandlers.forEach((fn) => fn()); };

  /**
   * game_api_pause / game_api_resume — единственный способ узнать про показ
   * рекламы и окна покупки; браузерные blur/visibilitychange их не покрывают.
   * Подписываемся на оба источника, обработчики идемпотентны.
   */
  private bindLifecycle(): void {
    if (this.lifecycleBound || !this.ysdk) return;
    this.lifecycleBound = true;
    const events: [YaLifecycleEvent, () => void][] = [
      ['game_api_pause', this.emitPause],
      ['game_api_resume', this.emitResume],
    ];
    for (const [name, handler] of events) {
      try { this.ysdk.on(name, handler); } catch { /* событие может отсутствовать */ }
    }
  }

  // ------------------------------------------------------------------- ads

  /**
   * Полноэкранная реклама. onClose по документации приходит и после ошибки,
   * и при отказе из-за слишком частого вызова — но если завис сам SDK, не
   * придёт ничего, поэтому поверх стоит страховочный таймаут. Промис
   * резолвится всегда.
   */
  showInterstitial(): Promise<AdvResult> {
    const sdk = this.ysdk;
    if (!sdk) return Promise.resolve({ wasShown: false });
    const shown = new Promise<AdvResult>((resolve) => {
      let settled = false;
      const finish = (wasShown: boolean) => {
        if (settled) return;
        settled = true;
        resolve({ wasShown });
      };
      try {
        sdk.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown) => finish(Boolean(wasShown)),
            onError: () => finish(false),
          },
        });
      } catch (e) {
        console.warn('[platform] showFullscreenAdv threw', e);
        finish(false);
      }
    });
    return withTimeout(shown, ADV_TIMEOUT_MS, { wasShown: false });
  }

  /** Награда засчитывается только по onRewarded — закрытие ролика раньше не считается. */
  showRewarded(): Promise<RewardResult> {
    const sdk = this.ysdk;
    if (!sdk) return Promise.resolve({ rewarded: false });
    const watched = new Promise<RewardResult>((resolve) => {
      let rewarded = false;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({ rewarded });
      };
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => { rewarded = true; },
            onClose: finish,
            onError: finish,
          },
        });
      } catch (e) {
        console.warn('[platform] showRewardedVideo threw', e);
        finish();
      }
    });
    return withTimeout(watched, ADV_TIMEOUT_MS, { rewarded: false });
  }

  async showBanner(): Promise<void> {
    if (!this.ysdk) return;
    try {
      const status = await this.ysdk.adv.getBannerAdvStatus();
      if (!status.stickyAdvIsShowing && !status.reason) await this.ysdk.adv.showBannerAdv();
    } catch (e) {
      console.warn('[platform] banner error', e);
    }
  }

  async hideBanner(): Promise<void> {
    if (!this.ysdk) return;
    try { await this.ysdk.adv.hideBannerAdv(); } catch { /* не критично */ }
  }

  // --------------------------------------------------------------- storage

  /** null означает «облака нет» — вызывающий уходит на localStorage. */
  getCloudPlayer(): YaPlayer | null { return this.player; }

  // ----------------------------------------------------------- leaderboard

  async setLeaderboardScore(score: number): Promise<void> {
    if (!this.ysdk?.leaderboards) return;
    try {
      const available = await this.ysdk.isAvailableMethod?.('leaderboards.setScore');
      if (available === false) return;
      await this.ysdk.leaderboards.setScore(LEADERBOARD_NAME, score);
    } catch (e) {
      console.warn('[platform] setLeaderboardScore failed', e);
    }
  }

  async getLeaderboardEntries(fallbackName: string): Promise<LeaderboardRow[] | null> {
    const lb = this.ysdk?.leaderboards;
    if (!lb) return null;
    try {
      let res;
      try {
        const opts: YaGetEntriesOptions = {
          quantityTop: 10, includeUser: true, quantityAround: 2,
        };
        res = await lb.getEntries(LEADERBOARD_NAME, opts);
      } catch {
        // includeUser падает для неавторизованных — показываем хотя бы топ
        res = await lb.getEntries(LEADERBOARD_NAME, { quantityTop: 10 });
      }
      const userRank = res.userRank;
      return (res.entries ?? []).map((e: YaLeaderboardEntry) => ({
        rank: e.rank,
        name: e.player?.publicName || fallbackName,
        score: e.score,
        isPlayer: Boolean(e.player?.uniqueID && userRank && e.rank === userRank),
      }));
    } catch (e) {
      console.warn('[platform] getLeaderboardEntries failed', e);
      return null;
    }
  }

  /** Предложить вход — только по явному действию игрока, игра его не требует. */
  async openAuthDialog(): Promise<boolean> {
    if (!this.ysdk?.auth) return false;
    try {
      await this.ysdk.auth.openAuthDialog();
      this.player = null;
      await this.fetchPlayer();
      return true;
    } catch {
      return false;
    }
  }
}

export const platform = new Platform();
