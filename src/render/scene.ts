/**
 * Сборка кадра. Всё рисуется кодом: ни одного стороннего ассета.
 *
 * Порядок слоёв — и есть композиция. Он читается сверху вниз как «от самого
 * далёкого к самому близкому», и любой новый объект обязан встать в этот
 * список, а не рисоваться где придётся:
 *
 *   1. фон (небо, дальние кроны, стволы, земля)   — background.ts
 *   2. башня и лиана                              — tower.ts
 *   3. частицы (пыль, листья)
 *   4. обезьяны на стволах                        — tower.ts
 *   5. передние листья                            — background.ts
 *   6. пост-эффекты (вспышка, виньетка биома)
 *   7. интерфейс                                  — ui/screens.ts
 *
 * Тряска камеры применяется к слоям 1–5 и НЕ применяется к интерфейсу:
 * счёт и кнопки обязаны оставаться читаемыми ровно в тот момент, когда всё
 * трясётся, — иначе игрок теряет опору.
 */

import { C, M, alpha, lightingAt } from '../art/theme';
import { getLayout } from '../core/layout';
import type { Session } from '../game/session';
import { drawBackground, drawForeground } from './background';
import { drawFallingCrate, drawLiana, drawMonkeys, drawSlices, drawTower } from './tower';

/**
 * Доля высоты, на которой камера удерживает верхушку башни.
 * Ниже 0.74 верх кадра пустует, выше — башне не остаётся места под собой.
 */
const GROUND_RATIO = 0.74;

export function render(ctx: CanvasRenderingContext2D, s: Session): void {
  const L = getLayout();
  const groundY = L.height * GROUND_RATIO;
  const light = lightingAt(s.tower.floors);

  // Тряска: квадрат делает слабые толчки почти незаметными, а сильные —
  // резкими. Линейная тряска ощущается «ватной» на всём диапазоне.
  const mag = s.shake * s.shake;
  const shakeX = (Math.random() - 0.5) * 2 * mag * 18;
  const shakeY = (Math.random() - 0.5) * 2 * mag * 14;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground(ctx, s, L, groundY, light);

  ctx.save();
  // Крен применяется ко всей башне одним поворотом, а не поворотом каждого
  // ящика. Шарнир — НЕ фундамент, а точка на `leverLength()` ниже верхушки
  // (см. LEVER_FLOORS в game/tower.ts): на большой высоте фундамент уходит
  // далеко за кадр, и поворот вокруг него читался как езда вбок целиком.
  const baseX = s.tower.blocks[0]?.x ?? L.centerX;
  const topY = groundY - s.tower.floors * M.floorH + s.cameraY;
  const pivotY = topY + s.tower.leverLength();
  ctx.translate(baseX, pivotY);
  ctx.rotate(s.tower.angle);
  ctx.translate(-baseX, -pivotY);
  drawTower(ctx, s, groundY, L.height);
  ctx.restore();

  drawSlices(ctx, s, groundY);
  drawDust(ctx, s, groundY);

  // Летящий ящик рисуется и после проигрыша: промахнувшийся продолжает
  // кувыркаться мимо башни, и именно это объясняет игроку, что произошло.
  drawFallingCrate(ctx, s, groundY);
  if (s.phase === 'playing') drawLiana(ctx, s, groundY);

  drawMonkeys(ctx, s, L, groundY);
  drawForeground(ctx, s, L);

  ctx.restore();

  if (s.flash > 0) {
    ctx.fillStyle = alpha(C.danger, s.flash * 0.38);
    ctx.fillRect(0, 0, L.width, L.height);
  }
}

/**
 * Частицы: пыль от удара (тонет под гравитацией, цвет светлый) и ветряные
 * листья (не тонут, летят по ветру, зелёные и вытянутые). Одна структура на
 * два случая — разводятся флагом ambient.
 */
function drawDust(
  ctx: CanvasRenderingContext2D, s: Session, groundY: number,
): void {
  for (const d of s.dust) {
    const y = groundY - d.y + s.cameraY;
    const a = Math.max(0, Math.min(1, d.life / d.maxLife));
    ctx.save();
    if (d.ambient) {
      // Листок кувыркается в полёте: поворот привязан к его собственному
      // сроку жизни, поэтому каждый крутится по-своему.
      ctx.globalAlpha = a * 0.75;
      ctx.translate(d.x, y);
      ctx.rotate(d.life * 3.4 + d.x * 0.01);
      ctx.fillStyle = C.leaf;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.r * 2.1, d.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(C.canopyDeep, 0.5);
      ctx.fillRect(-d.r * 2.1, -0.6, d.r * 4.2, 1.2);
    } else {
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = C.bananaPale;
      ctx.beginPath();
      ctx.arc(d.x, y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
