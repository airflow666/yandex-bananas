import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT, makeButton, makeCoinCounter, toast, adBadge } from '../ui.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { t } from '../systems/i18n.js';
import { SKINS } from '../skins.js';

export default class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b4332).setOrigin(0);

    this.add.text(GAME_W / 2, 120, t('skinsTitle'), {
      fontFamily: FONT, fontSize: '68px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.coinCounter = makeCoinCounter(this, 32, 72, saves.data.coins);

    this.cards = [];
    SKINS.forEach((skin, i) => this._makeCard(skin, 300 + i * 300));

    makeButton(this, GAME_W / 2, GAME_H - 140, 480, 120, t('back'), () => {
      audio.click();
      this.scene.start('Menu');
    }, { variant: 'gray' });
  }

  _makeCard(skin, y) {
    const card = this.add.container(0, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x081c15, 0.85).fillRoundedRect(48, 0, GAME_W - 96, 260, 36);

    // превью блока в цветах скина
    const preview = this.add.graphics({ x: 210, y: 130 });
    preview.fillStyle(skin.dark, 1).fillRoundedRect(-120, -44, 240, 88, 16);
    preview.fillStyle(skin.body, 1).fillRoundedRect(-120, -56, 240, 88, 16);
    preview.lineStyle(10, skin.accent, 1);
    preview.beginPath();
    preview.arc(0, 0, 20, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330), false);
    preview.strokePath();

    const name = this.add.text(390, 60, t(`skin_${skin.id}`), {
      fontFamily: FONT, fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    });

    card.add([bg, preview, name]);
    card.skin = skin;
    this.cards.push(card);
    this._renderCardButton(card);
  }

  /** Кнопка на карточке зависит от состояния: купить / выбрать / выбран. */
  _renderCardButton(card) {
    card.btn?.destroy();
    card.badge?.destroy();
    card.priceText?.destroy();
    const skin = card.skin;
    const owned = saves.data.ownedSkins.includes(skin.id);
    const active = saves.data.activeSkin === skin.id;

    let label;
    let variant;
    if (active) { label = t('selected'); variant = 'gray'; }
    else if (owned) { label = t('select'); variant = 'green'; }
    else if (skin.adUnlock) { label = t('freeForAd'); variant = 'green'; }
    else { label = `${t('buy')} · ${skin.cost}`; variant = 'yellow'; }

    card.btn = makeButton(this, 640, card.y + 170, 480, 100, label, () => this._onCardClick(card), { fontSize: 36, variant });
    if (!owned && skin.adUnlock) card.badge = adBadge(this, 420, card.y + 170);
    if (active) card.btn.disableInteractive();
  }

  async _onCardClick(card) {
    const skin = card.skin;
    const owned = saves.data.ownedSkins.includes(skin.id);
    audio.click();

    if (owned) {
      saves.setActiveSkin(skin.id);
    } else if (skin.adUnlock) {
      // скин за просмотр рекламы
      const rewarded = await ads.showRewarded();
      if (!rewarded) return;
      saves.ownSkin(skin.id);
      saves.setActiveSkin(skin.id);
      audio.coin();
    } else {
      if (!saves.spendCoins(skin.cost)) {
        toast(this, t('notEnough'));
        return;
      }
      saves.ownSkin(skin.id);
      saves.setActiveSkin(skin.id);
      audio.coin();
    }
    this.coinCounter.valueText.setText(String(saves.data.coins));
    this.cards.forEach((c) => this._renderCardButton(c));
  }
}
