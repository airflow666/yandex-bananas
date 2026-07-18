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

    this.add.text(GAME_W / 2, 60, t('skinsTitle'), {
      fontFamily: FONT, fontSize: '34px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.coinCounter = makeCoinCounter(this, 16, 36, saves.data.coins);

    this.cards = [];
    SKINS.forEach((skin, i) => this._makeCard(skin, 150 + i * 150));

    makeButton(this, GAME_W / 2, GAME_H - 70, 240, 60, t('back'), () => {
      audio.click();
      this.scene.start('Menu');
    }, { variant: 'gray' });
  }

  _makeCard(skin, y) {
    const card = this.add.container(0, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x081c15, 0.85).fillRoundedRect(24, 0, GAME_W - 48, 130, 18);

    // превью блока в цветах скина
    const preview = this.add.graphics({ x: 105, y: 65 });
    preview.fillStyle(skin.dark, 1).fillRoundedRect(-60, -22, 120, 44, 8);
    preview.fillStyle(skin.body, 1).fillRoundedRect(-60, -28, 120, 44, 8);
    preview.lineStyle(5, skin.accent, 1);
    preview.beginPath();
    preview.arc(0, 0, 10, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330), false);
    preview.strokePath();

    const name = this.add.text(195, 30, t(`skin_${skin.id}`), {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
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

    card.btn = makeButton(this, 320, card.y + 85, 240, 50, label, () => this._onCardClick(card), { fontSize: 18, variant });
    if (!owned && skin.adUnlock) card.badge = adBadge(this, 210, card.y + 85);
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
