import Phaser from 'phaser';
import { initSDK } from '../yandex/sdk.js';
import { platform } from '../platform/yandex';
import { markStep } from '../bootStatus.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { setLang, t } from '../systems/i18n.js';
import { GAME_W, GAME_H, FONT } from '../ui.js';

/** Крайний срок, после которого готовность объявляется без участия Menu. */
const READY_GUARD_MS = 12_000;

/** Крайний срок всей загрузки: меню открывается даже если платформа молчит. */
const BOOT_DEADLINE_MS = 14_000;

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
    markStep('boot-create');
    const loadingText = this.add.text(GAME_W / 2, GAME_H / 2, '...', {
      fontFamily: FONT, fontSize: '56px', color: '#ffe680',
    }).setOrigin(0.5);

    this._boot(loadingText);
  }

  async _boot(loadingText) {
    let sdk = null;
    // Страховка: LoadingAPI.ready() штатно вызывается в Menu, но если сцена
    // не доедет, лоадер Яндекса останется поверх игры навсегда. Запрос
    // идемпотентен и буферизуется, так что лишним этот вызов не будет.
    const readyGuard = setTimeout(() => platform.markLoaded(), READY_GUARD_MS);
    try {
      // Общий дедлайн на всю загрузку. Каждый await внутри имеет собственный
      // таймаут, но полагаться только на них нельзя: достаточно одного
      // незарезолвленного промиса, чтобы finally не выполнился и игрок
      // остался на пустом фоне навсегда. Меню должно открыться при любом
      // исходе — пусть и с дефолтными данными.
      await Promise.race([
        (async () => {
          sdk = await initSDK();
          markStep('sdk-init');
          setLang(sdk.lang);
          loadingText.setText(t('loading'));
          await saves.load(sdk);
          markStep('saves-loaded');
          ads.init(sdk);
          audio.setEnabled(saves.data.soundOn);
        })(),
        new Promise((resolve) => setTimeout(resolve, BOOT_DEADLINE_MS)),
      ]);
    } catch (e) {
      console.error('Boot init failed, starting with safe defaults', e);
    } finally {
      clearTimeout(readyGuard);
      // Дедлайн выше срабатывает без исключения, поэтому заглушку ставим
      // здесь: к этому моменту sdk может быть не присвоен ни при ошибке,
      // ни при таймауте, а Menu вызывает его методы сразу в create().
      if (!sdk) sdk = noopSdk();
      this.registry.set('sdk', sdk);
      this.scene.start('Menu');
    }
  }
}
