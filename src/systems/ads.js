/**
 * Логика показа рекламы поверх платформенного фасада.
 *
 * Два изменения против прежней версии:
 *  - снятие звука и возобновление геймплея вынесены в `finally`. Раньше при
 *    зависшем или упавшем рекламном промисе игра оставалась беззвучной и на
 *    паузе — один из путей к «зависанию» из п. 1.14;
 *  - первый interstitial не раньше 90 с от старта сессии. Площадка уже
 *    показала свою рекламу перед запуском игры, а `lastInterstitialAt = 0`
 *    разрешал нашу через 20–30 с после неё.
 *
 * Частоту полноэкранной рекламы платформа регулирует и сама, а документация
 * предостерегает от показа по расписанию и во время активного взаимодействия
 * с игрой — поэтому вызывать только в естественных паузах между забегами.
 */

import { audio } from './audio.js';

const INTERSTITIAL_COOLDOWN_MS = 62_000;
const FIRST_INTERSTITIAL_DELAY_MS = 90_000;

class Ads {
  constructor() {
    this.sdk = null;
    this.sessionStartedAt = Date.now();
    this.lastInterstitialAt = 0;
  }

  init(sdk) {
    this.sdk = sdk;
    this.sessionStartedAt = Date.now();
  }

  /**
   * Показать interstitial, если кулдаун прошёл. Возвращает Promise<boolean> —
   * был ли показ. Вызывать в «естественных паузах»: рестарт после game over,
   * выход в меню.
   */
  async maybeShowInterstitial() {
    if (!this.sdk) return false;
    const now = Date.now();
    if (now - this.sessionStartedAt < FIRST_INTERSTITIAL_DELAY_MS) return false;
    if (now - this.lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return false;
    this.lastInterstitialAt = now;
    this.sdk.gameplayStop();
    audio.muteForAd();
    try {
      const { wasShown } = await this.sdk.showInterstitial();
      return wasShown;
    } catch (e) {
      console.warn('[ads] interstitial failed', e);
      return false;
    } finally {
      audio.unmuteAfterAd();
    }
  }

  /** Показать rewarded. Возвращает Promise<boolean> — досмотрел ли пользователь ролик. */
  async showRewarded() {
    if (!this.sdk) return false;
    this.sdk.gameplayStop();
    audio.muteForAd();
    try {
      const { rewarded } = await this.sdk.showRewarded();
      return rewarded;
    } catch (e) {
      console.warn('[ads] rewarded failed', e);
      return false;
    } finally {
      audio.unmuteAfterAd();
    }
  }
}

export const ads = new Ads();
