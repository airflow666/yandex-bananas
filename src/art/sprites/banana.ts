/**
 * Банан — главный объект игры, поэтому нарисован подробнее всего.
 *
 * Форма собрана из двух дуг: внешняя (спинка) и внутренняя (брюшко). Именно
 * разная кривизна этих дуг делает силуэт бананом, а не полумесяцем: спинка
 * круче, брюшко почти прямое, кончики сходятся в точку. Дальше поверх идут
 * три вещи, которых не хватало прямоугольникам из концепта A:
 *
 * 1. Грань. У банана плоские фасетки, а не круглое сечение — светлая полоса
 *    вдоль спинки читается как ребро и сразу даёт объём.
 * 2. Черенок и цветоложе. Тёмные кончики с двух сторон — то, по чему банан
 *    опознаётся мгновенно даже в силуэте размером 20 px.
 * 3. Пятна спелости. Ломают заливку и делают связку живой, а не штампованной.
 *
 * Три варианта спелости работают и как геймплейный сигнал: идеальная посадка
 * кладёт «золотой» банан, обычная — спелый.
 */

import { C } from '../theme';
import type { SpriteDef } from '../svgRaster';

export type Ripeness = 'fresh' | 'ripe' | 'golden';

const W = 100;
const H = 52;

/**
 * Силуэт: спинка сверху, брюшко снизу, кончики сходятся в точку.
 *
 * Две величины, на которых держится узнаваемость и которые пришлось
 * подбирать по кадру:
 *  - ТОЛЩИНА в середине 20 из 52 (38%). Первая версия была вдвое тоньше, и
 *    связка читалась как грабли.
 *  - ПОДЪЁМ дуги 33 из 52 (63%): расстояние от кончиков до спинки. Вторая
 *    версия была мясистой, но пологой, и бананы читались как сосиски.
 *    Банан опознаётся именно по кривизне, а не по цвету.
 */
const BODY =
  'M7,34 C8,12 27,3 50,3 C73,3 92,12 93,34 ' +
  'C94.5,38 91,42 87,39.5 ' +
  'C85,27 70,23 50,23 C30,23 15,27 13,39.5 ' +
  'C9,42 5.5,38 7,34 Z';

/** Светлая грань вдоль спинки — та самая фасетка, дающая объём. */
const FACET =
  'M15,31 C17,13 31,7 50,7 C69,7 83,13 85,31 ' +
  'C82,17 68,11.5 50,11.5 C32,11.5 18,17 15,31 Z';

interface Palette {
  light: string;
  mid: string;
  deep: string;
  shadow: string;
  facet: string;
}

const PALETTES: Record<Ripeness, Palette> = {
  fresh: {
    light: C.bananaLight,
    mid: C.banana,
    deep: C.bananaDeep,
    shadow: C.bananaShadow,
    facet: C.bananaPale,
  },
  ripe: {
    light: C.banana,
    mid: C.bananaDeep,
    deep: C.bananaShadow,
    shadow: '#7d4a09',
    facet: C.bananaLight,
  },
  golden: {
    light: '#fffbe8',
    mid: C.bananaLight,
    deep: C.banana,
    shadow: C.bananaDeep,
    facet: '#ffffff',
  },
};

/** Пятна спелости. Позиции зафиксированы: случайность здесь дала бы мельтешение. */
const SPOTS: Record<Ripeness, string> = {
  fresh: '',
  ripe:
    `<ellipse cx="38" cy="15" rx="5.5" ry="2.8" fill="${C.ripeSpot}" opacity="0.5"/>` +
    `<ellipse cx="63" cy="17" rx="4" ry="2.1" fill="${C.ripeSpot}" opacity="0.42"/>` +
    `<ellipse cx="26" cy="24" rx="3" ry="1.7" fill="${C.ripeSpot}" opacity="0.32"/>` +
    `<ellipse cx="74" cy="26" rx="2.6" ry="1.5" fill="${C.ripeSpot}" opacity="0.28"/>`,
  golden: '',
};

function markup(ripeness: Ripeness): (id: string) => string {
  const p = PALETTES[ripeness];
  return (id) => `
<defs>
  <linearGradient id="${id}body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${p.light}"/>
    <stop offset="0.45" stop-color="${p.mid}"/>
    <stop offset="1" stop-color="${p.deep}"/>
  </linearGradient>
  <linearGradient id="${id}facet" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${p.facet}" stop-opacity="0.95"/>
    <stop offset="1" stop-color="${p.facet}" stop-opacity="0.1"/>
  </linearGradient>
</defs>
<!-- Тень под брюшком: банан лежит, а не парит. -->
<path d="${BODY}" fill="${p.shadow}" opacity="0.45" transform="translate(0,3.5)"/>
<path d="${BODY}" fill="url(#${id}body)"/>
<!-- Нижняя кромка: контакт с бананом ниже по стопке. -->
<path d="M13,39.5 C16,33 30,30 50,30 C70,30 84,33 87,39.5
         C84,35.5 70,33 50,33 C30,33 16,35.5 13,39.5 Z"
      fill="${p.shadow}" opacity="0.4"/>
<path d="${FACET}" fill="url(#${id}facet)"/>
${SPOTS[ripeness]}
<!-- Черенок слева: короткий, с изломом. -->
<path d="M10,36 C5.5,35 2,30 3,24 C3.5,21 7,21 7.5,24 C7,29 8.8,33 12,34.5 Z"
      fill="${C.bananaTip}"/>
<path d="M4.6,24.5 C4.4,28 5.6,31 8,33" stroke="${C.barkLit}" stroke-width="1.2"
      fill="none" opacity="0.6" stroke-linecap="round"/>
<!-- Цветоложе справа: тёмная точка, узнаваемый кончик. -->
<path d="M90,36 C94,35.5 96.5,38.5 95.5,41.5 C94.4,44 91,43.4 90,41 Z"
      fill="${C.bananaTip}"/>
<!-- Блик по спинке — последний штрих, читается даже в мелком размере. -->
<path d="M24,23 C31,14.5 39,11.5 50,11.5" stroke="${p.facet}" stroke-width="3"
      fill="none" opacity="0.8" stroke-linecap="round"/>`;
}

export function bananaSprite(ripeness: Ripeness): SpriteDef {
  return { w: W, h: H, nominalW: 110, markup: markup(ripeness) };
}

export const BANANA_KEYS: Record<Ripeness, string> = {
  fresh: 'banana-fresh',
  ripe: 'banana-ripe',
  golden: 'banana-golden',
};

/**
 * Лиановая перевязка связки. Рисуется поверх бананов по центру блока и
 * объясняет, почему бананы держатся вместе, — без неё стопка выглядит
 * случайной кучей.
 */
export function bindingSprite(): SpriteDef {
  return {
    w: 44,
    h: 40,
    nominalW: 36,
    markup: (id) => `
<defs>
  <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.canopyDeep}"/>
    <stop offset="0.4" stop-color="${C.jungle}"/>
    <stop offset="1" stop-color="${C.canopyMid}"/>
  </linearGradient>
</defs>
<path d="M10,2 C6,12 6,28 10,38 L34,38 C30,28 30,12 34,2 Z" fill="url(#${id}v)"/>
<path d="M13,4 C9.5,13 9.5,27 13,36" stroke="${C.leaf}" stroke-width="2"
      fill="none" opacity="0.5" stroke-linecap="round"/>
<path d="M31,4 C27.5,13 27.5,27 31,36" stroke="${C.abyss}" stroke-width="2"
      fill="none" opacity="0.35" stroke-linecap="round"/>
<!-- Узел: без него перевязка выглядит наклейкой. -->
<ellipse cx="22" cy="20" rx="8" ry="6" fill="${C.jungleLit}"/>
<ellipse cx="22" cy="18.4" rx="5.2" ry="3.4" fill="${C.leaf}" opacity="0.75"/>`,
  };
}

export const BINDING_KEY = 'banana-binding';
