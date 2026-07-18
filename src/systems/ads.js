/**
 * Логика показа рекламы поверх SDK-обёртки:
 *  - interstitial с кулдауном (Яндекс требует не чаще ~1 раза в 60 сек);
 *  - rewarded с гарантией начисления награды только после onRewarded;
 *  - глушение звука и остановка GameplayAPI на время ролика.
 */

import { audio } from './audio.js';

const INTERSTITIAL_COOLDOWN_MS = 62_000;

class Ads {
  constructor() {
    this.sdk = null;
    this.lastInterstitialAt = 0;
  }

  init(sdk) {
    this.sdk = sdk;
  }

  /**
   * Показать interstitial, если кулдаун прошёл. Возвращает Promise<boolean> — был ли показ.
   * Вызывать в «естественных паузах»: рестарт после game over, выход в меню.
   */
  async maybeShowInterstitial() {
    if (!this.sdk) return false;
    const now = Date.now();
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return false;
    this.lastInterstitialAt = now;
    this.sdk.gameplayStop();
    audio.muteForAd();
    const { wasShown } = await this.sdk.showInterstitial();
    audio.unmuteAfterAd();
    return wasShown;
  }

  /** Показать rewarded. Возвращает Promise<boolean> — досмотрел ли пользователь ролик. */
  async showRewarded() {
    if (!this.sdk) return false;
    this.sdk.gameplayStop();
    audio.muteForAd();
    const { rewarded } = await this.sdk.showRewarded();
    audio.unmuteAfterAd();
    return rewarded;
  }
}

export const ads = new Ads();
