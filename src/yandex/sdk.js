/**
 * Обёртка над Yandex Games SDK v2.
 *
 * На платформе Яндекс Игр глобальный YaGames загружается из /sdk.js —
 * подключается программно из этого файла (см. loadSdkScript ниже), а не
 * тегом в index.html, чтобы не зависеть от CSP хостинга площадки.
 * Локально (dev-сервер, тесты) его нет — тогда работает mock-режим:
 * реклама «показывается» мгновенно с записью в лог, данные хранятся
 * в localStorage, лидерборд отдаёт фейковый топ.
 */

import { t } from '../systems/i18n.js';

const LS_DATA_KEY = 'bananaTower.save';
const LS_LB_KEY = 'bananaTower.mockLeaderboard';

export const LEADERBOARD_NAME = 'towerScore';

class MockPlayer {
  getData() {
    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(LS_DATA_KEY)) || {});
    } catch {
      return Promise.resolve({});
    }
  }
  setData(data) {
    localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
    return Promise.resolve();
  }
  getName() { return t('player'); }
  getPhoto() { return null; }
  getMode() { return 'lite'; }
}

function mockLog(...args) {
  console.log('[YSDK-mock]', ...args);
  window.__ysdkMockLog = window.__ysdkMockLog || [];
  window.__ysdkMockLog.push(args.join(' '));
}

class SDKWrapper {
  constructor(ysdk) {
    this.ysdk = ysdk;           // null в mock-режиме
    this.isMock = !ysdk;
    this.player = null;
    this.lang = 'ru';
    this._gameplayRunning = false;
    this._loadingReadySent = false;
  }

  async init() {
    if (this.isMock) {
      this.player = new MockPlayer();
      // сырой код языка ('ru', 'be', 'en'...) — маппинг делает i18n.setLang
      this.lang = (navigator.language || 'ru').toLowerCase().split('-')[0];
      mockLog('init (mock mode)');
      return;
    }
    this.lang = this.ysdk.environment?.i18n?.lang || 'en';
    try {
      this.player = await this.ysdk.getPlayer({ scopes: false });
    } catch (e) {
      console.warn('getPlayer failed, using localStorage fallback', e);
      this.player = new MockPlayer();
    }
  }

  /** Сообщить платформе, что игра загрузилась (обязательно для модерации; ровно один раз). */
  loadingReady() {
    if (this._loadingReadySent) return;
    this._loadingReadySent = true;
    if (this.isMock) { mockLog('LoadingAPI.ready'); return; }
    this.ysdk.features?.LoadingAPI?.ready?.();
  }

  /** Геймплей начался/возобновился (обязательно для модерации). */
  gameplayStart() {
    if (this._gameplayRunning) return;
    this._gameplayRunning = true;
    if (this.isMock) { mockLog('GameplayAPI.start'); return; }
    this.ysdk.features?.GameplayAPI?.start?.();
  }

  /** Геймплей остановился (пауза, реклама, меню, game over). */
  gameplayStop() {
    if (!this._gameplayRunning) return;
    this._gameplayRunning = false;
    if (this.isMock) { mockLog('GameplayAPI.stop'); return; }
    this.ysdk.features?.GameplayAPI?.stop?.();
  }

  /**
   * Полноэкранная (interstitial) реклама.
   * Колбэки строго по документации: onOpen/onClose/onError — onOffline
   * в текущем SDK v2 не существует и никогда не вызывался бы.
   * resolve после закрытия рекламы (или сразу при ошибке).
   */
  showInterstitial() {
    if (this.isMock) {
      mockLog('showFullscreenAdv');
      return Promise.resolve({ wasShown: true });
    }
    return new Promise((resolve) => {
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: (wasShown) => resolve({ wasShown }),
          onError: () => resolve({ wasShown: false }),
        },
      });
    });
  }

  /**
   * Реклама с вознаграждением.
   * resolve({ rewarded: true }) только если пользователь досмотрел ролик.
   */
  showRewarded() {
    if (this.isMock) {
      mockLog('showRewardedVideo');
      return Promise.resolve({ rewarded: true });
    }
    return new Promise((resolve) => {
      let rewarded = false;
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve({ rewarded }),
          onError: () => resolve({ rewarded: false }),
        },
      });
    });
  }

  /** Sticky-баннер (меню и game over; в геймплее скрываем). */
  async showBanner() {
    if (this.isMock) { mockLog('showBannerAdv'); return; }
    try {
      const { stickyAdvIsShowing, reason } = await this.ysdk.adv.getBannerAdvStatus();
      if (!stickyAdvIsShowing && !reason) await this.ysdk.adv.showBannerAdv();
    } catch (e) { console.warn('banner error', e); }
  }

  async hideBanner() {
    if (this.isMock) { mockLog('hideBannerAdv'); return; }
    try { await this.ysdk.adv.hideBannerAdv(); } catch (e) { console.warn('banner error', e); }
  }

  async getData() {
    if (!this.player) return {};
    try {
      return (await this.player.getData()) || {};
    } catch {
      return {};
    }
  }

  /** flush=true — немедленная запись на сервер (game over, покупки). */
  async setData(data, flush = false) {
    if (!this.player) return;
    try {
      await this.player.setData(data, flush);
    } catch (e) {
      console.warn('setData failed', e);
    }
  }

  /** Актуальный API — ysdk.leaderboards; старый getLeaderboards() оставлен как fallback. */
  async _getLeaderboardsAPI() {
    if (this.ysdk.leaderboards) {
      return {
        setScore: (name, score) => this.ysdk.leaderboards.setScore(name, score),
        getEntries: (name, opts) => this.ysdk.leaderboards.getEntries(name, opts),
      };
    }
    const lb = await this.ysdk.getLeaderboards();
    return {
      setScore: (name, score) => lb.setLeaderboardScore(name, score),
      getEntries: (name, opts) => lb.getLeaderboardEntries(name, opts),
    };
  }

  async setLeaderboardScore(score) {
    if (this.isMock) {
      mockLog('setLeaderboardScore', score);
      const prev = Number(localStorage.getItem(LS_LB_KEY)) || 0;
      if (score > prev) localStorage.setItem(LS_LB_KEY, String(score));
      return;
    }
    // Запись очков доступна только авторизованным и лимитирована 1 запросом/сек —
    // проверяем isAvailableMethod, как рекомендует документация, до вызова.
    // Если метод проверки недоступен в конкретной версии SDK — пробуем как раньше.
    try {
      const available = await this.ysdk.isAvailableMethod?.('leaderboards.setScore');
      if (available === false) return;
      const lb = await this._getLeaderboardsAPI();
      await lb.setScore(LEADERBOARD_NAME, score);
    } catch (e) {
      console.warn('setLeaderboardScore failed', e);
    }
  }

  /**
   * Топ игроков + позиция игрока.
   * Возвращает { entries: [{rank, name, score, isPlayer}] } или null при ошибке.
   */
  async getLeaderboardEntries() {
    if (this.isMock) {
      mockLog('getLeaderboardEntries');
      const myScore = Number(localStorage.getItem(LS_LB_KEY)) || 0;
      const fake = [
        { name: 'BananaKing', score: 184 }, { name: 'Обезьянка99', score: 121 },
        { name: 'StackMaster', score: 96 }, { name: 'Кожура', score: 71 },
        { name: 'MinionFan', score: 44 }, { name: 'Джунгли', score: 23 },
      ];
      fake.push({ name: t('player'), score: myScore, isPlayer: true });
      fake.sort((a, b) => b.score - a.score);
      return { entries: fake.map((e, i) => ({ rank: i + 1, ...e })) };
    }
    try {
      const lb = await this._getLeaderboardsAPI();
      let res;
      try {
        res = await lb.getEntries(LEADERBOARD_NAME, {
          quantityTop: 10,
          includeUser: true,
          quantityAround: 2,
        });
      } catch {
        // includeUser падает для неавторизованных — показываем хотя бы топ
        res = await lb.getEntries(LEADERBOARD_NAME, { quantityTop: 10 });
      }
      const entries = (res.entries || []).map((e) => ({
        rank: e.rank,
        name: e.player?.publicName || t('player'),
        score: e.score,
        isPlayer: e.player?.uniqueID && res.userRank && e.rank === res.userRank,
      }));
      return { entries };
    } catch (e) {
      console.warn('getLeaderboardEntries failed', e);
      return null;
    }
  }
}

/** Инициализация: пробуем настоящий SDK, при неудаче — mock. */
const INIT_TIMEOUT_MS = 10000;

/** Промис, который резолвится через ms — используется, чтобы не ждать SDK вечно. */
function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Программно создаёт и подключает <script src="/sdk.js">. Обработчики
 * назначены через JS-свойства (.onload/.onerror), а не HTML-атрибуты —
 * в отличие от инлайновых onload="..." в разметке, это не подпадает под
 * ограничения CSP хостинга на инлайн-скрипты, и не имеет гонки состояний
 * (элемент создаётся и слушатели вешаются синхронно, до начала загрузки).
 */
function loadSdkScript() {
  return new Promise((resolve) => {
    // Площадка может подключить SDK сама (или мы уже вызывались) — второй
    // тег не нужен.
    if (typeof window.YaGames !== 'undefined') { resolve(true); return; }
    const script = document.createElement('script');
    script.async = true;
    script.src = '/sdk.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function initSDK() {
  let ysdk = null;
  await Promise.race([loadSdkScript(), timeout(INIT_TIMEOUT_MS)]);
  // Решаем по наличию самого глобального YaGames, а не по результату
  // loadSdkScript(): документация требует только того, чтобы /sdk.js был
  // подключён до YaGames.init(). Если onload до нас почему-то не долетел
  // (сработал таймаут гонки, SDK подключила сама площадка), объект всё
  // равно есть — и init() надо звать, иначе платформа навсегда останется
  // в состоянии «W» (SDK is not initialized. Wait for "init" call).
  if (typeof window.YaGames !== 'undefined') {
    try {
      // На некоторых площадках/встраиваниях init() может зависнуть без reject —
      // ограничиваем ожидание, чтобы игра не застряла на загрузке навсегда.
      ysdk = (await Promise.race([window.YaGames.init(), timeout(INIT_TIMEOUT_MS)])) || null;
    } catch (e) {
      console.warn('YaGames.init failed, falling back to mock', e);
    }
  }
  const wrapper = new SDKWrapper(ysdk);
  try {
    await Promise.race([wrapper.init(), timeout(INIT_TIMEOUT_MS)]);
  } catch (e) {
    console.warn('SDK wrapper init failed', e);
  }
  window.__sdk = wrapper; // для отладки и автотестов
  return wrapper;
}
