import Phaser from 'phaser';
import { initSDK } from '../yandex/sdk.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { setLang, t } from '../systems/i18n.js';
import { GAME_W, GAME_H, FONT } from '../ui.js';

/** Инициализация SDK и сохранений, затем переход в меню. */
export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const loadingText = this.add.text(GAME_W / 2, GAME_H / 2, '...', {
      fontFamily: FONT, fontSize: '28px', color: '#ffe680',
    }).setOrigin(0.5);

    (async () => {
      const sdk = await initSDK();
      setLang(sdk.lang);
      loadingText.setText(t('loading'));
      await saves.load(sdk);
      ads.init(sdk);
      audio.setEnabled(saves.data.soundOn);
      this.registry.set('sdk', sdk);
      this.scene.start('Menu');
    })();
  }
}
