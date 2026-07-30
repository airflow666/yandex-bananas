/**
 * Обезьяны на боковых стволах — «зрители» башни.
 *
 * Задача у них не декоративная, а драматургическая: они реагируют на игру и
 * тем самым озвучивают её без единой строки текста. Идеальная посадка —
 * ликуют, обрушение — закрывают глаза, обычный подъём — карабкаются следом.
 * Игрок получает обратную связь боковым зрением, не отрывая взгляд от
 * верхушки башни.
 *
 * Конечности намеренно сделаны толстыми скруглёнными штрихами, а не
 * заливками: силуэт остаётся читаемым на 60 px по высоте (мобильный экран),
 * а поз получается четыре ценой пары путей на позу.
 */

import { C } from '../theme';
import type { SpriteDef } from '../svgRaster';

export type Pose = 'hang' | 'climb' | 'cheer' | 'scared';

const W = 120;
const H = 140;

/** Голова, уши, морда и глаза — общие для всех поз, меняются только глаза и рот. */
function head(id: string, face: 'calm' | 'happy' | 'shut'): string {
  const eyes =
    face === 'shut'
      ? `<path d="M48,40 C51,37 56,37 59,40" stroke="${C.furDark}" stroke-width="2.6"
           fill="none" stroke-linecap="round"/>
         <path d="M67,40 C70,37 75,37 78,40" stroke="${C.furDark}" stroke-width="2.6"
           fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="53" cy="40" rx="4.6" ry="5.2" fill="${C.furDark}"/>
         <ellipse cx="72" cy="40" rx="4.6" ry="5.2" fill="${C.furDark}"/>
         <circle cx="54.8" cy="38.2" r="1.7" fill="${C.paper}" opacity="0.9"/>
         <circle cx="73.8" cy="38.2" r="1.7" fill="${C.paper}" opacity="0.9"/>`;

  const mouth =
    face === 'happy'
      ? `<path d="M55,54 C60,61 66,61 71,54 Z" fill="${C.furDark}"/>
         <path d="M58.5,57.5 C61,60 65,60 67.5,57.5" fill="${C.flower}" opacity="0.75"/>`
      : `<path d="M56,54 C60,58 66,58 70,54" stroke="${C.furDark}" stroke-width="2.4"
           fill="none" stroke-linecap="round"/>`;

  return `
<!-- Уши: круги за головой, дают силуэту узнаваемость. -->
<circle cx="34" cy="34" r="12" fill="${C.fur}"/>
<circle cx="34" cy="34" r="6.5" fill="${C.furFace}" opacity="0.8"/>
<circle cx="86" cy="34" r="12" fill="${C.fur}"/>
<circle cx="86" cy="34" r="6.5" fill="${C.furFace}" opacity="0.8"/>
<circle cx="60" cy="38" r="27" fill="url(#${id}fur)"/>
<!-- Лицевой диск: светлое «сердце», как у капуцинов. -->
<path d="M60,16 C76,16 84,28 84,40 C84,54 73,63 60,63 C47,63 36,54 36,40 C36,28 44,16 60,16 Z"
      fill="${C.furFace}"/>
<ellipse cx="60" cy="50" rx="13" ry="10" fill="${C.furLight}" opacity="0.45"/>
${eyes}
<ellipse cx="60" cy="48.5" rx="3.4" ry="2.4" fill="${C.furDark}" opacity="0.8"/>
${mouth}`;
}

/** Хвост — крючком, всегда виден за телом: без него силуэт не «обезьяний». */
function tail(d: string): string {
  return `<path d="${d}" stroke="${C.fur}" stroke-width="9" fill="none"
    stroke-linecap="round"/>`;
}

function body(id: string): string {
  return `
<ellipse cx="60" cy="92" rx="26" ry="30" fill="url(#${id}fur)"/>
<ellipse cx="60" cy="97" rx="16" ry="20" fill="${C.furFace}" opacity="0.55"/>`;
}

const LIMB = (d: string, w = 11) =>
  `<path d="${d}" stroke="${C.fur}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;

const POSES: Record<Pose, (id: string) => string> = {
  // Висит на лиане: одна рука вверх, тело чуть отклонено, ноги свободны.
  hang: (id) => `
${tail('M84,104 C104,104 112,88 104,76 C99,69 90,72 92,80')}
${LIMB('M44,78 C30,72 24,54 30,36', 11)}
${LIMB('M78,80 C90,90 92,104 86,114', 11)}
${body(id)}
${LIMB('M50,114 C46,126 50,132 58,133', 12)}
${LIMB('M72,114 C78,124 76,132 68,134', 12)}
${head(id, 'calm')}`,

  // Карабкается: руки разведены по стволу, ноги подобраны.
  climb: (id) => `
${tail('M86,100 C106,98 110,80 100,72 C94,67 87,72 90,79')}
${LIMB('M42,80 C28,74 22,60 26,46', 11)}
${LIMB('M80,78 C94,72 100,58 96,44', 11)}
${body(id)}
${LIMB('M48,112 C38,120 36,130 44,134', 12)}
${LIMB('M74,112 C84,120 86,130 78,134', 12)}
${head(id, 'calm')}`,

  // Ликует: обе руки вверх, рот открыт, хвост торчком.
  cheer: (id) => `
${tail('M88,96 C108,90 114,70 104,60 C98,54 90,58 93,66')}
${LIMB('M42,80 C26,70 20,48 26,28', 11)}
${LIMB('M80,80 C96,70 102,48 96,28', 11)}
${body(id)}
${LIMB('M48,114 C40,126 44,133 52,134', 12)}
${LIMB('M74,114 C82,126 78,133 70,134', 12)}
${head(id, 'happy')}`,

  // Закрывает глаза лапами — реакция на обрушение башни.
  scared: (id) => `
${tail('M84,106 C100,110 108,100 104,90 C101,84 94,86 96,92')}
${body(id)}
${head(id, 'shut')}
${LIMB('M40,60 C42,44 50,36 58,34', 11)}
${LIMB('M82,60 C80,44 72,36 64,34', 11)}
${LIMB('M50,114 C46,126 50,132 58,133', 12)}
${LIMB('M72,114 C78,124 76,132 68,134', 12)}`,
};

export function monkeySprite(pose: Pose): SpriteDef {
  return {
    w: W,
    h: H,
    nominalW: 96,
    markup: (id) => `
<defs>
  <radialGradient id="${id}fur" cx="0.38" cy="0.3" r="0.85">
    <stop offset="0" stop-color="${C.furLight}"/>
    <stop offset="0.55" stop-color="${C.fur}"/>
    <stop offset="1" stop-color="${C.furDark}"/>
  </radialGradient>
</defs>
${POSES[pose](id)}`,
  };
}

export const MONKEY_KEYS: Record<Pose, string> = {
  hang: 'monkey-hang',
  climb: 'monkey-climb',
  cheer: 'monkey-cheer',
  scared: 'monkey-scared',
};
