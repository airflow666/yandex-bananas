/**
 * Ящик с бананами — этаж башни.
 *
 * Почему ящик, а не связка бананов: стопка голых бананов не читается как
 * конструкция. Ящики штабелируются в реальности, поэтому глаз принимает
 * башню из них без вопросов, а бананы остаются видны сверху — сеттинг никуда
 * не делся, просто перестал спорить с силуэтом.
 *
 * Ящик собирается ТРЁХСЛОЙНО (3-slice), а не растягивается целиком:
 *
 *   [торец] [--- доски, растягиваются ---] [торец]
 *
 * Торцы фиксированной ширины, поэтому угловые стойки и обвязка лианой не
 * искажаются при любой ширине блока. Средняя часть — горизонтальные доски,
 * а их растягивать по горизонтали можно без последствий: волокно идёт вдоль
 * растяжения. Это тот случай, когда 3-slice не оптимизация, а единственный
 * способ не получить «резиновую» графику на узких блоках.
 */

import { C } from '../theme';
import type { SpriteDef } from '../svgRaster';

const H = 56;

export type CrateVariant = 'plain' | 'perfect';

/** Обвязка: у идеально поставленного ящика она золотая, а не зелёная. */
function lashing(v: CrateVariant): string {
  return v === 'perfect' ? C.gold : C.jungle;
}
function lashingDark(v: CrateVariant): string {
  return v === 'perfect' ? C.bananaDeep : C.canopyDeep;
}

/**
 * Средняя секция: верхний борт, две доски, нижняя тень. Растягивается по
 * горизонтали.
 *
 * Досок именно две, а не три: на экране ящик высотой ~35 px, и три доски с
 * зазорами превращались в кашу — стопка читалась сплошной бревенчатой
 * стеной без границ между этажами. Границу теперь держат две вещи: светлый
 * БОРТ по верхней кромке и тёмная ТЕНЬ по нижней. Между двумя соседними
 * ящиками получается пара «тень + свет», и глаз разделяет их безошибочно.
 */
export function crateMidSprite(v: CrateVariant): SpriteDef {
  const plank = (y: number, h: number, id: string) => `
<rect x="0" y="${y}" width="80" height="${h}" fill="url(#${id}wood)"/>
<rect x="0" y="${y}" width="80" height="1.6" fill="${C.barkLit}" opacity="0.5"/>
<rect x="0" y="${y + h - 2}" width="80" height="2" fill="${C.barkDeep}" opacity="0.65"/>
<path d="M0,${y + h * 0.45} C22,${y + h * 0.36} 48,${y + h * 0.54} 80,${y + h * 0.43}"
      stroke="${C.barkDeep}" stroke-width="1.3" fill="none" opacity="0.3"/>`;

  return {
    w: 80,
    h: H,
    nominalW: 80,
    markup: (id) => `
<defs>
  <linearGradient id="${id}wood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.barkLit}"/>
    <stop offset="0.45" stop-color="${C.bark}"/>
    <stop offset="1" stop-color="${C.barkDeep}"/>
  </linearGradient>
  <linearGradient id="${id}rim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a6140"/>
    <stop offset="1" stop-color="${C.bark}"/>
  </linearGradient>
</defs>
<!-- Нутро ящика: видно в зазорах между досками. -->
<rect x="0" y="0" width="80" height="${H}" fill="${C.abyss}" opacity="0.9"/>
<!-- Верхний борт: самая светлая горизонталь во всём ящике. -->
<rect x="0" y="0" width="80" height="11" fill="url(#${id}rim)"/>
<rect x="0" y="0" width="80" height="2.4" fill="${C.bananaPale}" opacity="0.32"/>
<rect x="0" y="10" width="80" height="2" fill="${C.barkDeep}" opacity="0.7"/>
${plank(14, 17, id)}
${plank(33, 17, id)}
<!-- Нижняя тень: пара «тень + борт» разделяет соседние ящики. -->
<rect x="0" y="51" width="80" height="5" fill="${C.abyss}" opacity="0.75"/>`,
  };
}

/**
 * Торец: угловая стойка с вертикальным волокном и двумя витками лианы.
 * Рисуется слева; справа тот же спрайт отражается.
 */
export function crateEndSprite(v: CrateVariant): SpriteDef {
  return {
    w: 44,
    h: H,
    nominalW: 44,
    markup: (id) => `
<defs>
  <linearGradient id="${id}post" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.barkDeep}"/>
    <stop offset="0.35" stop-color="${C.bark}"/>
    <stop offset="0.72" stop-color="${C.barkLit}"/>
    <stop offset="1" stop-color="${C.bark}"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="44" height="${H}" fill="${C.abyss}" opacity="0.9"/>
<rect x="2" y="0" width="40" height="${H}" fill="url(#${id}post)"/>
<!-- Вертикальное волокно: торец отличается от досок направлением текстуры. -->
<path d="M12,12 C10,24 14,38 12,50" stroke="${C.barkDeep}" stroke-width="1.6"
      fill="none" opacity="0.4"/>
<path d="M28,12 C30,26 26,40 28,50" stroke="${C.barkDeep}" stroke-width="1.4"
      fill="none" opacity="0.32"/>
<path d="M35,12 C34,26 36,40 35,50" stroke="${C.barkLit}" stroke-width="1.2"
      fill="none" opacity="0.3"/>
<!-- Верхний борт: продолжает борт средней секции без стыка. -->
<rect x="0" y="0" width="44" height="11" fill="#8a6140"/>
<rect x="0" y="0" width="44" height="2.4" fill="${C.bananaPale}" opacity="0.32"/>
<rect x="0" y="10" width="44" height="2" fill="${C.barkDeep}" opacity="0.7"/>
<!-- Обвязка лианой вместо гвоздей: ящик собран в джунглях. -->
<rect x="0" y="20" width="44" height="9" fill="${lashingDark(v)}"/>
<rect x="0" y="21" width="44" height="6" fill="${lashing(v)}"/>
<rect x="0" y="39" width="44" height="8" fill="${lashingDark(v)}"/>
<rect x="0" y="40" width="44" height="5" fill="${lashing(v)}"/>
<!-- Узел на стойке — точка, за которую взгляд цепляется. -->
<ellipse cx="22" cy="24.5" rx="7" ry="5" fill="${lashing(v)}"/>
<ellipse cx="22" cy="23.5" rx="4.2" ry="2.6" fill="${C.leaf}"
         opacity="${v === 'perfect' ? 0 : 0.6}"/>
<!-- Нижняя тень: совпадает со средней секцией. -->
<rect x="0" y="51" width="44" height="5" fill="${C.abyss}" opacity="0.75"/>
<!-- Тень на внутренней кромке: торец объёмный, а не наклеенный. -->
<rect x="40" y="0" width="4" height="${H}" fill="${C.abyss}" opacity="0.3"/>`,
  };
}

export const CRATE_KEYS = {
  midPlain: 'crate-mid-plain',
  midPerfect: 'crate-mid-perfect',
  endPlain: 'crate-end-plain',
  endPerfect: 'crate-end-perfect',
} as const;
