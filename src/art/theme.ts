/**
 * Единая арт-дирекция: палитра, биомы, типографика, метрики.
 *
 * Правило проекта — ни одного стороннего ассета, всё рисуется кодом. Поэтому
 * «тема» здесь не набор картинок, а набор чисел и цветов, из которых
 * собирается вся графика. Любой новый экран берёт значения отсюда и ниоткуда
 * больше — иначе через неделю палитра расползётся.
 *
 * Ключевая идея дирекции: КОНТРАСТ ТЕМПЕРАТУР. Джунгли held в холодных
 * сине-зелёных, бананы — единственное тёплое пятно в кадре. Поэтому башня
 * читается как фокус на любом фоне, и её не нужно обводить и подсвечивать.
 * Третичный акцент (коралловые цветы) занимает <2% площади и существует
 * только чтобы зелень не выглядела монохромной.
 */

/** Базовая палитра. Всё остальное — её оттенки через mix()/alpha(). */
export const C = {
  /** Зелень джунглей: от самой глубокой тени к освещённому листу. */
  abyss: '#04160f',
  canopyDeep: '#0a2a1d',
  canopyMid: '#12452e',
  jungle: '#1d6b45',
  jungleLit: '#2f9159',
  leaf: '#4fba72',
  leafBright: '#8ad98b',

  /** Кора и древесина — тёплая, но приглушённая, чтобы не спорить с бананами. */
  barkDeep: '#2b1c12',
  bark: '#4a3121',
  barkLit: '#6d4a2f',

  /** Бананы: единственное по-настоящему тёплое пятно в кадре. */
  banana: '#ffc93c',
  bananaLight: '#ffe57e',
  bananaPale: '#fff3c2',
  bananaDeep: '#e09a18',
  bananaShadow: '#a2600d',
  bananaTip: '#5c3b12',
  ripeSpot: '#c97a1e',

  /** Шерсть обезьян. */
  fur: '#8c5a34',
  furDark: '#5d3720',
  furLight: '#c99263',
  furFace: '#e8c9a0',

  /** Третичный акцент — тропические цветы. */
  flower: '#ff6b6b',
  flowerAlt: '#e5559b',

  /** Текст и UI. */
  ink: '#04160f',
  paper: '#f3fbf2',
  paperDim: '#c3d8c8',
  danger: '#ff6b5e',
  gold: '#ffd45e',
} as const;

/**
 * Биом — это не только фон, а полный пресет освещения: небо, туман, тон
 * листвы и цвет солнечных лучей. Меняя его с высотой, мы получаем ощущение
 * подъёма из тени подлеска в открытое небо и дальше в ночь, не рисуя ни
 * одного нового объекта.
 */
export interface Biome {
  key: string;
  /** С какого этажа биом становится основным. */
  from: number;
  /** Небо: верх кадра → низ кадра. */
  skyTop: string;
  skyBottom: string;
  /** Дымка на горизонте — то, что даёт воздушную перспективу. */
  haze: string;
  /** Тон, в который уводится дальняя листва (воздушная перспектива). */
  distant: string;
  /** Цвет солнечных лучей и бликов. */
  light: string;
  /** Сколько света в биоме, 0..1 — управляет силой лучей и контрастом. */
  luminance: number;
}

export const BIOMES: readonly Biome[] = [
  {
    key: 'undergrowth',
    from: 0,
    skyTop: '#39a06a',
    skyBottom: '#071f14',
    haze: '#1d6b45',
    distant: '#0c3322',
    light: '#cdf2a0',
    luminance: 0.5,
  },
  {
    key: 'canopy',
    from: 14,
    skyTop: '#7fd39a',
    skyBottom: '#12452e',
    haze: '#2f9159',
    distant: '#12452e',
    light: '#eaffc8',
    luminance: 0.75,
  },
  {
    key: 'above',
    from: 32,
    skyTop: '#57c8e8',
    skyBottom: '#a8e6c4',
    haze: '#bdeede',
    distant: '#3d8f77',
    light: '#ffffff',
    luminance: 1,
  },
  {
    key: 'clouds',
    from: 54,
    skyTop: '#2f8fd8',
    skyBottom: '#bfe8f5',
    haze: '#e8f6fb',
    distant: '#6ba3b8',
    light: '#ffffff',
    luminance: 0.95,
  },
  {
    key: 'sunset',
    from: 80,
    skyTop: '#3b2a6b',
    skyBottom: '#ff9e5e',
    haze: '#ff8f7a',
    distant: '#6b4a72',
    light: '#ffd8a8',
    luminance: 0.7,
  },
  {
    key: 'stars',
    from: 110,
    skyTop: '#050a24',
    skyBottom: '#1e2a5e',
    haze: '#2f3d7a',
    distant: '#161f4a',
    light: '#cfe0ff',
    luminance: 0.4,
  },
] as const;

/** Индекс биома и доля перехода к следующему — фон меняется плавно, не рывком. */
export function biomeAt(floors: number): { a: Biome; b: Biome; t: number } {
  let i = 0;
  for (let k = 0; k < BIOMES.length; k++) {
    if (floors >= (BIOMES[k] as Biome).from) i = k;
  }
  const a = BIOMES[i] as Biome;
  const b = (BIOMES[i + 1] ?? a) as Biome;
  // Переход растянут на последние 8 этажей биома: смена читается как
  // событие, но не мигает.
  const span = b.from - a.from;
  const t = span > 0 ? Math.min(1, Math.max(0, (floors - (b.from - 8)) / 8)) : 0;
  return { a, b, t };
}

/** Готовый интерполированный пресет освещения для текущей высоты. */
export function lightingAt(floors: number): Biome {
  const { a, b, t } = biomeAt(floors);
  if (t <= 0) return a;
  return {
    key: t > 0.5 ? b.key : a.key,
    from: a.from,
    skyTop: mix(a.skyTop, b.skyTop, t),
    skyBottom: mix(a.skyBottom, b.skyBottom, t),
    haze: mix(a.haze, b.haze, t),
    distant: mix(a.distant, b.distant, t),
    light: mix(a.light, b.light, t),
    luminance: a.luminance + (b.luminance - a.luminance) * t,
  };
}

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
  /**
   * Высота одного этажа. 46 было слишком мелко: ящик занимал ~30 px на
   * экране, и ни доски, ни бананы в нём не читались. 54 — компромисс между
   * читаемостью ящика и числом этажей, помещающихся в кадр.
   */
  floorH: 54,
  /** Стартовая ширина блока. */
  baseW: 300,
  /** Минимальная ширина, ниже которой забег заканчивается. */
  minW: 26,
  /** Толщина «подсветки» сверху блока — имитация объёма без текстур. */
  glossH: 0.28,

  /** Шаг между бананами в связке — из него выводится их количество по ширине блока. */
  bananaStep: 58,
  /**
   * Ширина отрисовки одного банана. Заметно больше шага — связка обязана
   * перекрываться, иначе бананы выстраиваются в частокол с просветами.
   * Высота при пропорции 0.56 даёт ~53 при floorH 46: кончики немного
   * выступают за габарит этажа, и стопка выглядит органической, а не сеткой.
   */
  bananaW: 95,
  /** Максимум бананов в связке: дальше силуэт перестаёт читаться. */
  bananaMax: 6,
  /** Скругление кнопок и панелей UI. */
  uiRadius: 22,
  /** Минимальная сторона интерактивного элемента (п. 1.6 — палец). */
  touchMin: 64,

  /**
   * На сколько этажей выше верхушки висит ящик на лиане — и, следовательно,
   * какой путь он пролетает при падении. Величина нужна и симуляции, и
   * отрисовке, поэтому живёт здесь, а не в рендере.
   */
  dropFloors: 5.4,
} as const;

/**
 * Параллакс слоёв: во сколько раз слой движется медленнее игрового плана.
 *
 * Переднего плана в этой таблице намеренно нет. Камера следует за верхушкой
 * башни, поэтому игровой план на экране почти неподвижен, и «слой быстрее
 * игрового» уезжал бы из кадра безвозвратно. Передние листья прибиты к рамке
 * и только качаются от ветра — см. drawForeground().
 */
export const PARALLAX = {
  sky: 0,
  farCanopy: 0.12,
  trees: 0.55,
  play: 1,
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

/** Цвет с прозрачностью — вместо россыпи строковых литералов rgba() по коду. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function hexToRgb(hex: string): [number, number, number] {
  if (hex.startsWith('rgb')) {
    const nums = hex.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
    }
  }
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Детерминированный «шум» из целого числа. Нужен, чтобы вариативность
 * (наклон банана, пятна спелости, разброс декора) была СТАБИЛЬНОЙ между
 * кадрами: Math.random() здесь дал бы дрожание всей картинки.
 */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
