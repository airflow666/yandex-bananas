/**
 * Фон: пять слоёв глубины.
 *
 * Главная претензия к концепту A была в том, что всё лежало в одной
 * плоскости. Здесь у каждого слоя свой коэффициент параллакса, и подъём
 * башни читается как движение сквозь пространство, а не как прокрутка
 * картинки:
 *
 *   0.00  небо, солнце, звёзды      — не движется вообще
 *   0.12  дальние кроны             — почти не движется, задаёт горизонт
 *   0.55  гигантские стволы         — рама кадра, по ним лазают обезьяны
 *   1.00  игровой план (башня)      — эталон скорости
 *   1.25  передние листья           — обгоняют кадр, дают «объектив»
 *
 * Второй приём — воздушная перспектива: чем дальше слой, тем сильнее он
 * уведён в цвет дымки биома. Поэтому глубина видна даже на стоп-кадре.
 *
 * Ветер здесь не абстракция: один и тот же `wind` кренит листья, кроны и
 * лианы. Порыв видно раньше, чем он качнёт башню.
 */

import { C, M, PARALLAX, alpha, mix, hash01, type Biome } from '../art/theme';
import { drawSprite, getSprite, spriteAspect } from '../art/svgRaster';
import { FLORA_KEYS, TRUNK_KEY } from '../art/sprites';
import type { Layout } from '../core/layout';
import type { Session } from '../game/session';

/** Насколько ствол заходит за край игровой колонки — рама, а не преграда. */
const TRUNK_INSET = 0.42;
/**
 * Ствол обязан остаться в кадре при ЛЮБОМ соотношении сторон. В портрете
 * игровая колонка занимает почти всю ширину, и «поставить деревья за
 * колонкой» физически негде — тогда ствол заезжает под колонку. Это не
 * проблема: он рисуется ДО игрового плана, поэтому ящик проходит перед
 * ним и получается честная глубина, а не перекрытие.
 */
const TRUNK_MIN_INSET = 0.3;

/**
 * Логическая ширина ствола — доля кадра, а не константа.
 *
 * Фиксированные 340 работали на десктопе и разваливались на узком телефоне:
 * два ствола по 340 в кадре шириной 589 оставляли между собой просвет в 45
 * единиц, игровое поле схлопывалось в щель, а обезьяны оказывались поверх
 * башни. Доля кадра решает это одним числом на всех устройствах.
 */
export function trunkWidth(L: Layout): number {
  return Math.max(150, Math.min(340, L.width * 0.26));
}

/**
 * Центр ствола по горизонтали. Единственный источник этой величины: по ней
 * же сажаются обезьяны, и разъехаться они не должны.
 */
export function trunkCenterX(L: Layout, side: -1 | 1): number {
  const w = trunkWidth(L);
  const edge = w * TRUNK_MIN_INSET;
  return side < 0
    ? Math.max(L.columnLeft - w * TRUNK_INSET, edge)
    : Math.min(L.columnRight + w * TRUNK_INSET, L.width - edge);
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  s: Session,
  L: Layout,
  groundY: number,
  light: Biome,
): void {
  const floors = s.tower.floors;
  drawSky(ctx, L, light, floors, s.time);
  drawStars(ctx, L, floors, s.time);
  drawSunAndRays(ctx, L, light, floors, s.time);
  drawClouds(ctx, L, s.cameraY, floors, s.time);
  drawFarCanopy(ctx, L, s.cameraY, light, s.time, s.tower.wind);
  // Светлячки — ДО стволов: они летают в воздухе между деревьями, а не
  // сидят на коре. Раньше рисовались после и мерцали прямо на стволах.
  drawFireflies(ctx, L, floors, s.time);
  drawTrunks(ctx, s, L, light);
  drawGroundLayer(ctx, s, L, groundY, light);
}

// ------------------------------------------------------------------- небо

function drawSky(
  ctx: CanvasRenderingContext2D, L: Layout, light: Biome, floors: number, time: number,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, L.height);
  g.addColorStop(0, light.skyTop);
  g.addColorStop(0.62, mix(light.skyTop, light.skyBottom, 0.65));
  g.addColorStop(1, light.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.width, L.height);

  // Дымка у горизонта — то, что делает даль далёкой. Чуть дышит по времени,
  // иначе на статичной высоте кадр замирает.
  const breathe = 0.5 + Math.sin(time * 0.35) * 0.06;
  const haze = ctx.createLinearGradient(0, L.height * 0.45, 0, L.height);
  haze.addColorStop(0, alpha(light.haze, 0));
  haze.addColorStop(1, alpha(light.haze, 0.38 * breathe + 0.12));
  ctx.fillStyle = haze;
  ctx.fillRect(0, L.height * 0.45, L.width, L.height * 0.55);

  // Виньетка: удерживает взгляд в центре кадра, где происходит игра.
  const vig = ctx.createRadialGradient(
    L.centerX, L.height * 0.44, L.height * 0.22,
    L.centerX, L.height * 0.44, L.height * 0.82,
  );
  vig.addColorStop(0, alpha(C.abyss, 0));
  vig.addColorStop(1, alpha(C.abyss, 0.34 - light.luminance * 0.12));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, L.width, L.height);

  void floors;
}

/** Звёзды зажигаются только к ночному биому — плавно, по мере подъёма. */
function drawStars(
  ctx: CanvasRenderingContext2D, L: Layout, floors: number, time: number,
): void {
  const a = clamp01((floors - 92) / 24);
  if (a <= 0) return;
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const x = hash01(i * 7 + 1) * L.width;
    const y = hash01(i * 13 + 5) * L.height * 0.72;
    const r = 1 + hash01(i * 3 + 9) * 1.9;
    // Мерцание с разной фазой: одинаково мигающие звёзды выглядят гирляндой.
    // Частота и глубина занижены по той же причине, что у светлячков:
    // быстрое мигание мелких ярких точек рябит в глазах.
    const tw = 0.78 + 0.22 * Math.sin(time * (0.4 + hash01(i) * 0.6) + i);
    ctx.globalAlpha = a * tw;
    ctx.fillStyle = i % 9 === 0 ? C.gold : C.paper;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Солнце и лучи. Лучи — не украшение: они задают направление света, из-за
 * которого блики на бананах и стволах лежат слева сверху и выглядят
 * осмысленно.
 */
function drawSunAndRays(
  ctx: CanvasRenderingContext2D, L: Layout, light: Biome, floors: number, time: number,
): void {
  const strength = light.luminance * clamp01(1 - (floors - 88) / 28);
  if (strength <= 0.02) return;

  const sx = L.width * 0.26;
  const sy = L.height * 0.12;

  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, L.height * 0.42);
  glow.addColorStop(0, alpha(light.light, 0.55 * strength));
  glow.addColorStop(0.35, alpha(light.light, 0.16 * strength));
  glow.addColorStop(1, alpha(light.light, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, L.width, L.height * 0.9);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    // Лучи медленно «дышат» — сквозь листву пробивается неровный свет.
    const sway = Math.sin(time * 0.22 + i * 1.3) * 26;
    const topX = sx + i * 62 - 60 + sway;
    const spread = 46 + i * 12;
    ctx.globalAlpha = (0.05 + 0.035 * Math.sin(time * 0.5 + i)) * strength;
    ctx.fillStyle = light.light;
    ctx.beginPath();
    ctx.moveTo(topX, -10);
    ctx.lineTo(topX + spread, -10);
    ctx.lineTo(topX + spread * 2.6 + 150, L.height);
    ctx.lineTo(topX + spread * 1.4 + 150, L.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Облака появляются в верхних биомах и плывут с собственным параллаксом. */
function drawClouds(
  ctx: CanvasRenderingContext2D, L: Layout, cameraY: number, floors: number, time: number,
): void {
  const a = clamp01((floors - 40) / 18) * clamp01(1 - (floors - 96) / 22);
  if (a <= 0.01) return;
  if (!getSprite(FLORA_KEYS.canopy)) return;

  ctx.save();
  ctx.globalAlpha = a * 0.5;
  for (let i = 0; i < 6; i++) {
    const w = 300 + hash01(i * 5 + 2) * 340;
    const drift = time * (7 + hash01(i) * 11);
    const span = L.width + w * 2;
    const x = ((hash01(i * 11 + 3) * span + drift) % span) - w;
    const baseY = hash01(i * 17 + 7) * L.height * 0.8;
    const y = mod(baseY + cameraY * 0.2, L.height + 200) - 100;
    ctx.globalAlpha = a * (0.28 + hash01(i * 23) * 0.3);
    drawTinted(ctx, FLORA_KEYS.canopy, x, y, w, C.paper);
  }
  ctx.restore();
}

/**
 * Дальние кроны: сплошная линия силуэта по низу кадра, уведённая в цвет
 * дымки биома. Единственный слой, который никогда не показывает деталей, —
 * этим и создаётся ощущение расстояния.
 */
function drawFarCanopy(
  ctx: CanvasRenderingContext2D, L: Layout, cameraY: number,
  light: Biome, time: number, wind: number,
): void {
  const tile = 520;
  const offset = cameraY * PARALLAX.farCanopy;
  const baseY = L.height * 0.72 + offset;
  const count = Math.ceil(L.width / tile) + 2;

  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = -1; i < count; i++) {
    // Крона кренится по ветру — далёкий лес шумит вместе с ближним.
    const sway = Math.sin(time * 0.6 + i) * 4 + wind * 90;
    const y = baseY + Math.sin(i * 1.7) * 26;
    drawTinted(ctx, FLORA_KEYS.canopy, i * tile + sway, y, tile * 1.1, light.distant);
  }
  ctx.restore();

  // Заливка под линией крон: горизонт не должен просвечивать небом.
  ctx.fillStyle = light.distant;
  ctx.fillRect(0, baseY + 150, L.width, L.height);
}

// ---------------------------------------------------------------- стволы

/**
 * Два гигантских ствола по бокам игровой колонки. Тайлятся вертикально:
 * башня растёт бесконечно, значит и деревья должны. Стык не виден, потому
 * что боковые кромки спрайта — строго вертикальные линии (см. flora.ts).
 */
function drawTrunks(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, light: Biome,
): void {
  if (!getSprite(TRUNK_KEY)) return;
  const trunkW = trunkWidth(L);
  const tileH = trunkW * spriteAspect(TRUNK_KEY);
  const offset = s.cameraY * PARALLAX.trees;
  const start = mod(offset, tileH) - tileH;
  const rows = Math.ceil(L.height / tileH) + 2;

  const leftX = trunkCenterX(L, -1);
  const rightX = trunkCenterX(L, 1);

  for (const [side, x] of [[-1, leftX], [1, rightX]] as const) {
    for (let r = 0; r < rows; r++) {
      const y = start + r * tileH;
      drawSprite(ctx, TRUNK_KEY, x, y + tileH / 2, trunkW, { flip: side > 0 });
    }
    drawTrunkDecor(ctx, s, x, side, offset, tileH, rows, start, trunkW);
  }

  // Стволы уводятся в дымку биома — иначе ночью они остаются «дневными».
  // Больше 0.2 дымка съедает древесину и стволы становятся зелёными.
  const fog = 0.28 - light.luminance * 0.2;
  if (fog > 0.02) {
    ctx.save();
    ctx.globalAlpha = fog;
    ctx.fillStyle = light.haze;
    for (const x of [leftX, rightX]) {
      ctx.fillRect(x - trunkW / 2, 0, trunkW, L.height);
    }
    ctx.restore();
  }
}

/** Бромелии, цветы и свисающие лианы на коре — ствол не должен быть голым. */
function drawTrunkDecor(
  ctx: CanvasRenderingContext2D, s: Session, x: number, side: number,
  offset: number, tileH: number, rows: number, start: number, trunkW: number,
): void {
  const wind = s.tower.wind;
  // Декор масштабируется вместе со стволом: на телефоне ствол вдвое уже, и
  // бромелия «в натуральную величину» на нём выглядела бы приклеенной.
  const k = trunkW / 340;
  for (let r = -1; r < rows + 1; r++) {
    // Номер сегмента считается прямо из смещения, а не через (offset - start):
    // тот же результат, но без лишних вычитания и деления, на которых
    // сегмент теоретически мог бы дрогнуть на границе тайла.
    const worldRow = Math.floor(offset / tileH) + r - 1;
    const seed = worldRow * 31 + (side > 0 ? 977 : 13);
    const y = start + r * tileH;

    // Не на каждом сегменте: равномерный декор читается как обои.
    if (hash01(seed) > 0.45) {
      const dy = y + hash01(seed + 1) * tileH * 0.7 + tileH * 0.1;
      const dx = x + side * trunkW * (0.16 + hash01(seed + 2) * 0.14);
      drawSprite(ctx, FLORA_KEYS.bromeliad, dx, dy, 96 * k, { flip: side > 0 });
    }
    // Цветы — самое яркое пятно на тёмной коре, поэтому их мало и они почти
    // неподвижны: быстрое покачивание мелкой яркой детали читается как
    // мерцание, а не как жизнь.
    if (hash01(seed + 5) > 0.78) {
      const dy = y + hash01(seed + 6) * tileH * 0.8;
      const dx = x - side * trunkW * 0.2;
      drawSprite(ctx, FLORA_KEYS.flower, dx, dy, 42 * k, {
        rotation: Math.sin(s.time * 0.35 + seed) * 0.05,
      });
    }
    // Свисающая лиана: качается по ветру сильнее всего у свободного конца.
    if (hash01(seed + 9) > 0.5) {
      drawHangingVine(ctx, x + side * trunkW * 0.28,
        y + hash01(seed + 10) * tileH * 0.5, (120 + hash01(seed + 11) * 160) * k,
        wind, s.time, seed);
    }
  }
}

function drawHangingVine(
  ctx: CanvasRenderingContext2D, x: number, y: number, len: number,
  wind: number, time: number, seed: number,
): void {
  const sway = Math.sin(time * 1.2 + seed) * 10 + wind * 260;
  ctx.save();
  ctx.strokeStyle = C.canopyDeep;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + sway * 0.4, y + len * 0.55, x + sway, y + len);
  ctx.stroke();
  ctx.restore();

  // Пара листьев у конца — лиана не должна выглядеть верёвкой.
  for (let i = 1; i <= 2; i++) {
    const t = 0.55 + i * 0.2;
    const lx = x + sway * t * t;
    const ly = y + len * t;
    drawSprite(ctx, FLORA_KEYS.vineLeaf, lx, ly, 30, {
      rotation: 0.5 + Math.sin(time + seed + i) * 0.2,
      flip: i % 2 === 0,
    });
  }
}

// ------------------------------------------------------------------ земля

/**
 * Дно джунглей. Уезжает вместе с игровым планом и на высоте уходит из
 * кадра — именно поэтому начало забега ощущается «внизу», а не в вакууме.
 */
function drawGroundLayer(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, groundY: number, light: Biome,
): void {
  const y = groundY + s.cameraY + M.floorH / 2;
  if (y > L.height + 40) return;

  ctx.fillStyle = mix(C.canopyDeep, light.distant, 0.35);
  ctx.fillRect(0, y, L.width, L.height - y + 40);

  // Подлесок по кромке земли: силуэты листвы, а не прямая линия.
  ctx.fillStyle = C.abyss;
  ctx.beginPath();
  ctx.moveTo(0, y + 6);
  for (let x = 0; x <= L.width + 60; x += 60) {
    const h = 14 + hash01(Math.round(x)) * 26;
    ctx.quadraticCurveTo(x + 30, y + 6 - h, x + 60, y + 6);
  }
  ctx.lineTo(L.width, L.height);
  ctx.lineTo(0, L.height);
  ctx.closePath();
  ctx.fill();
}

/**
 * Светлячки — только в тёмном подлеске. Дешёвая жизнь в начале забега.
 *
 * Пульсация намеренно ВЯЛАЯ. Первая версия мигала от 0.35 до 1 на частоте
 * 2.2 рад/с, и четырнадцать аддитивных бликов поверх тёмной коры давали
 * настоящую рябь: замер показал, что до 4.6% пикселей ствола менялись
 * скачком в каждом кадре. Мелкая яркая деталь на контрастном фоне не имеет
 * права мигать быстро — глаз читает это как дефект, а не как атмосферу.
 * Отсюда меньше точек, вдвое медленнее и куда меньше глубина пульсации.
 */
function drawFireflies(
  ctx: CanvasRenderingContext2D, L: Layout, floors: number, time: number,
): void {
  const a = clamp01(1 - floors / 16);
  if (a <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const px = hash01(i * 5 + 1);
    const py = hash01(i * 9 + 4);
    const x = px * L.width + Math.sin(time * 0.35 + i * 2.1) * 30;
    const y = L.height * (0.35 + py * 0.55) + Math.cos(time * 0.28 + i) * 22;
    const pulse = 0.72 + 0.28 * Math.sin(time * 0.9 + i * 1.7);
    ctx.globalAlpha = a * pulse * 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
    g.addColorStop(0, alpha(C.gold, 0.75));
    g.addColorStop(1, alpha(C.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 14, y - 14, 28, 28);
  }
  ctx.restore();
}

// -------------------------------------------------------------- передний план

/**
 * Передние листья по углам кадра. Рисуются ПОСЛЕ игрового плана, обгоняют
 * его по параллаксу и качаются от ветра — это «объектив», из-за которого
 * кадр перестаёт быть плоским. Центр кадра они не трогают: перекрыть
 * верхушку башни листом — худшее, что можно сделать с этой игрой.
 */
export function drawForeground(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout,
): void {
  const wind = s.tower.wind;
  // Листья ПРИБИТЫ к кадру и только качаются: они играют роль объектива, а не
  // объекта сцены. Привязка к камере здесь была ошибкой — смещение росло
  // вместе с высотой без предела, и к сотому этажу листва наползала на
  // игровое поле. У «объектива» параллакса не бывает по определению.
  const sway = (phase: number) => Math.sin(s.time * 0.9 + phase) * 0.05 + wind * 1.6;
  const breathe = (phase: number) => Math.sin(s.time * 0.7 + phase) * 10;

  ctx.save();
  ctx.globalAlpha = 0.96;

  // Верхние углы: монстера свисает внутрь кадра.
  drawSprite(ctx, FLORA_KEYS.monstera, -60, -40 + breathe(0), 520, {
    rotation: -0.35 + sway(0),
  });
  drawSprite(ctx, FLORA_KEYS.monstera, L.width + 60, -70 + breathe(1.9), 480, {
    rotation: 0.4 - sway(1.9), flip: true,
  });

  // Нижние углы: перистые листья снизу — «дно» рамы.
  drawSprite(ctx, FLORA_KEYS.palm, -40, L.height + 30 + breathe(3.1), 480, {
    rotation: -0.5 + sway(3.1),
  });
  drawSprite(ctx, FLORA_KEYS.palm, L.width + 40, L.height + 50 + breathe(4.4), 440, {
    rotation: 0.55 - sway(4.4), flip: true,
  });

  ctx.restore();
}

// ---------------------------------------------------------------- утилиты

/**
 * Спрайт, перекрашенный в один тон. Нужен для дальних слоёв: воздушная
 * перспектива требует, чтобы силуэт принимал цвет дымки, а не сохранял свой.
 * Спрайт для этого нарисован белым — умножение даёт чистый тон.
 */
const tintCache = new Map<string, HTMLCanvasElement>();

function drawTinted(
  ctx: CanvasRenderingContext2D, key: string, x: number, y: number,
  w: number, color: string,
): void {
  const sprite = getSprite(key);
  if (!sprite) return;
  // Цвет дымки меняется непрерывно, поэтому квантуем его: без этого каждый
  // кадр перехода биома пересобирал бы перекрашенный холст заново.
  const q = quantize(color);
  const cacheKey = `${key}|${q}|${sprite.width}`;
  let tinted = tintCache.get(cacheKey);

  if (!tinted) {
    tinted = document.createElement('canvas');
    tinted.width = sprite.width;
    tinted.height = sprite.height;
    const tctx = tinted.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(sprite, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = q;
    tctx.fillRect(0, 0, tinted.width, tinted.height);
    // Кэш ограничен: цвет дымки меняется плавно, иначе он рос бы бесконечно.
    if (tintCache.size > 40) tintCache.clear();
    tintCache.set(cacheKey, tinted);
  }

  const h = w * spriteAspect(key);
  ctx.drawImage(tinted, x - w / 2, y - h / 2, w, h);
}

/**
 * Округление цвета до шага 12 — глазом неотличимо, кэш перестаёт течь.
 * Hex возвращаем как есть: он приходит от неинтерполированного биома, то есть
 * принимает конечное число значений и кэш от него не растёт.
 */
function quantize(color: string): string {
  if (!color.startsWith('rgb')) return color;
  const nums = color.match(/\d+/g);
  if (!nums || nums.length < 3) return color;
  const step = 12;
  const r = Math.round(Number(nums[0]) / step) * step;
  const g = Math.round(Number(nums[1]) / step) * step;
  const b = Math.round(Number(nums[2]) / step) * step;
  return `rgb(${r},${g},${b})`;
}

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)); }
function mod(a: number, n: number): number { return ((a % n) + n) % n; }
