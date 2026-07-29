/**
 * Канвас, DPR и связь с адаптивной раскладкой.
 *
 * Рисуем всегда в ЛОГИЧЕСКИХ координатах из core/layout.ts, а перевод в
 * физические пиксели делает одна матрица трансформации. Это то, чего не
 * хватало прошлой версии: там были жёсткие 960×1708 и Scale.FIT, из-за чего
 * на десктопе поле занимало ~27% ширины кадра — и красиво не выглядело, и
 * скриншот не мог показать 70% геймплея, как требует п. 5.1.1.2.
 *
 * Здесь фиксирована только логическая высота; ширина следует за окном, и
 * фон занимает кадр целиком при любом соотношении сторон.
 */

import { updateLayout, getLayout, type Layout } from './layout';

/** Выше этого DPR выигрыш в чёткости уже незаметен, а цена в пикселях — велика. */
const MAX_DPR = 2;

export interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  layout: Layout;
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let scale = 1;

export function createSurface(parent: HTMLElement): Surface {
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  parent.appendChild(canvas);

  const c = canvas.getContext('2d', { alpha: false });
  if (!c) throw new Error('canvas 2d context unavailable');
  ctx = c;

  resize();
  window.addEventListener('resize', resize);
  // Смена ориентации на части устройств приходит позже resize и с ещё
  // старыми размерами — пересчитываем повторно.
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  return { canvas, ctx, layout: getLayout() };
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const layout = updateLayout(w, h);

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  // Логическая высота постоянна, поэтому масштаб выводим из неё.
  scale = (h * dpr) / layout.height;
}

/** Установить трансформацию «логические единицы → пиксели». Вызывать в начале кадра. */
export function beginFrame(): CanvasRenderingContext2D {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return ctx;
}

export function getContext(): CanvasRenderingContext2D { return ctx; }
export function getCanvas(): HTMLCanvasElement { return canvas; }

/** Перевод координат указателя из CSS-пикселей в логические. */
export function toLogical(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  return {
    x: ((clientX - rect.left) * dpr) / scale,
    y: ((clientY - rect.top) * dpr) / scale,
  };
}
