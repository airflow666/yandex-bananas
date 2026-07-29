import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT, makeButton, makeCoinCounter, drawBananaIcon, adBadge } from '../ui.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { t } from '../systems/i18n.js';
import { markStep } from '../bootStatus.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    markStep('menu');
    this.sdk = this.registry.get('sdk');
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b4332).setOrigin(0);

    // декоративные бананы на фоне
    const rng = new Phaser.Math.RandomDataGenerator(['menu']);
    for (let i = 0; i < 12; i++) {
      drawBananaIcon(this, rng.between(40, GAME_W - 40), rng.between(40, GAME_H - 40), rng.realInRange(0.7, 1.6))
        .setAlpha(0.12).setAngle(rng.between(0, 360));
    }

    this.add.text(GAME_W / 2, 340, t('title'), {
      fontFamily: FONT, fontSize: '116px', color: '#ffe680', fontStyle: 'bold',
      align: 'center', stroke: '#7a5c00', strokeThickness: 16,
    }).setOrigin(0.5);
    drawBananaIcon(this, GAME_W / 2, 570, 2.2);

    this.coinCounter = makeCoinCounter(this, 32, 72, saves.data.coins);

    this.add.text(GAME_W - 32, 72, `${t('best')}: ${saves.data.best}`, {
      fontFamily: FONT, fontSize: '40px', color: '#d8f3dc', fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    makeButton(this, GAME_W / 2, 860, 600, 168, t('play'), () => {
      audio.click();
      this.scene.start('Game');
    }, { variant: 'green', fontSize: 68 });

    makeButton(this, GAME_W / 2, 1080, 600, 124, t('shop'), () => {
      audio.click();
      this.scene.start('Shop');
    });

    makeButton(this, GAME_W / 2, 1240, 600, 124, t('leaderboard'), () => {
      audio.click();
      this.scene.start('Leaderboard');
    });

    // Переключатель звука
    this.soundBtn = makeButton(this, GAME_W - 100, GAME_H - 100, 128, 128, saves.data.soundOn ? '♪' : '✕', () => {
      const on = saves.toggleSound();
      audio.setEnabled(on);
      this.soundBtn.labelText.setText(on ? '♪' : '✕');
      audio.click();
    }, { variant: 'gray', fontSize: 56 });

    // Обязательный сигнал платформе «игра загрузилась» — после первой отрисовки меню
    this.sdk.loadingReady();
    this.sdk.showBanner();

    const daily = saves.getDailyBonus();
    if (daily) this._showDailyBonus(daily);
  }

  /** Ежедневный бонус: забрать обычную сумму или x2 за rewarded. */
  _showDailyBonus({ streak, amount }) {
    const overlay = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    dim.setInteractive();

    const panel = this.add.graphics();
    panel.fillStyle(0x081c15, 0.98).fillRoundedRect(80, GAME_H / 2 - 400, GAME_W - 160, 760, 48);
    panel.lineStyle(6, 0xffd93b, 1).strokeRoundedRect(80, GAME_H / 2 - 400, GAME_W - 160, 760, 48);

    const title = this.add.text(GAME_W / 2, GAME_H / 2 - 300, t('dailyBonus'), {
      fontFamily: FONT, fontSize: '64px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5);
    const streakText = this.add.text(GAME_W / 2, GAME_H / 2 - 200, `${t('dailyStreak')} ${streak}`, {
      fontFamily: FONT, fontSize: '44px', color: '#95d5b2',
    }).setOrigin(0.5);

    const icon = drawBananaIcon(this, GAME_W / 2 - 90, GAME_H / 2 - 80, 1.4);
    const amountText = this.add.text(GAME_W / 2 - 20, GAME_H / 2 - 80, `+${amount}`, {
      fontFamily: FONT, fontSize: '80px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const claimBtn = makeButton(this, GAME_W / 2, GAME_H / 2 + 80, 580, 120, t('claim'), () => {
      audio.coin();
      saves.claimDailyBonus(1);
      this._refreshCoins();
      overlay.destroy();
    }, { variant: 'yellow' });

    const claimX2Btn = makeButton(this, GAME_W / 2, GAME_H / 2 + 240, 580, 120, t('claimX2'), async () => {
      claimX2Btn.disableInteractive();
      audio.click();
      const rewarded = await ads.showRewarded();
      if (rewarded) {
        saves.claimDailyBonus(2);
        audio.coin();
      } else {
        saves.claimDailyBonus(1);
      }
      this._refreshCoins();
      overlay.destroy();
    }, { variant: 'green' });
    const badge = adBadge(this, GAME_W / 2 - 244, GAME_H / 2 + 240);

    overlay.add([dim, panel, title, streakText, icon, amountText, claimBtn, claimX2Btn, badge]);
  }

  _refreshCoins() {
    this.coinCounter.valueText.setText(String(saves.data.coins));
  }
}
