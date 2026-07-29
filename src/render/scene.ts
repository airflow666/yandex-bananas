/**
 * Отрисовка кадра. Всё рисуется кодом: ни одного стороннего ассета.
 *
 * Композиция построена вокруг двух вещей, которых не хватало прошлой версии:
 * фон занимает кадр ЦЕЛИКОМ при любом соотношении сторон (пустых полей по
 * бокам больше нет — это и вид, и п. 5.1.1.2), а верх башни удерживается
 * камерой на постоянной высоте, поэтому мёртвой зоны между блоком и башней
 * не возникает.
 */

import { C, M, font, mix } from '../art/theme';
import { getLayout } from '../core/layout';
import { t } from '../i18n';
import type { Session } from '../game/session';

/** Доля высоты, на которой стоит основание башни. */
const GROUND_RATIO = 0.78;
/** На сколько этажей выше верхушки висит блок на маятнике. */
const DROP_HEIGHT_FLOORS = 3.2;

export function render(ctx: CanvasRenderingContext2D, s: Session): void {
  const L = getLayout();
  const groundY = L.height * GROUND_RATIO;

  drawSky(ctx, L.width, L.height, s.tower.floors);
  drawGround(ctx, L.width, L.height, groundY);

  ctx.save();
  // Крен применяется ко всей башне поворотом вокруг основания — дёшево и
  // выразительно, вместо поворота каждого блока по отдельности.
  ctx.translate(s.tower.blocks[0]?.x ?? L.centerX, groundY);
  ctx.rotate(s.tower.angle);
  ctx.translate(-(s.tower.blocks[0]?.x ?? L.centerX), -groundY);
  drawTower(ctx, s, groundY);
  ctx.restore();

  drawSlices(ctx, s, groundY);

  if (s.phase === 'playing') drawPendulumBlock(ctx, s, groundY);

  drawHud(ctx, s, L.width);
  if (s.phase === 'menu') drawTitle(ctx, L.width, L.height);
  if (s.phase === 'over') drawGameOver(ctx, s, L.width, L.height);
}

/** Небо: вертикальный градиент, светлеющий с высотой башни. */
function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, floors: number): void {
  const climb = Math.min(1, floors / 90);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(C.sky, C.skyHigh, climb));
  g.addColorStop(1, mix(C.skyDeep, C.sky, climb * 0.6));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number): void {
  ctx.fillStyle = mix(C.skyDeep, C.ink, 0.5);
  ctx.fillRect(0, groundY + M.floorH / 2, w, h - groundY);
}

function drawTower(ctx: CanvasRenderingContext2D, s: Session, groundY: number): void {
  for (const b of s.tower.blocks) {
    const y = groundY - b.floor * M.floorH + s.cameraY;
    if (y < -M.floorH * 2 || y > groundY + M.floorH * 4) continue; // за кадром
    drawBlock(ctx, b.x, y, b.w, b.perfect);
  }
}

/** Блок: тело, светлая «полка» сверху и тень снизу — объём без текстур. */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  perfect: boolean,
): void {
  const h = M.floorH;
  const r = h * M.blockRadius;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.fillStyle = perfect ? C.bananaLight : C.banana;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  ctx.fillStyle = perfect ? '#fff6cf' : C.bananaLight;
  roundRect(ctx, x + r * 0.5, y + 2, Math.max(0, w - r), h * M.glossH, r * 0.6);
  ctx.fill();

  ctx.fillStyle = C.bananaDark;
  roundRect(ctx, x + r * 0.5, y + h - h * 0.16, Math.max(0, w - r), h * 0.12, r * 0.5);
  ctx.fill();
}

function drawPendulumBlock(ctx: CanvasRenderingContext2D, s: Session, groundY: number): void {
  const x = s.pendulum.x;
  const y = groundY - (s.tower.floors + DROP_HEIGHT_FLOORS) * M.floorH + s.cameraY;
  const w = s.tower.top.w;

  // Трос до верхней кромки кадра — видно, что блок висит, а не парит.
  ctx.strokeStyle = 'rgba(234,246,237,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s.pendulum.centerX, 0);
  ctx.lineTo(x, y - M.floorH / 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  // Наклон по скорости: у краёв блок висит ровно, в центре — заваливается.
  ctx.rotate(s.pendulum.velocityNorm * 0.14);
  ctx.translate(-x, -y);
  drawBlock(ctx, x, y, w, false);
  ctx.restore();
}

function drawSlices(ctx: CanvasRenderingContext2D, s: Session, groundY: number): void {
  for (const sl of s.slices) {
    const y = groundY - sl.y + s.cameraY;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, sl.life));
    ctx.translate(sl.x, y);
    ctx.rotate(sl.rot);
    ctx.translate(-sl.x, -y);
    drawBlock(ctx, sl.x, y, sl.w, false);
    ctx.restore();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: Session, w: number): void {
  const L = getLayout();
  ctx.fillStyle = C.paper;
  ctx.textBaseline = 'top';

  ctx.textAlign = 'left';
  ctx.font = font(34);
  ctx.fillText(`${t('floors')}: ${s.tower.floors}`, L.padX, L.padY);

  ctx.textAlign = 'right';
  ctx.fillText(`${t('coins')}: ${s.coins}`, w - L.padX, L.padY);

  if (s.praise > 0) {
    ctx.save();
    ctx.globalAlpha = s.praise;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.bananaLight;
    ctx.font = font(46 + (1 - s.praise) * 10);
    ctx.fillText(t('perfect'), L.centerX, L.height * 0.3);
    ctx.restore();
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.banana;
  ctx.font = font(Math.min(96, w * 0.11));
  ctx.fillText(t('title'), w / 2, h * 0.22);
  ctx.fillStyle = C.paper;
  ctx.font = font(34, 'normal');
  ctx.fillText(t('tapToStart'), w / 2, h * 0.32);
}

function drawGameOver(ctx: CanvasRenderingContext2D, s: Session, w: number, h: number): void {
  ctx.fillStyle = 'rgba(11,31,20,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = C.danger;
  ctx.font = font(Math.min(72, w * 0.085));
  ctx.fillText(t('gameOver'), w / 2, h * 0.36);

  ctx.fillStyle = C.paper;
  ctx.font = font(44);
  ctx.fillText(`${t('floors')}: ${s.tower.floors}`, w / 2, h * 0.47);
  ctx.font = font(32, 'normal');
  ctx.fillText(t('tapToRestart'), w / 2, h * 0.57);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
