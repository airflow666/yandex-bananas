/** Переиспользуемые элементы интерфейса. */

import Phaser from 'phaser';

export const GAME_W = 480;
export const GAME_H = 854;

export const FONT = '"Trebuchet MS", "Arial Black", sans-serif';

export const COLORS = {
  btn: 0xffb703,
  btnDark: 0xc98a00,
  btnGreen: 0x52b788,
  btnGreenDark: 0x2d6a4f,
  btnGray: 0x6c757d,
  btnGrayDark: 0x495057,
  panel: 0x1b4332,
  text: '#fff8e7',
  textDark: '#4a3000',
};

/**
 * Кнопка: скруглённый прямоугольник с «нижней гранью» и текстом.
 * variant: 'yellow' | 'green' | 'gray'
 */
export function makeButton(scene, x, y, w, h, label, onClick, opts = {}) {
  const { variant = 'yellow', fontSize = 24 } = opts;
  const palettes = {
    yellow: [COLORS.btn, COLORS.btnDark, COLORS.textDark],
    green: [COLORS.btnGreen, COLORS.btnGreenDark, '#eafff3'],
    gray: [COLORS.btnGray, COLORS.btnGrayDark, '#f0f0f0'],
  };
  const [body, dark, textColor] = palettes[variant];

  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(dark, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
  g.fillStyle(body, 1).fillRoundedRect(-w / 2, -h / 2, w, h - 4, 14);
  const txt = scene.add.text(0, -2, label, {
    fontFamily: FONT, fontSize: `${fontSize}px`, color: textColor, fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5);
  c.add([g, txt]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.95));
  c.on('pointerup', () => { c.setScale(1); onClick?.(); });
  c.on('pointerout', () => c.setScale(1));
  c.labelText = txt;
  return c;
}

/** Иконка банана (рисуется графикой, без ассетов). */
export function drawBananaIcon(scene, x, y, scale = 1) {
  const g = scene.add.graphics({ x, y });
  g.setScale(scale);
  g.lineStyle(7, 0xd4a017, 1);
  g.beginPath();
  g.arc(0, -4, 13, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
  g.strokePath();
  g.lineStyle(5, 0xffd93b, 1);
  g.beginPath();
  g.arc(0, -5, 13, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false);
  g.strokePath();
  return g;
}

/** Счётчик бананов (иконка + число) в углу экрана. */
export function makeCoinCounter(scene, x, y, value) {
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.35).fillRoundedRect(-8, -18, 116, 36, 18);
  const icon = drawBananaIcon(scene, 10, 2, 0.8);
  const txt = scene.add.text(28, 0, String(value), {
    fontFamily: FONT, fontSize: '22px', color: '#ffe680', fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  c.add([bg, icon, txt]);
  c.valueText = txt;
  return c;
}

/** Всплывающее сообщение по центру экрана. */
export function toast(scene, message) {
  const txt = scene.add.text(GAME_W / 2, GAME_H / 2, message, {
    fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 18, y: 10 }, align: 'center',
  }).setOrigin(0.5).setDepth(1000).setScrollFactor(0);
  scene.tweens.add({
    targets: txt, alpha: 0, y: GAME_H / 2 - 60, delay: 900, duration: 500,
    onComplete: () => txt.destroy(),
  });
}

/** Значок «▶ реклама» для кнопок с rewarded. */
export function adBadge(scene, x, y) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2f6fed, 1).fillCircle(0, 0, 14);
  g.fillStyle(0xffffff, 1).fillTriangle(-4, -7, -4, 7, 8, 0);
  c.add(g);
  return c;
}
