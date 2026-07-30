/**
 * Адаптивная раскладка.
 *
 * Прежняя схема — Scale.FIT на жёстких 960×1708 — давала на десктопе
 * пиллербокс: игровое поле занимало ~32% ширины кадра, остальное — пустая
 * заливка. Это корень сразу двух проблем: некрасиво и, главное, скриншот
 * физически не может показать 70% геймплея, чего требует п. 5.1.1.2.
 * Перекадрирование промо тут не помогает — чинить надо раскладку.
 *
 * Здесь фиксируется логическая ВЫСОТА, а ширина выводится из аспекта окна
 * с ограничителями. Фон и параллакс занимают всю ширину, игровая колонка
 * остаётся по центру и не расползается на широком экране.
 */

export const BASE_H = 1280;

/**
 * Границы логического аспекта.
 *
 * Верхняя граница — НЕ художественное решение, а защита от чёрных полей.
 * Холст всегда равен окну, а масштаб выводится из высоты, поэтому истинная
 * логическая ширина равна `окно.ширина / масштаб`. Если она превышает
 * `width`, всё правее просто не отрисовывается: при 2.4 на окне 1600×560
 * (аспект 2.86) правые 20% холста оставались чисто чёрными — замерено
 * пиксельно. Поэтому потолок поднят выше любого реального монитора,
 * включая 32:9.
 *
 * Само игровое поле при этом остаётся узким: его ширину задаёт
 * COLUMN_ASPECT (0.62 от высоты), то есть 0.62:1 — с запасом внутри
 * требования «не более 2:1». Шире колонки идёт только фон-декорация.
 */
/**
 * Нижняя граница — та же болезнь, обратная сторона. Если окно УЖЕ порога,
 * логическая ширина оказывается больше реально доступной, и всё, что
 * прижато к правому краю по `width`, уезжает за экран: на 320×800
 * (аспект 0.4) чип с бананами кончался на 565 при доступных 512.
 * Порог опущен до 0.34 — при нём игровая колонка (COLUMN_MIN_W = 420) всё
 * ещё помещается в 1280 × 0.34 = 435, то есть смысл ограничителя сохранён.
 */
const MIN_ASPECT = 0.34;
const MAX_ASPECT = 3.6;

/** Ширина игровой колонки в долях высоты — башня не должна теряться на десктопе. */
const COLUMN_ASPECT = 0.62;
const COLUMN_MIN_W = 420;

export interface Layout {
  /** Логический размер сцены. */
  width: number;
  height: number;
  /** Игровая колонка по центру: башня, кран, блоки. */
  columnWidth: number;
  columnLeft: number;
  columnRight: number;
  centerX: number;
  /** Безопасные отступы под HUD. */
  padX: number;
  padY: number;
  /** true на узких экранах — HUD компактнее, контролы крупнее. */
  isPortrait: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function computeLayout(winW: number, winH: number): Layout {
  const aspect = clamp(winW / Math.max(1, winH), MIN_ASPECT, MAX_ASPECT);
  const width = Math.round(BASE_H * aspect);
  const columnWidth = Math.max(COLUMN_MIN_W, Math.min(width, Math.round(BASE_H * COLUMN_ASPECT)));
  const centerX = width / 2;
  return {
    width,
    height: BASE_H,
    columnWidth,
    columnLeft: centerX - columnWidth / 2,
    columnRight: centerX + columnWidth / 2,
    centerX,
    padX: Math.round(clamp(width * 0.04, 16, 64)),
    padY: Math.round(BASE_H * 0.03),
    isPortrait: aspect < 0.85,
  };
}

type Listener = (layout: Layout) => void;

const listeners = new Set<Listener>();
let current: Layout = computeLayout(
  typeof window === 'undefined' ? 720 : window.innerWidth,
  typeof window === 'undefined' ? BASE_H : window.innerHeight,
);

export function getLayout(): Layout { return current; }

/** Подписка на пересчёт; сразу отдаёт текущее значение. */
export function onLayout(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function updateLayout(winW: number, winH: number): Layout {
  current = computeLayout(winW, winH);
  listeners.forEach((fn) => {
    try { fn(current); } catch (e) { console.warn('[layout] listener failed', e); }
  });
  return current;
}
