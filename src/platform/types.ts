/**
 * Минимальные типы Yandex Games SDK v2 — только то, что игра реально вызывает.
 * Официальных типов Яндекс не публикует, поэтому описываем сами и держим
 * необязательным всё, чего может не оказаться в конкретной версии SDK.
 * Сверено с документацией 29.07.2026, см. docs/yandex-notes.md.
 */

export interface YaPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getStats?(keys?: string[]): Promise<Record<string, number>>;
  setStats?(stats: Record<string, number>): Promise<void>;
  incrementStats?(stats: Record<string, number>): Promise<Record<string, number>>;
  getName?(): string;
  getPhoto?(size: 'small' | 'medium' | 'large'): string;
  getMode?(): string;
  getUniqueID?(): string;
}

/** Колбэки строго по документации: onOffline в SDK v2 не существует. */
export interface FullscreenAdvCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (error: unknown) => void;
}

export interface RewardedVideoCallbacks extends FullscreenAdvCallbacks {
  onRewarded?: () => void;
}

export interface YaLeaderboardEntry {
  rank: number;
  score: number;
  player?: { publicName?: string; uniqueID?: string };
}

export interface YaLeaderboardResult {
  userRank?: number;
  entries?: YaLeaderboardEntry[];
}

export interface YaGetEntriesOptions {
  quantityTop?: number;
  includeUser?: boolean;
  quantityAround?: number;
}

export type YaLifecycleEvent = 'game_api_pause' | 'game_api_resume';

export interface YaSdk {
  environment?: { i18n?: { lang?: string } };
  features?: {
    LoadingAPI?: { ready?: () => void };
    GameplayAPI?: { start?: () => void; stop?: () => void };
  };
  adv: {
    showFullscreenAdv(opts: { callbacks?: FullscreenAdvCallbacks }): void;
    showRewardedVideo(opts: { callbacks?: RewardedVideoCallbacks }): void;
    showBannerAdv(): Promise<unknown>;
    hideBannerAdv(): Promise<unknown>;
    getBannerAdvStatus(): Promise<{ stickyAdvIsShowing?: boolean; reason?: string }>;
  };
  leaderboards?: {
    setScore(name: string, score: number): Promise<void>;
    getEntries(name: string, opts?: YaGetEntriesOptions): Promise<YaLeaderboardResult>;
  };
  getPlayer(opts?: { scopes?: boolean; signed?: boolean }): Promise<YaPlayer>;
  getLeaderboards?(): Promise<unknown>;
  isAvailableMethod?(name: string): Promise<boolean>;
  auth?: { openAuthDialog(): Promise<void> };
  on(event: YaLifecycleEvent, cb: () => void): void;
  off(event: YaLifecycleEvent, cb: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(opts?: { signed?: boolean }): Promise<YaSdk> };
  }
}
