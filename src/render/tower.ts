/**
 * Башня, лиана и обезьяны — всё, что живёт в игровом плане.
 *
 * Ключевое отличие от концепта A: этаж — это не жёлтый прямоугольник, а
 * ЯЩИК С БАНАНАМИ. Ящики штабелируются в реальности, поэтому башня из них
 * читается как конструкция; количество торчащих бананов выводится из ширины
 * блока, и ширина стала видна сама по себе — игрок оценивает риск, не глядя
 * на цифры.
 *
 * Вариативность (наклон, спелость, разброс бананов) берётся из hash01 по
 * номеру этажа, а не из Math.random(): ящик обязан выглядеть одинаково в
 * каждом кадре, иначе башня дрожит.
 */

import { C, M, hash01 } from '../art/theme';
import { drawSprite, drawSpriteRect } from '../art/svgRaster';
import { BANANA_KEYS, CRATE_KEYS, FLORA_KEYS, MONKEY_KEYS } from '../art/sprites';
import type { Layout } from '../core/layout';
import type { Session, FallingSlice } from '../game/session';
import type { Block } from '../game/tower';
import { trunkCenterX, trunkWidth } from './background';

/**
 * На сколько этажей выше верхушки висит ящик на лиане. Подобрано по кадру:
 * при 3.2 вся игра ютилась в нижней четверти экрана, а верх кадра пустовал.
 * Живёт в theme, потому что от той же величины зависит длина падения.
 */
export const DROP_HEIGHT_FLOORS = M.dropFloors;

// -------------------------------------------------------------------- ящик

/** Сколько бананов торчит из ящика такой ширины. */
function bananaCount(w: number): number {
  return Math.max(1, Math.min(M.bananaMax, Math.round(w / M.bananaStep)));
}

/**
 * Ящик с бананами — один этаж башни.
 *
 * Габарит ящика в точности равен ширине блока: визуальные границы обязаны
 * совпадать с теми, по которым считается посадка, иначе игрок целится не
 * туда, куда думает. Бананы торчат над верхней кромкой и потому у нижних
 * этажей закрыты ящиком следующего — открытым выглядит только верхний,
 * что и правильно.
 *
 * Идеальная посадка помечается ЗОЛОТОЙ ОБВЯЗКОЙ, а не свечением: свечение
 * копилось на каждом этаже и заливало половину кадра.
 */
export function drawCrate(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number,
  perfect: boolean, seed: number,
): void {
  const h = M.floorH;
  const left = cx - w / 2;
  const top = cy - h / 2;

  // Контактная тень: без неё этаж «парит» над предыдущим.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = C.abyss;
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.46, w * 0.47, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawBananasInCrate(ctx, cx, top, w, perfect, seed);

  // 3-slice: торцы фиксированы, доски между ними растягиваются.
  const capW = Math.min(38, w * 0.3);
  const midW = Math.max(0, w - capW * 2);
  const midKey = perfect ? CRATE_KEYS.midPerfect : CRATE_KEYS.midPlain;
  const endKey = perfect ? CRATE_KEYS.endPerfect : CRATE_KEYS.endPlain;

  if (midW > 0) drawSpriteRect(ctx, midKey, left + capW, top, midW, h);
  drawSpriteRect(ctx, endKey, left, top, capW, h);
  drawSpriteRect(ctx, endKey, left + w - capW, top, capW, h, true);

  applySkinTint(ctx, left, top, w, h);
}

/**
 * Тонировка ящика выбранным скином.
 *
 * Умножение поверх уже отрисованного ящика, а не отдельный набор спрайтов:
 * так сохраняются вся светотень и текстура досок, а растровый кэш не растёт
 * впятеро. Прямоугольник в точности повторяет габарит ящика, а ящик его
 * полностью закрывает, поэтому под умножение не попадает ничего лишнего —
 * кроме скруглений по углам, где эффект незаметен.
 *
 * Бананы тонировать НЕ надо: они торчат выше `top` и остаются жёлтыми, то
 * есть сеттинг не теряется ни при каком скине.
 */
let activeTint: { color: string; strength: number } | null = null;

/** Скин ставится один раз при смене, а не читается из сохранений в кадре. */
export function setCrateTint(color: string | null, strength: number): void {
  activeTint = color ? { color, strength } : null;
}

function applySkinTint(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  if (!activeTint) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = activeTint.strength;
  ctx.fillStyle = activeTint.color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Бананы, торчащие из ящика. Рисуются ДО досок, поэтому нижней половиной
 * уходят внутрь — видно, что они лежат в ящике, а не на нём.
 */
function drawBananasInCrate(
  ctx: CanvasRenderingContext2D,
  cx: number, top: number, w: number, perfect: boolean, seed: number,
): void {
  const count = bananaCount(w);
  const bw = Math.min(M.bananaW, w * 0.66);
  const half = Math.max(0, w / 2 - bw / 2);

  for (let i = 0; i < count; i++) {
    const h1 = hash01(seed * 131 + i * 7);
    const h2 = hash01(seed * 57 + i * 19 + 3);
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const x = cx + t * half;
    // Центр банана поднят НАД бортом: иначе из-за досок торчала жёлтая
    // полоска, по которой банан не опознать. Разброс по высоте и наклону —
    // чтобы бананы выглядели наваленными, а не выложенными рядком.
    const y = top - M.floorH * 0.2 - h1 * M.floorH * 0.14;
    const rot = (h2 - 0.5) * 0.55 + t * 0.14;

    const key = perfect
      ? BANANA_KEYS.golden
      : h1 > 0.62 ? BANANA_KEYS.ripe : BANANA_KEYS.fresh;
    drawSprite(ctx, key, x, y, bw * (0.86 + h2 * 0.28), {
      rotation: rot, flip: h2 > 0.5,
    });
  }
}

// ------------------------------------------------------------------- башня

/**
 * Отбраковка идёт по РЕАЛЬНОЙ высоте кадра, а не по числу этажей от
 * верхушки. Прежний потолок в 5 этажей обрезал стопку выше нижней кромки
 * экрана, и башня выглядела висящей в воздухе. Запас в два этажа с каждой
 * стороны нужен из-за крена: наклон уводит нижние ящики вбок и вниз, и
 * граничный ящик обязан быть нарисован до того, как въедет в кадр.
 */
export function drawTower(
  ctx: CanvasRenderingContext2D, s: Session, groundY: number, viewH: number,
): void {
  const topIndex = s.tower.blocks.length - 1;
  const margin = M.floorH * 2;
  s.tower.blocks.forEach((b, i) => {
    const y = groundY - b.floor * M.floorH + s.cameraY;
    if (y < -margin || y > viewH + margin) return; // за кадром
    if (i === topIndex && s.landPulse > 0) {
      drawSquashed(ctx, b, y, s.landPulse);
    } else {
      drawCrate(ctx, b.x, y, b.w, b.perfect, b.floor);
    }
  });
}

/**
 * Только что севшая связка приседает и пружинит обратно. Пивот у нижней
 * кромки: связка приседает В посадку, а не парит над ней.
 */
function drawSquashed(
  ctx: CanvasRenderingContext2D, b: Block, y: number, pulse: number,
): void {
  const bottom = y + M.floorH / 2;
  ctx.save();
  ctx.translate(b.x, bottom);
  ctx.scale(1 + 0.12 * pulse, 1 - 0.22 * pulse);
  ctx.translate(-b.x, -bottom);
  drawCrate(ctx, b.x, y, b.w, b.perfect, b.floor);
  ctx.restore();
}

/** Отрезанные при промахе бананы, падающие вниз. */
export function drawSlices(
  ctx: CanvasRenderingContext2D, s: Session, groundY: number,
): void {
  s.slices.forEach((sl: FallingSlice, i) => {
    const y = groundY - sl.y + s.cameraY;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, sl.life));
    ctx.translate(sl.x, y);
    ctx.rotate(sl.rot);
    ctx.translate(-sl.x, -y);
    drawCrate(ctx, sl.x, y, sl.w, false, i * 977 + Math.round(sl.w));
    ctx.restore();
  });
}

// ------------------------------------------------------------------- лиана

/**
 * Лиана вместо троса. Висит из-под верхней кромки кадра, качается вместе со
 * связкой и обвешана листьями — верёвка из концепта A выглядела деталью
 * подъёмного крана, а не джунглей.
 *
 * Кривая строится по фактическому положению маятника, поэтому лиана всегда
 * «объясняет» траекторию блока: видно, что связка не летает сама по себе.
 */
export function drawLiana(
  ctx: CanvasRenderingContext2D, s: Session, groundY: number,
): void {
  const x = s.pendulum.x;
  const y = groundY - (s.tower.floors + DROP_HEIGHT_FLOORS) * M.floorH + s.cameraY;
  const pivotX = s.pendulum.centerX;
  const pivotY = -30;

  // Управляющая точка сдвинута против хода — лиана провисает, а не натянута
  // струной, и на краях размаха это особенно заметно.
  const bendX = pivotX + (x - pivotX) * 0.35 - s.pendulum.velocityNorm * 26;
  const bendY = (pivotY + y) * 0.5;

  const endY = y - M.floorH * 0.46;

  ctx.save();
  ctx.lineCap = 'round';
  // Три штриха друг поверх друга: тёмный контур, тело, светлая жилка.
  // Это и есть цилиндрическая растушёвка — лиана круглая, а не плоская.
  const strokes: [string, number, number][] = [
    [C.abyss, 17, 0],
    [C.canopyMid, 13, 0],
    [C.jungle, 8, -1.5],
    [C.leaf, 3, -3.5],
  ];
  for (const [color, width, dx] of strokes) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = color === C.leaf ? 0.5 : 1;
    ctx.beginPath();
    ctx.moveTo(pivotX + dx, pivotY);
    ctx.quadraticCurveTo(bendX + dx, bendY, x + dx, endY);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Витки по лиане — узлы, из-за которых она перестаёт быть шлангом.
  ctx.strokeStyle = C.canopyDeep;
  ctx.lineWidth = 3;
  for (let i = 1; i <= 7; i++) {
    const t = i / 8;
    const px = quad(pivotX, bendX, x, t);
    const py = quad(pivotY, bendY, endY, t);
    ctx.beginPath();
    ctx.ellipse(px, py, 9, 4.5, Math.atan2(x - pivotX, endY - pivotY) * -1, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Листья вдоль лианы: сажаются по той же кривой, поэтому не «отклеиваются».
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const px = quad(pivotX, bendX, x, t);
    const py = quad(pivotY, bendY, endY, t);
    drawSprite(ctx, FLORA_KEYS.vineLeaf, px, py, 46, {
      rotation: (i % 2 ? 0.5 : 2.7) + Math.sin(s.time * 1.4 + i) * 0.25
        + s.pendulum.velocityNorm * 0.3,
      flip: i % 2 === 0,
    });
  }

  // Ящик на конце лианы — только если он ещё не отцеплен. Пока предыдущий
  // летит, на лиане пусто: иначе казалось бы, что ящиков два.
  if (!s.falling) {
    // «Вырастание» нового ящика: подмена одним кадром читается как мигание.
    const pop = 1 - s.readyPop * 0.35;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.translate(-x, -y);
    drawCrate(ctx, x, y, s.tower.top.w, false, s.tower.floors + 1);
    ctx.restore();
  }
}

/**
 * Ящик в полёте. Рисуется ВНЕ поворота башни: он ещё не её часть, и крен
 * на него не действует — падает он строго вертикально.
 */
export function drawFallingCrate(
  ctx: CanvasRenderingContext2D, s: Session, groundY: number,
): void {
  const f = s.falling;
  if (!f) return;
  const y = groundY - f.y + s.cameraY;

  ctx.save();
  if (f.rot !== 0) {
    ctx.translate(f.x, y);
    ctx.rotate(f.rot);
    ctx.translate(-f.x, -y);
  }
  drawCrate(ctx, f.x, y, f.w, false, s.tower.floors + 1);
  ctx.restore();
}

function quad(a: number, b: number, c: number, t: number): number {
  return (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
}

// ---------------------------------------------------------------- обезьяны

/**
 * Обезьяны сидят на боковых стволах на уровне верхушки башни. Экранная
 * позиция почти постоянна, ствол за спиной уезжает — из разницы скоростей
 * и рождается ощущение подъёма.
 */
export function drawMonkeys(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, groundY: number,
): void {
  const topY = groundY - s.tower.floors * M.floorH + s.cameraY;
  const wind = s.tower.wind;
  const trunkW = trunkWidth(L);

  for (const m of s.troop.monkeys) {
    const trunkX = trunkCenterX(L, m.side);
    // Сажаем на обращённую к башне сторону ствола, но НЕ дальше его кромки:
    // обезьяна обязана оставаться на дереве, а не висеть над игровым полем.
    const x = trunkX - m.side * trunkW * m.offsetX + wind * 120;
    const y = topY + m.offsetY + s.troop.hopOffset(m)
      + Math.sin(s.time * 1.5 + m.phase) * 5;

    if (y < -160 || y > L.height + 160) continue;

    const pose = s.troop.poseOf(m);
    // Лёгкий крен по ветру — обезьяна держится за ствол, но её тоже качает.
    const rot = wind * 1.1 + Math.sin(s.time * 1.2 + m.phase) * 0.04;
    // Размер обезьяны следует за стволом: иначе на телефоне она крупнее
    // дерева, на котором сидит.
    drawSprite(ctx, MONKEY_KEYS[pose], x, y, Math.max(58, trunkW * 0.27), {
      rotation: rot, flip: m.side < 0,
    });
  }
}
