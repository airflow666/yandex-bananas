import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT, makeButton, drawBananaIcon, adBadge } from '../ui.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { t, pluralWord } from '../systems/i18n.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.score = data.score || 0;
    this.runCoins = data.coins || 0;
    this.doubled = false;
  }

  create() {
    this.sdk = this.registry.get('sdk');

    // Начисляем монеты и фиксируем рекорд сразу — x2 добавит вторую половину
    saves.addCoins(this.runCoins);
    const isRecord = saves.submitScore(this.score);
    this.sdk.setLeaderboardScore(saves.data.best);
    this.sdk.showBanner();

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x081c15).setOrigin(0);

    this.add.text(GAME_W / 2, 130, isRecord ? t('newRecord') : t('gameOver'), {
      fontFamily: FONT, fontSize: '38px', color: isRecord ? '#7CFC00' : '#ffe680',
      fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 235, String(this.score), {
      fontFamily: FONT, fontSize: '110px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    // «этаж / этажа / этажей» — число уже крупно выше
    this.add.text(GAME_W / 2, 310, pluralWord(this.score, 'floorForms'), {
      fontFamily: FONT, fontSize: '24px', color: '#95d5b2',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, 370, `${t('best')}: ${saves.data.best}`, {
      fontFamily: FONT, fontSize: '24px', color: '#d8f3dc',
    }).setOrigin(0.5);

    // Заработанные за забег бананы
    drawBananaIcon(this, GAME_W / 2 - 50, 430, 1.1);
    this.coinsText = this.add.text(GAME_W / 2 - 22, 430, `+${this.runCoins}`, {
      fontFamily: FONT, fontSize: '32px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // x2 бананов за rewarded — только если что-то заработано
    if (this.runCoins > 0) {
      this.x2Btn = makeButton(this, GAME_W / 2, 510, 300, 64, t('x2coins'), () => this._doubleCoins(), { variant: 'green' });
      adBadge(this, GAME_W / 2 - 128, 510);
    }

    makeButton(this, GAME_W / 2, 600, 300, 70, t('restart'), () => this._restart(), { variant: 'yellow', fontSize: 28 });
    makeButton(this, GAME_W / 2, 685, 300, 56, t('menu'), () => this._toMenu(), { variant: 'gray', fontSize: 22 });
  }

  async _doubleCoins() {
    if (this.doubled) return;
    audio.click();
    this.x2Btn.disableInteractive();
    const rewarded = await ads.showRewarded();
    if (rewarded) {
      this.doubled = true;
      saves.addCoins(this.runCoins);
      audio.coin();
      this.coinsText.setText(`+${this.runCoins * 2}`);
      this.x2Btn.setAlpha(0.4);
    } else {
      this.x2Btn.setInteractive({ useHandCursor: true });
    }
  }

  /** Рестарт — «естественная пауза», здесь показываем interstitial (с кулдауном). */
  async _restart() {
    audio.click();
    await ads.maybeShowInterstitial();
    this.scene.start('Game');
  }

  async _toMenu() {
    audio.click();
    await ads.maybeShowInterstitial();
    this.scene.start('Menu');
  }
}
