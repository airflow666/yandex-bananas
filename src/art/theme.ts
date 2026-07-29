/**
 * Единая арт-дирекция: палитра, типографика, метрики.
 *
 * Правило проекта — ни одного стороннего ассета, всё рисуется кодом. Поэтому
 * «тема» здесь не набор картинок, а набор чисел и цветов, из которых
 * собирается вся графика. Любой новый экран берёт значения отсюда и ниоткуда
 * больше — иначе через неделю палитра расползётся.
 */

/** Базовая палитра: 8 цветов, дальше только их оттенки. */
export const C = {
  /** Небо/фон — от глубокого низа к светлому верху. */
  skyDeep: '#0d2818',
  sky: '#17402a',
  skyHigh: '#2d6a4f',

  /** Бананы и акценты. */
  banana: '#ffd24a',
  bananaLight: '#ffe999',
  bananaDark: '#c98f14',

  /** Текст и UI. */
  ink: '#0b1f14',
  paper: '#eaf6ed',
  danger: '#ff6b5e',
} as const;

/** Системный стек — внешние шрифты запрещены (п. 3 CLAUDE.md). */
export const FONT_STACK =
  '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export function font(size: number, weight: 'normal' | 'bold' = 'bold'): string {
  return `${weight} ${Math.round(size)}px ${FONT_STACK}`;
}

/** Метрики, общие для всей графики. */
export const M = {
  /** Скругление блоков башни в долях высоты блока. */
  blockRadius: 0.18,
  /** Высота одного этажа в логических единицах. */
  floorH: 46,
  /** Стартовая ширина блока. */
  baseW: 300,
  /** Минимальная ширина, ниже которой забег заканчивается. */
  minW: 26,
  /** Толщина «подсветки» сверху блока — имитация объёма без текстур. */
  glossH: 0.28,
} as const;

/** Мягкое смешивание двух цветов — для градиентов биомов без лишних констант. */
export function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
