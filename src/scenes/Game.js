import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT, makeButton, makeCoinCounter, adBadge } from '../ui.js';
import { saves } from '../systems/saves.js';
import { ads } from '../systems/ads.js';
import { audio } from '../systems/audio.js';
import { t } from '../systems/i18n.js';
import { getSkin } from '../skins.js';

const BLOCK_H = 56;
const START_W = 240;
const PERFECT_TOL = 10;   // допуск для «идеального» попадания, px
const MIN_OVERLAP = 6;    // меньше — считаем полным промахом
const DROP_SPEED = 1500;  // px/s падения блока
const CAMERA_ANCHOR = 0.62; // вершина башни держится на этой доле высоты экрана

// Фоновые «слои» по высоте башни: джунгли → небо → космос
const BG_STOPS = [
  { floors: 0, color: 0x2d6a4f },
  { floors: 18, color: 0x52b69a },
  { floors: 36, color: 0x4cc9f0 },
  { floors: 60, color: 0x3a0ca3 },
  { floors: 90, color: 0x10002b },
];

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.sdk = this.registry.get('sdk');
    this.skin = getSkin(saves.data.activeSkin);

    this.floors = 0;
    this.combo = 0;
    this.runCoins = 0;
    this.usedSecondLife = false;
    this.state = 'swinging'; // swinging | dropping | paused | over
    this.placed = [];        // [{x, w, y}] снизу вверх

    this.cameras.main.setBackgroundColor(BG_STOPS[0].color);
    this._createBackground();
    this._createBase();
    this._createHud();
    this._spawnSwingingBlock(START_W);

    // тап по интерактивным элементам (кнопка звука, оверлеи) не должен ронять блок
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      if (currentlyOver.length > 0) return;
      this._onTap();
    });
    this.keySpace = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keySpace?.on('down', this._onTap, this);

    // Требования модерации Яндекса: GameplayAPI.start/stop
    this.sdk.hideBanner();
    this.sdk.gameplayStart();
    this._onHidden = () => { if (this.state !== 'over') this.sdk.gameplayStop(); };
    this._onVisible = () => { if (this.state !== 'over') this.sdk.gameplayStart(); };
    this.game.events.on(Phaser.Core.Events.HIDDEN, this._onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this._onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this._onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this._onVisible);
      this.keySpace?.off('down', this._onTap, this);
    });
  }

  // ---------- построение сцены ----------

  _createBackground() {
    this.bgRect = this.add.rectangle(0, 0, GAME_W, GAME_H, BG_STOPS[0].color)
      .setOrigin(0).setScrollFactor(0).setDepth(-10);

    // Параллакс-декор: облака/листья внизу, звёзды выше
    this.decor = this.add.container(0, 0).setDepth(-5);
    const rng = new Phaser.Math.RandomDataGenerator(['bananas']);
    for (let i = 0; i < 40; i++) {
      const y = GAME_H - 200 - i * 260;
      const x = rng.between(30, GAME_W - 30);
      const g = this.add.graphics({ x, y });
      if (i < 6) { // облака
        g.fillStyle(0xffffff, 0.25);
        g.fillEllipse(0, 0, rng.between(90, 150), 34);
        g.fillEllipse(30, -12, 70, 28);
      } else { // звёзды
        g.fillStyle(0xffffff, rng.realInRange(0.4, 0.9));
        g.fillCircle(0, 0, rng.between(2, 4));
      }
      g.setScrollFactor(0.35);
      this.decor.add(g);
    }
  }

  _createBase() {
    const groundY = GAME_H - 90;
    const g = this.add.graphics();
    // земля
    g.fillStyle(0x40241a, 1).fillRect(-200, groundY, GAME_W + 400, 300);
    g.fillStyle(0x59a14f, 1).fillRect(-200, groundY, GAME_W + 400, 14);
    // обезьянка-строитель рядом с башней
    this._drawMonkey(g, GAME_W / 2 - START_W / 2 - 58, groundY - 30);

    const baseY = groundY - BLOCK_H / 2;
    const base = this._makeBlock(GAME_W / 2, baseY, START_W);
    this.placed.push({ x: GAME_W / 2, w: START_W, y: baseY, obj: base });
  }

  _drawMonkey(g, x, y) {
    g.fillStyle(0x6f4e37, 1);
    g.fillCircle(x, y, 22);          // тело
    g.fillCircle(x, y - 30, 16);     // голова
    g.fillCircle(x - 14, y - 36, 7); // уши
    g.fillCircle(x + 14, y - 36, 7);
    g.fillStyle(0xd7b899, 1);
    g.fillEllipse(x, y - 27, 18, 14); // мордочка
    g.fillStyle(0x2b1d12, 1);
    g.fillCircle(x - 5, y - 33, 2.4); // глаза
    g.fillCircle(x + 5, y - 33, 2.4);
  }

  _createHud() {
    this.scoreText = this.add.text(GAME_W / 2, 76, '0', {
      fontFamily: FONT, fontSize: '64px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#00000055', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.coinCounter = makeCoinCounter(this, 16, 36, this.runCoins);
    this.coinCounter.setScrollFactor(0).setDepth(100);

    this.comboText = this.add.text(GAME_W / 2, 130, '', {
      fontFamily: FONT, fontSize: '26px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.hintText = this.add.text(GAME_W / 2, GAME_H - 260, t('tapToDrop'), {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0.9);
    this.tweens.add({ targets: this.hintText, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });

    // Кнопка звука доступна и в геймплее (требование к играм со звуком)
    this.soundBtn = makeButton(this, GAME_W - 42, 40, 52, 52, saves.data.soundOn ? '♪' : '✕', () => {
      const on = saves.toggleSound();
      audio.setEnabled(on);
      this.soundBtn.labelText.setText(on ? '♪' : '✕');
      audio.click();
    }, { variant: 'gray', fontSize: 22 });
    this.soundBtn.setScrollFactor(0).setDepth(100).setAlpha(0.8);
  }

  // ---------- блоки ----------

  /** Рисует блок-связку бананов шириной w в контейнере (центр в x,y). */
  _makeBlock(x, y, w) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    this._drawBlockGraphics(g, w);
    c.add(g);
    c.blockGraphics = g;
    return c;
  }

  _drawBlockGraphics(g, w) {
    const s = this.skin;
    const h = BLOCK_H;
    g.clear();
    g.fillStyle(s.dark, 1).fillRoundedRect(-w / 2, -h / 2 + 6, w, h - 6, 10);
    g.fillStyle(s.body, 1).fillRoundedRect(-w / 2, -h / 2, w, h - 10, 10);
    g.fillStyle(s.light, 0.55).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, 8, 4);
    // бананы-крестики на блоке
    const count = Math.max(1, Math.floor(w / 55));
    const step = w / (count + 1);
    for (let i = 1; i <= count; i++) {
      const bx = -w / 2 + step * i;
      g.lineStyle(6, s.accent, 1);
      g.beginPath();
      g.arc(bx, 6, 11, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330), false);
      g.strokePath();
    }
  }

  _spawnSwingingBlock(w) {
    const top = this.placed[this.placed.length - 1];
    const camTarget = this._cameraTargetY();
    const swingY = camTarget + 150;

    this.swingDir = this.floors % 2 === 0 ? 1 : -1;
    const startX = this.swingDir === 1 ? w / 2 + 10 : GAME_W - w / 2 - 10;
    this.swinging = this._makeBlock(startX, swingY, w);
    this.swinging.blockWidth = w;
    this.swingSpeed = Math.min(230 + this.floors * 8, 560);
    this.prevTop = top;
    this.state = 'swinging';
  }

  _cameraTargetY() {
    const top = this.placed[this.placed.length - 1];
    const topSurface = top.y - BLOCK_H / 2;
    return Math.min(0, topSurface - GAME_H * CAMERA_ANCHOR);
  }

  update(_, deltaMs) {
    if (this.state !== 'swinging' || !this.swinging) return;
    const dt = deltaMs / 1000;
    const w = this.swinging.blockWidth;
    let x = this.swinging.x + this.swingDir * this.swingSpeed * dt;
    const minX = w / 2 - 30;
    const maxX = GAME_W - w / 2 + 30;
    if (x <= minX) { x = minX; this.swingDir = 1; }
    if (x >= maxX) { x = maxX; this.swingDir = -1; }
    this.swinging.x = x;
  }

  // ---------- игровой цикл ----------

  _onTap() {
    if (this.state !== 'swinging') return;
    this.state = 'dropping';
    this.hintText.setVisible(false);
    audio.drop();

    const prev = this.prevTop;
    const targetY = prev.y - BLOCK_H;
    const dist = targetY - this.swinging.y;
    this.tweens.add({
      targets: this.swinging,
      y: targetY,
      duration: Math.max(90, (dist / DROP_SPEED) * 1000),
      ease: 'Quad.easeIn',
      onComplete: () => this._resolveDrop(),
    });
  }

  _resolveDrop() {
    const block = this.swinging;
    const prev = this.prevTop;
    const w = block.blockWidth;

    const left = Math.max(block.x - w / 2, prev.x - prev.w / 2);
    const right = Math.min(block.x + w / 2, prev.x + prev.w / 2);
    const overlap = right - left;

    if (overlap < MIN_OVERLAP) {
      this._missBlock(block);
      return;
    }

    const offset = Math.abs(block.x - prev.x) + Math.abs(w - prev.w) / 2;
    let newW;
    if (offset <= PERFECT_TOL) {
      // идеальное попадание: ширина сохраняется, комбо растёт
      newW = Math.min(w, prev.w);
      block.x = prev.x;
      this.combo += 1;
      this._onPerfect();
    } else {
      newW = overlap;
      const newX = (left + right) / 2;
      this._dropCutPiece(block, newX, newW);
      block.x = newX;
      this.combo = 0;
      this.comboText.setText('');
      audio.land();
    }

    block.blockWidth = newW;
    this._drawBlockGraphics(block.blockGraphics, newW);
    this.placed.push({ x: block.x, w: newW, y: block.y, obj: block });
    this.swinging = null;

    this.floors += 1;
    const coinGain = 1 + this.combo;
    this.runCoins += coinGain;
    this.scoreText.setText(String(this.floors));
    this.coinCounter.valueText.setText(String(this.runCoins));

    this._updateBackground();
    const camY = this._cameraTargetY();
    this.tweens.add({
      targets: this.cameras.main, scrollY: camY, duration: 260, ease: 'Quad.easeOut',
      onComplete: () => { if (this.state !== 'over') this._spawnSwingingBlock(newW); },
    });
    this.state = 'paused';
  }

  /** Цвет фона плавно меняется с высотой: джунгли → небо → космос. */
  _updateBackground() {
    const f = this.floors;
    let a = BG_STOPS[0];
    let b = BG_STOPS[BG_STOPS.length - 1];
    for (let i = 0; i < BG_STOPS.length - 1; i++) {
      if (f >= BG_STOPS[i].floors && f <= BG_STOPS[i + 1].floors) {
        a = BG_STOPS[i];
        b = BG_STOPS[i + 1];
        break;
      }
    }
    const span = Math.max(1, b.floors - a.floors);
    const k = Phaser.Math.Clamp((f - a.floors) / span, 0, 1);
    const ca = Phaser.Display.Color.ValueToColor(a.color);
    const cb = Phaser.Display.Color.ValueToColor(b.color);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, k * 100);
    this.bgRect.setFillStyle(Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b));
  }

  _onPerfect() {
    audio.perfect();
    this.comboText.setText(`${t('combo')} x${this.combo + 1}`);
    const fx = this.add.text(GAME_W / 2, GAME_H * 0.42, t('perfect'), {
      fontFamily: FONT, fontSize: '40px', color: '#7CFC00', fontStyle: 'bold',
      stroke: '#00000066', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setScale(0.4);
    this.tweens.add({
      targets: fx, scale: 1, alpha: { from: 1, to: 0 }, y: '-=70',
      duration: 700, ease: 'Back.easeOut', onComplete: () => fx.destroy(),
    });
    this.cameras.main.flash(120, 255, 255, 180);
  }

  /** Отрезанный свес падает вниз с вращением. */
  _dropCutPiece(block, newX, newW) {
    audio.cut();
    const w = block.blockWidth;
    const cutW = w - newW;
    if (cutW < 2) return;
    const side = block.x < newX ? -1 : 1; // с какой стороны свес
    const pieceX = side === -1 ? block.x - w / 2 + cutW / 2 : block.x + w / 2 - cutW / 2;
    const piece = this.add.graphics({ x: pieceX, y: block.y });
    const s = this.skin;
    piece.fillStyle(s.dark, 1).fillRoundedRect(-cutW / 2, -BLOCK_H / 2 + 6, cutW, BLOCK_H - 6, 8);
    piece.fillStyle(s.body, 1).fillRoundedRect(-cutW / 2, -BLOCK_H / 2, cutW, BLOCK_H - 10, 8);
    this.tweens.add({
      targets: piece,
      y: piece.y + 700,
      angle: side * 120,
      alpha: 0.2,
      duration: 900,
      ease: 'Quad.easeIn',
      onComplete: () => piece.destroy(),
    });
  }

  _missBlock(block) {
    this.state = 'over';
    audio.gameOver();
    this.cameras.main.shake(250, 0.012);
    this.tweens.add({
      targets: block,
      y: block.y + 900,
      angle: block.x < this.prevTop.x ? -160 : 160,
      duration: 1000,
      ease: 'Quad.easeIn',
      onComplete: () => block.destroy(),
    });
    this.swinging = null;
    this.sdk.gameplayStop();

    if (!this.usedSecondLife && this.floors >= 3) {
      this.time.delayedCall(600, () => this._offerSecondLife());
    } else {
      this.time.delayedCall(900, () => this._finishRun());
    }
  }

  // ---------- вторая жизнь (rewarded) ----------

  _offerSecondLife() {
    // Контейнер ставим в мировые координаты со сдвигом камеры: у Phaser
    // хит-тест детей контейнера со scrollFactor(0) работает неверно при скролле
    const overlay = this.add.container(0, this.cameras.main.scrollY).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.65).setOrigin(0);
    dim.setInteractive(); // блокирует тапы «сквозь» оверлей

    const panel = this.add.graphics();
    panel.fillStyle(0x1b4332, 0.98).fillRoundedRect(40, GAME_H / 2 - 190, GAME_W - 80, 340, 24);

    const title = this.add.text(GAME_W / 2, GAME_H / 2 - 130, t('secondLife'), {
      fontFamily: FONT, fontSize: '36px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5);
    const desc = this.add.text(GAME_W / 2, GAME_H / 2 - 75, t('secondLifeDesc'), {
      fontFamily: FONT, fontSize: '20px', color: '#d8f3dc', align: 'center',
      wordWrap: { width: GAME_W - 130 },
    }).setOrigin(0.5);

    const continueBtn = makeButton(this, GAME_W / 2, GAME_H / 2 + 5, 280, 66, t('continueBtn'), async () => {
      continueBtn.disableInteractive();
      audio.click();
      const rewarded = await ads.showRewarded();
      overlay.destroy();
      if (rewarded) {
        this._revive();
      } else {
        this._finishRun();
      }
    }, { variant: 'green' });
    const badge = adBadge(this, GAME_W / 2 - 118, GAME_H / 2 + 5);

    const declineBtn = makeButton(this, GAME_W / 2, GAME_H / 2 + 95, 280, 54, t('noThanks'), () => {
      audio.click();
      overlay.destroy();
      this._finishRun();
    }, { variant: 'gray', fontSize: 20 });

    overlay.add([dim, panel, title, desc, continueBtn, badge, declineBtn]);
  }

  _revive() {
    this.usedSecondLife = true;
    this.combo = 0;
    this.comboText.setText('');
    this.sdk.gameplayStart();
    const top = this.placed[this.placed.length - 1];
    this._spawnSwingingBlock(top.w);
  }

  _finishRun() {
    this.scene.start('GameOver', {
      score: this.floors,
      coins: this.runCoins,
    });
  }
}
