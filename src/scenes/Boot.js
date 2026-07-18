import Phaser from 'phaser';
import { initSDK } from '../yandex/sdk.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { setLang, t } from '../systems/i18n.js';
import { GAME_W, GAME_H, FONT } from '../ui.js';

/** Заглушка SDK на случай полного отказа инициализации — не даёт остальному
 *  коду (Menu, Game, Shop...) падать на вызовах несуществующих методов. */
function noopSdk() {
  return {
    lang: 'en',
    isMock: true,
    hideBanner() {},
    async showBanner() {},
    gameplayStart() {},
    gameplayStop() {},
    loadingReady() {},
    async getData() { return {}; },
    async setData() {},
    async showRewarded() { return { rewarded: false }; },
    async showInterstitial() { return { wasShown: false }; },
    async setLeaderboardScore() {},
    async getLeaderboardEntries() { return null; },
  };
}

/**
 * Инициализация SDK и сохранений, затем переход в меню.
 * Обёрнуто в try/catch/finally: даже если SDK или сохранения дадут сбой на
 * конкретной площадке (никогда не тестировалось против настоящего SDK,
 * только против мока), игра всё равно должна открыть меню, а не зависнуть
 * молча на экране загрузки.
 */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const loadingText = this.add.text(GAME_W / 2, GAME_H / 2, '...', {
      fontFamily: FONT, fontSize: '56px', color: '#ffe680',
    }).setOrigin(0.5);

    this._boot(loadingText);
  }

  async _boot(loadingText) {
    let sdk = null;
    try {
      sdk = await initSDK();
      setLang(sdk.lang);
      loadingText.setText(t('loading'));
      await saves.load(sdk);
      ads.init(sdk);
      audio.setEnabled(saves.data.soundOn);
    } catch (e) {
      console.error('Boot init failed, starting with safe defaults', e);
      if (!sdk) sdk = noopSdk();
    } finally {
      this.registry.set('sdk', sdk);
      this.scene.start('Menu');
    }
  }
}
