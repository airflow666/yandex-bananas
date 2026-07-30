/**
 * Пайплайн спрайтов: SVG-исходник → offscreen-canvas под реальный DPR.
 *
 * Почему именно так, а не Path2D и не PNG:
 *
 * - Исходник вектор (SVG), поэтому спрайт не «мылится» ни на retina-телефоне,
 *   ни на 4K-мониторе: он растеризуется в тот размер, в котором реально будет
 *   нарисован, и заново — если масштаб изменился (поворот экрана, перенос окна
 *   на другой монитор). Именно это требование «без потери качества на разных
 *   устройствах».
 * - Растр кэшируется на старте, а не собирается в кадре — требование CLAUDE.md
 *   (п. 4) и разница между стабильными 60 FPS и просадками.
 * - Path2D дал бы вектор без растра, но потерял бы градиенты и фильтры внутри
 *   SVG, а они здесь несут почти весь объём.
 *
 * Ни одного внешнего запроса: SVG живёт строкой в бандле, растеризуется через
 * Blob URL и сразу освобождается.
 */

export interface SpriteDef {
  /** Ширина и высота системы координат SVG (viewBox). */
  w: number;
  h: number;
  /** Логическая ширина, в которой спрайт обычно рисуется — размер растра. */
  nominalW: number;
  /** Разметка SVG без внешних ссылок. */
  markup: (id: string) => string;
}

interface Raster {
  canvas: HTMLCanvasElement;
  /** Масштаб пикселей, под который сделан растр — для инвалидации. */
  pixelScale: number;
  logicalW: number;
}

const defs = new Map<string, SpriteDef>();
const rasters = new Map<string, Raster>();
const pending = new Set<string>();

let pixelScale = 1;

/** Ограничитель растра: выше этого спрайт не даёт выигрыша, а память ест. */
const MAX_RASTER_PX = 2048;

export function registerSprite(key: string, def: SpriteDef): void {
  defs.set(key, def);
}

/**
 * Масштаб «логическая единица → физический пиксель». Приходит из core/canvas.
 * Смена (поворот экрана, другой монитор) помечает весь кэш устаревшим, но
 * СТАРЫЕ растры остаются в работе, пока не готовы новые — иначе спрайты
 * мигнули бы пустотой на кадре ресайза.
 */
export function setPixelScale(scale: number): void {
  if (Math.abs(scale - pixelScale) < 0.01) return;
  pixelScale = scale;
  for (const key of defs.keys()) void ensureRaster(key);
}

export function getPixelScale(): number { return pixelScale; }

/**
 * Готовый растр или null, если спрайт ещё не растеризован. Синхронна —
 * вызывается из кадра, поэтому никогда не ждёт и никогда не бросает.
 */
export function getSprite(key: string): HTMLCanvasElement | null {
  const r = rasters.get(key);
  if (!r) { void ensureRaster(key); return null; }
  if (Math.abs(r.pixelScale - pixelScale) > 0.01) void ensureRaster(key);
  return r.canvas;
}

/** Пропорции спрайта — чтобы вызывающий не хранил размеры отдельно. */
export function spriteAspect(key: string): number {
  const d = defs.get(key);
  return d ? d.h / d.w : 1;
}

/**
 * Растеризовать всё зарегистрированное. Вызывается один раз на старте до
 * markLoaded(): игрок не должен увидеть кадр с недостающими спрайтами.
 * Отказ отдельного спрайта не роняет загрузку — кадр просто нарисует его
 * процедурным запасным вариантом.
 */
export async function preloadSprites(scale: number): Promise<void> {
  pixelScale = scale;
  await Promise.all([...defs.keys()].map((key) => ensureRaster(key)));
}

async function ensureRaster(key: string): Promise<void> {
  if (pending.has(key)) return;
  const def = defs.get(key);
  if (!def) return;

  const wanted = pixelScale;
  const existing = rasters.get(key);
  if (existing && Math.abs(existing.pixelScale - wanted) < 0.01) return;

  pending.add(key);
  try {
    const canvas = await rasterize(def, wanted);
    // Пока шла растеризация, масштаб мог смениться снова — тогда результат
    // всё равно кладём (он лучше, чем ничего) и запускаем следующий проход.
    rasters.set(key, { canvas, pixelScale: wanted, logicalW: def.nominalW });
    pending.delete(key);
    if (Math.abs(wanted - pixelScale) > 0.01) void ensureRaster(key);
  } catch (e) {
    pending.delete(key);
    console.warn(`[sprites] failed to rasterize "${key}"`, e);
  }
}

function rasterize(def: SpriteDef, scale: number): Promise<HTMLCanvasElement> {
  const aspect = def.h / def.w;
  let pxW = Math.max(1, Math.round(def.nominalW * scale));
  let pxH = Math.max(1, Math.round(def.nominalW * aspect * scale));
  if (pxW > MAX_RASTER_PX || pxH > MAX_RASTER_PX) {
    const k = MAX_RASTER_PX / Math.max(pxW, pxH);
    pxW = Math.max(1, Math.round(pxW * k));
    pxH = Math.max(1, Math.round(pxH * k));
  }

  // Уникальный префикс id: несколько SVG рисуются в один документ через
  // Image, и одинаковые id градиентов в них конфликтовали бы.
  const id = `s${Math.random().toString(36).slice(2, 8)}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" ` +
    `viewBox="0 0 ${def.w} ${def.h}">${def.markup(id)}</svg>`;

  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = pxW;
        canvas.height = pxH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2d context unavailable');
        ctx.drawImage(img, 0, 0, pxW, pxH);
        cleanup();
        resolve(canvas);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    img.onerror = () => { cleanup(); reject(new Error('svg decode failed')); };
    img.src = url;
  });
}

/**
 * Нарисовать спрайт в произвольный прямоугольник (левый верхний угол + размер),
 * то есть с растяжением. Нужен для 3-slice: средняя секция ящика тянется по
 * ширине блока, и её пропорции обязаны нарушаться намеренно.
 */
export function drawSpriteRect(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number, y: number, w: number, h: number,
  flip = false,
): boolean {
  const sprite = getSprite(key);
  if (!sprite || w <= 0 || h <= 0) return false;
  if (!flip) {
    ctx.drawImage(sprite, x, y, w, h);
    return true;
  }
  ctx.save();
  ctx.translate(x + w / 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, -w / 2, y, w, h);
  ctx.restore();
  return true;
}

/**
 * Нарисовать спрайт по центру (cx, cy) с заданной ЛОГИЧЕСКОЙ шириной.
 * Молча ничего не делает, если растр ещё не готов: пропущенный спрайт лучше
 * упавшего кадра.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  w: number,
  opts: { rotation?: number; alpha?: number; flip?: boolean } = {},
): boolean {
  const sprite = getSprite(key);
  if (!sprite) return false;
  const h = w * spriteAspect(key);

  const { rotation = 0, alpha: a = 1, flip = false } = opts;
  const plain = rotation === 0 && a === 1 && !flip;

  if (plain) {
    ctx.drawImage(sprite, cx - w / 2, cy - h / 2, w, h);
    return true;
  }

  ctx.save();
  if (a !== 1) ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  if (rotation) ctx.rotate(rotation);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
