/**
 * Сохранения: память → localStorage → облако.
 *
 * Прежняя схема писала в облако немедленно на каждое событие (три
 * `setData(flush)` в одном тике при завершении забега), из-за чего запись
 * могла молча потеряться, а лимиты — упереться в потолок. Здесь изменения
 * сначала попадают в память и синхронно в localStorage (мгновенно, без
 * лимитов), а облачная запись объединяется и дебаунсится.
 *
 * Лимиты из документации (docs/yandex-notes.md): setData/getData — 100 раз
 * за 5 минут, 200 КБ на игрока. Мы держим вдвое меньший потолок: спокойнее
 * при сценарии «обновить страницу 5+ раз подряд», которым проверяют п. 1.14.
 */

import { platform } from '../platform/yandex';
import { onTeardown } from '../platform/lifecycle';

const LS_KEY = 'bananaTower.save';

/** Собственный потолок — вдвое ниже документированных 100 за 5 минут. */
const MAX_CLOUD_WRITES = 50;
const RATE_WINDOW_MS = 5 * 60_000;
/** Слитком частые записи объединяются в одну. */
const DEBOUNCE_MS = 900;
/** Нижняя граница между двумя облачными записями. */
const MIN_GAP_MS = 3000;
/** Сколько ждём облако при загрузке, прежде чем взять локальную копию. */
const CLOUD_READ_TIMEOUT_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export class SaveStore<T extends Record<string, unknown>> {
  data: T;

  private readonly defaults: T;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastWriteAt = 0;
  private writeTimes: number[] = [];
  private syncing = false;

  constructor(defaults: T) {
    this.defaults = defaults;
    this.data = { ...defaults };
  }

  /**
   * Читает облако, при отказе — localStorage. Локальная копия используется
   * и как источник, если облачные данные пустые (первый вход на площадке).
   */
  async load(): Promise<void> {
    const local = this.readLocal();
    let cloud: Record<string, unknown> | null = null;
    const player = platform.getCloudPlayer();
    if (player) {
      try {
        // Дедлайн обязателен: try/catch ловит только отклонённый промис, а
        // getData может не ответить вовсе — например когда исчерпан лимит
        // (100 запросов за 5 минут) при частых перезагрузках страницы.
        // Без гонки здесь загрузка не возвращается никогда, Boot не доходит
        // до старта Menu, и игрок видит пустой фон — это и есть п. 1.14.
        cloud = await Promise.race([
          player.getData(),
          delay(CLOUD_READ_TIMEOUT_MS).then(() => null),
        ]);
        if (cloud === null) console.warn('[storage] getData timed out, using local copy');
      } catch (e) {
        console.warn('[storage] getData failed, using local copy', e);
      }
    }
    const source = cloud && Object.keys(cloud).length > 0 ? cloud : local;
    this.data = this.merge(source ?? {});
    onTeardown(() => this.flush());
  }

  /** Поверх дефолтов — иначе новое поле в схеме приезжает как undefined. */
  private merge(source: Record<string, unknown>): T {
    return { ...this.defaults, ...source } as T;
  }

  private readLocal(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  private writeLocal(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[storage] localStorage write failed', e);
    }
  }

  /**
   * Единственный способ менять прогресс. Локально фиксируется сразу, поэтому
   * обновление страницы сразу после изменения ничего не теряет даже если
   * облачная запись ещё не ушла.
   */
  update(mutate: (data: T) => void): void {
    mutate(this.data);
    this.writeLocal();
    this.dirty = true;
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    const sinceLast = Date.now() - this.lastWriteAt;
    const wait = Math.max(DEBOUNCE_MS, MIN_GAP_MS - sinceLast);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.push(false);
    }, wait);
  }

  /** Немедленная отправка — уход со страницы, критичные моменты. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.push(true);
  }

  private allowWrite(now: number): boolean {
    this.writeTimes = this.writeTimes.filter((t) => now - t < RATE_WINDOW_MS);
    return this.writeTimes.length < MAX_CLOUD_WRITES;
  }

  private async push(immediate: boolean): Promise<void> {
    if (!this.dirty || this.syncing) return;
    const player = platform.getCloudPlayer();
    // Облака нет — localStorage уже содержит актуальные данные, это не потеря.
    if (!player) { this.dirty = false; return; }

    const now = Date.now();
    if (!this.allowWrite(now)) {
      console.warn('[storage] cloud write rate limit reached, keeping local copy only');
      return;
    }

    this.syncing = true;
    this.dirty = false;
    this.writeTimes.push(now);
    this.lastWriteAt = now;
    try {
      await player.setData({ ...this.data }, immediate);
    } catch (e) {
      console.warn('[storage] setData failed, will retry on next change', e);
      this.dirty = true;
    } finally {
      this.syncing = false;
    }
  }
}
