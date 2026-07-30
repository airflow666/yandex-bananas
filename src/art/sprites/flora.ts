/**
 * Флора: стволы, листва, лианы, цветы.
 *
 * Два принципа, на которых держится вся фоновая графика:
 *
 * 1. **Ствол тайлится вертикально.** Башня растёт бесконечно, значит и стволы
 *    по бокам должны. Поэтому боковые кромки сегмента — строго вертикальные
 *    линии на фиксированных x, а вся фактура (борозды, мох, сучки) живёт
 *    внутри и не пересекает границы y=0 и y=H. Стык двух сегментов не виден
 *    в принципе, а не «почти не виден».
 * 2. **Цилиндрическая растушёвка вместо контура.** Ствол круглый не потому,
 *    что обведён, а потому что поперёк него идёт градиент тень→свет→тень.
 *    Это же правило работает для лиан и стеблей.
 *
 * Листья собраны из отдельных сегментов, а не вырезаны дырами в цельной
 * пластине: у настоящей монстеры лист именно рассечён до жилки, и сегментами
 * это и дешевле, и точнее.
 */

import { C } from '../theme';
import type { SpriteDef } from '../svgRaster';

// ---------------------------------------------------------------- ствол

const TRUNK_W = 200;
const TRUNK_H = 400;
/** Кромки ствола — на этих x силуэт обязан совпадать сверху и снизу. */
const TRUNK_L = 34;
const TRUNK_R = 166;

/**
 * Борозды коры. Каждая борозда — ПАРА штрихов: тёмный (углубление) и
 * светлый рядом (освещённое ребро). Одиночная тёмная линия выглядит
 * царапиной; пара сразу читается как рельеф.
 *
 * Начало и конец на одном x, поэтому борозда сходится на стыке тайлов.
 */
function barkGrooves(): string {
  const out: string[] = [];
  const xs = [46, 60, 74, 88, 104, 118, 132, 146, 158];
  xs.forEach((x, i) => {
    const bow = (i % 2 === 0 ? 6 : -5) + (i % 3) * 2;
    const d =
      `M${x},0 C${x + bow},100 ${x - bow},200 ${x},300 ` +
      `C${x + bow * 0.6},350 ${x},380 ${x},400`;
    out.push(
      `<path d="${d}" stroke="${C.barkDeep}" stroke-width="${2.5 + (i % 3)}" ` +
        `fill="none" opacity="${0.32 + (i % 3) * 0.1}"/>`,
      `<path d="${d}" stroke="#8a6140" stroke-width="1.6" fill="none" ` +
        `opacity="0.3" transform="translate(2.5,0)"/>`,
    );
  });
  return out.join('');
}

/**
 * Мох. Растёт ТОЛЬКО вдоль кромок ствола, а не пятнами по середине: в
 * природе он держится на затенённой стороне, и по краю он же выполняет
 * работу контура — отделяет ствол от фона, не рисуя обводки.
 */
function moss(): string {
  return `
<path d="M34,50 C48,46 56,66 52,92 C49,116 38,126 34,122 Z" fill="${C.canopyMid}" opacity="0.5"/>
<path d="M34,58 C44,56 50,72 47,90" stroke="${C.jungle}" stroke-width="3"
      fill="none" opacity="0.45"/>
<path d="M34,242 C46,240 54,258 50,280 C47,298 38,306 34,302 Z"
      fill="${C.canopyDeep}" opacity="0.55"/>
<path d="M166,140 C154,138 147,158 151,182 C154,202 162,208 166,204 Z"
      fill="${C.canopyDeep}" opacity="0.5"/>
<path d="M166,316 C156,314 149,330 152,348 C155,364 162,368 166,364 Z"
      fill="${C.canopyMid}" opacity="0.38"/>`;
}

/**
 * Сучок — след отломанной ветви. Светлый ободок сверху обязателен: без него
 * тёмное пятно читается не как выпуклость, а как дыра в стволе, и ствол
 * превращается в решето с глазами.
 */
function knot(cx: number, cy: number): string {
  return `
<ellipse cx="${cx}" cy="${cy + 1.5}" rx="18" ry="12" fill="${C.barkDeep}" opacity="0.4"/>
<ellipse cx="${cx}" cy="${cy}" rx="17" ry="11" fill="${C.barkLit}" opacity="0.55"/>
<ellipse cx="${cx}" cy="${cy}" rx="11" ry="6.6" fill="${C.bark}"/>
<ellipse cx="${cx}" cy="${cy + 0.6}" rx="5" ry="3" fill="${C.barkDeep}" opacity="0.85"/>
<path d="M${cx - 14},${cy - 4} C${cx - 8},${cy - 10} ${cx + 8},${cy - 10} ${cx + 14},${cy - 4}"
      stroke="#9a7050" stroke-width="2" fill="none" opacity="0.6"/>`;
}

export function trunkSprite(): SpriteDef {
  return {
    w: TRUNK_W,
    h: TRUNK_H,
    nominalW: 260,
    markup: (id) => `
<defs>
  <linearGradient id="${id}bark" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.barkDeep}"/>
    <stop offset="0.18" stop-color="${C.bark}"/>
    <stop offset="0.42" stop-color="${C.barkLit}"/>
    <stop offset="0.72" stop-color="${C.bark}"/>
    <stop offset="1" stop-color="${C.barkDeep}"/>
  </linearGradient>
</defs>
<rect x="${TRUNK_L}" y="0" width="${TRUNK_R - TRUNK_L}" height="${TRUNK_H}" fill="url(#${id}bark)"/>
${barkGrooves()}
${knot(118, 92)}
${knot(76, 286)}
${moss()}
<!-- Блик по освещённой кромке: отделяет ствол от фона на тёмном биоме. -->
<rect x="${TRUNK_L + 8}" y="0" width="7" height="${TRUNK_H}" fill="${C.barkLit}" opacity="0.28"/>`,
  };
}

export const TRUNK_KEY = 'trunk';

// ---------------------------------------------------------------- листва

/**
 * Перистый лист (пальма/папоротник): рахис с сегментами по обе стороны.
 * Длина сегментов идёт по синусу — максимум в середине, сход на нет к концу.
 * Это то, что отличает лист от расчёски.
 */
function pinnateLeaf(fill: string, vein: string, count = 15): string {
  const out: string[] = [];
  // Рахис — квадратичная кривая; сегменты сажаем на её выборку.
  const p0 = { x: 14, y: 132 };
  const p1 = { x: 150, y: 8 };
  const p2 = { x: 306, y: 62 };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
    y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
  });

  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const p = at(t);
    const next = at(Math.min(1, t + 0.02));
    // Нормаль к рахису — сегменты растут перпендикулярно, как в природе.
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const size = Math.sin(t * Math.PI) * 62 + 12;
    const sweep = 0.45; // отгиб сегмента назад, к основанию

    for (const side of [1, -1]) {
      const tipX = p.x + nx * size * side - dx * (size / len) * sweep;
      const tipY = p.y + ny * size * side - dy * (size / len) * sweep;
      const midX = p.x + nx * size * 0.55 * side;
      const midY = p.y + ny * size * 0.55 * side;
      out.push(
        `<path d="M${p.x.toFixed(1)},${p.y.toFixed(1)} ` +
          `Q${(midX + dx * 2).toFixed(1)},${(midY + dy * 2).toFixed(1)} ` +
          `${tipX.toFixed(1)},${tipY.toFixed(1)} ` +
          `Q${(midX - dx * 1.5).toFixed(1)},${(midY - dy * 1.5).toFixed(1)} ` +
          `${p.x.toFixed(1)},${p.y.toFixed(1)} Z" fill="${fill}"/>`,
      );
    }
  }
  out.push(
    `<path d="M${p0.x},${p0.y} Q${p1.x},${p1.y} ${p2.x},${p2.y}" stroke="${vein}" ` +
      `stroke-width="6" fill="none" stroke-linecap="round"/>`,
  );
  return out.join('');
}

export function palmFrondSprite(): SpriteDef {
  return {
    w: 320,
    h: 150,
    nominalW: 420,
    markup: (id) => `
<defs>
  <linearGradient id="${id}l" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="${C.jungleLit}"/>
    <stop offset="1" stop-color="${C.canopyMid}"/>
  </linearGradient>
</defs>
${pinnateLeaf(`url(#${id}l)`, C.canopyDeep)}`,
  };
}

/**
 * Монстера: пластина рассечена до жилки на сегменты, у основания —
 * характерные отверстия. Самый узнаваемый лист джунглей, поэтому именно он
 * стоит на переднем плане и кадрирует сцену.
 */
export function monsteraSprite(): SpriteDef {
  const segs: string[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const y = 20 + t * 150;
    const reach = Math.sin(t * Math.PI) * 110 + 30;
    const droop = t * 26;
    for (const side of [1, -1]) {
      const tipY = y + droop + side * 6;
      segs.push(
        `<path d="M40,${y.toFixed(0)} ` +
          `C${(40 + reach * 0.5).toFixed(0)},${(y - 16 * side).toFixed(0)} ` +
          `${(40 + reach * 0.85).toFixed(0)},${(tipY - 10 * side).toFixed(0)} ` +
          `${(40 + reach).toFixed(0)},${tipY.toFixed(0)} ` +
          `C${(40 + reach * 0.8).toFixed(0)},${(tipY + 14).toFixed(0)} ` +
          `${(40 + reach * 0.4).toFixed(0)},${(y + 20).toFixed(0)} ` +
          `40,${(y + 16).toFixed(0)} Z" fill="url(#GRAD)"/>`,
      );
    }
  }
  const body = segs.join('');
  return {
    w: 320,
    h: 210,
    nominalW: 460,
    markup: (id) => `
<defs>
  <linearGradient id="${id}m" x1="0" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="${C.jungle}"/>
    <stop offset="0.55" stop-color="${C.canopyMid}"/>
    <stop offset="1" stop-color="${C.canopyDeep}"/>
  </linearGradient>
</defs>
<path d="M8,196 C20,150 30,90 38,30" stroke="${C.canopyDeep}" stroke-width="9"
      fill="none" stroke-linecap="round"/>
${body.replace(/url\(#GRAD\)/g, `url(#${id}m)`)}
<path d="M40,22 C42,80 42,140 44,196" stroke="${C.jungleLit}" stroke-width="4"
      fill="none" opacity="0.5" stroke-linecap="round"/>`,
  };
}

/** Бромелия — розетка на стволе. Дешёвый способ «обжить» кору. */
export function bromeliadSprite(): SpriteDef {
  const blades: string[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = 44 + (i % 3) * 8;
    const x = 60 + Math.cos(a) * len;
    const y = 52 + Math.sin(a) * len * 0.62;
    const cx = 60 + Math.cos(a + 0.3) * len * 0.55;
    const cy = 52 + Math.sin(a + 0.3) * len * 0.4;
    blades.push(
      `<path d="M60,52 Q${cx.toFixed(0)},${cy.toFixed(0)} ${x.toFixed(0)},${y.toFixed(0)} ` +
        `Q${(cx - 6).toFixed(0)},${(cy + 8).toFixed(0)} 60,52 Z" ` +
        `fill="${i % 2 ? C.jungle : C.jungleLit}" opacity="${0.75 + (i % 2) * 0.2}"/>`,
    );
  }
  return {
    w: 120,
    h: 110,
    nominalW: 92,
    markup: () => `
${blades.join('')}
<ellipse cx="60" cy="52" rx="15" ry="11" fill="${C.flower}"/>
<ellipse cx="60" cy="50" rx="8" ry="5.5" fill="${C.gold}" opacity="0.85"/>`,
  };
}

/** Гибискус: третичный акцент. Меньше 2% площади кадра — и зелень оживает. */
export function flowerSprite(): SpriteDef {
  const petals: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    petals.push(
      `<ellipse cx="${(50 + Math.cos(a) * 22).toFixed(1)}" ` +
        `cy="${(50 + Math.sin(a) * 22).toFixed(1)}" rx="19" ry="15" ` +
        `transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ` +
        `${(50 + Math.cos(a) * 22).toFixed(1)} ${(50 + Math.sin(a) * 22).toFixed(1)})" ` +
        `fill="url(#GRAD)"/>`,
    );
  }
  return {
    w: 100,
    h: 100,
    nominalW: 54,
    markup: (id) => `
<defs>
  <radialGradient id="${id}f" cx="0.5" cy="0.5" r="0.7">
    <stop offset="0" stop-color="${C.gold}"/>
    <stop offset="0.45" stop-color="${C.flower}"/>
    <stop offset="1" stop-color="${C.flowerAlt}"/>
  </radialGradient>
</defs>
${petals.join('').replace(/url\(#GRAD\)/g, `url(#${id}f)`)}
<circle cx="50" cy="50" r="10" fill="${C.gold}"/>
<circle cx="50" cy="50" r="5" fill="${C.paper}" opacity="0.8"/>`,
  };
}

/** Листок лианы — парой сажается вдоль троса, по которому висит связка. */
export function vineLeafSprite(): SpriteDef {
  return {
    w: 80,
    h: 60,
    nominalW: 34,
    markup: (id) => `
<defs>
  <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.leaf}"/>
    <stop offset="1" stop-color="${C.canopyMid}"/>
  </linearGradient>
</defs>
<path d="M6,30 C6,10 30,2 50,6 C70,10 78,26 74,40 C70,54 46,58 28,50 C14,44 6,38 6,30 Z"
      fill="url(#${id}v)"/>
<path d="M8,31 C28,30 54,26 74,38" stroke="${C.canopyDeep}" stroke-width="2.6"
      fill="none" opacity="0.55" stroke-linecap="round"/>`,
  };
}

/**
 * Крона дальнего плана — мягкий силуэт из перекрывающихся окружностей.
 * Рисуется одним тоном: на дальнем плане детали не нужны, нужна форма и
 * воздушная перспектива (цвет ей задаёт биом при отрисовке).
 */
export function canopyBlobSprite(): SpriteDef {
  return {
    w: 400,
    h: 220,
    nominalW: 520,
    markup: () => `
<g fill="#ffffff">
  <ellipse cx="80" cy="150" rx="82" ry="66"/>
  <ellipse cx="170" cy="112" rx="96" ry="82"/>
  <ellipse cx="272" cy="138" rx="88" ry="70"/>
  <ellipse cx="348" cy="164" rx="66" ry="54"/>
  <ellipse cx="220" cy="76" rx="62" ry="48"/>
  <rect x="0" y="150" width="400" height="70"/>
</g>`,
  };
}

export const FLORA_KEYS = {
  palm: 'frond-palm',
  monstera: 'frond-monstera',
  bromeliad: 'bromeliad',
  flower: 'flower',
  vineLeaf: 'vine-leaf',
  canopy: 'canopy-blob',
} as const;
