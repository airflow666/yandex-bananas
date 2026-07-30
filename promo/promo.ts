/**
 * Генератор промо-материалов: иконка, обложка, обложка для витрины.
 *
 * Почему генератор, а не картинки в репозитории. Промо рисуется ТЕМ ЖЕ
 * кодом и теми же спрайтами, что и сама игра, поэтому стиль совпадает по
 * построению. Когда арт меняется, промо не устаревает молча — его достаточно
 * пересобрать одной кнопкой. Ни одного стороннего ассета здесь тоже нет.
 *
 * Страница НЕ входит в игровой бандл: `vite build` собирает только
 * index.html в корне, а этот файл лежит отдельной папкой и открывается
 * вручную на `vite dev`. В архив для площадки он не попадает.
 *
 * Размеры взяты из документации черновика (docs/yandex-notes.md):
 *   иконка 512×512, обложка 800×470, обложка витрины 1560×520 — всё PNG.
 *
 * Скриншоты — в `shots.ts`, и они НЕ рисуются вручную: там поднимается
 * обычная Session, симулируется забег и кадр рисуется теми же render() и
 * drawUi(), что в игре. П. 5.1.1.2 («настоящий геймплей не менее чем на 70%
 * кадра») выполняется буквально — это и есть геймплей, просто снятый в
 * заданном разрешении и в заданной точке забега.
 */

import { C, M, alpha, font } from '../src/art/theme';
import { initSprites, BANANA_KEYS, FLORA_KEYS, MONKEY_KEYS, TRUNK_KEY } from '../src/art/sprites';
import { setPixelScale, drawSprite } from '../src/art/svgRaster';
import { drawCrate } from '../src/render/tower';
import { updateLayout } from '../src/core/layout';
import { SHOTS, renderShot } from './shots';
import { setLang } from '../src/i18n';

type Lang = 'ru' | 'en';

interface Size {
  w: number;
  h: number;
  name: string;
  kind: 'icon' | 'cover';
  /** Название на обложке. У иконки текста нет вовсе. */
  lang?: Lang;
}

/** Название игры для обложки, разбитое на две строки. */
const TITLE_LINES: Record<Lang, [string, string]> = {
  ru: ['Банановая', 'башня'],
  en: ['Banana', 'Tower'],
};

/**
 * Иконка одна: текста в ней нет, и переводить нечего. Обложки — по одной на
 * язык, потому что название на них написано и обязано совпадать с языком
 * витрины.
 */
const SIZES: Size[] = [
  { w: 512, h: 512, name: 'icon-512.png', kind: 'icon' },
  { w: 800, h: 470, name: 'cover-ru-800x470.png', kind: 'cover', lang: 'ru' },
  { w: 800, h: 470, name: 'cover-en-800x470.png', kind: 'cover', lang: 'en' },
  { w: 1560, h: 520, name: 'showcase-ru-1560x520.png', kind: 'cover', lang: 'ru' },
  { w: 1560, h: 520, name: 'showcase-en-1560x520.png', kind: 'cover', lang: 'en' },
];

/** Фон джунглей: вертикальный градиент плюс мягкий световой конус сверху. */
function jungleBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.canopyMid);
  g.addColorStop(0.55, C.jungle);
  g.addColorStop(1, C.canopyDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const cone = ctx.createRadialGradient(w * 0.5, -h * 0.15, 0, w * 0.5, h * 0.4, h * 0.95);
  cone.addColorStop(0, alpha(C.leafBright, 0.3));
  cone.addColorStop(1, alpha(C.leafBright, 0));
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, w, h);
}

/** Боковые стволы с листвой — та же рамка кадра, что в игре. */
function sideTrunks(ctx: CanvasRenderingContext2D, w: number, h: number, tw: number): void {
  for (const side of [-1, 1]) {
    const x = side < 0 ? tw / 2 : w - tw / 2;
    drawSprite(ctx, TRUNK_KEY, x, h * 0.5, tw);
    drawSprite(ctx, FLORA_KEYS.monstera, x, h * 0.22, tw * 1.1, {
      rotation: side * 0.3, flip: side > 0,
    });
    drawSprite(ctx, FLORA_KEYS.palm, x, h * 0.82, tw * 1.3, {
      rotation: side * -0.5, flip: side > 0,
    });
  }
}

/**
 * Башня из ящиков с лёгким креном — главный силуэт во всех материалах.
 * Крен обязателен: ровная стопка читается как забор, наклонённая сразу
 * сообщает, что игра про равновесие.
 */
function crateTower(
  ctx: CanvasRenderingContext2D, cx: number, baseY: number,
  crateW: number, crateH: number, count: number, lean: number,
): void {
  // Ящик рисуется ФИКСИРОВАННОЙ высотой M.floorH — это метрика игры, а не
  // параметр. Поэтому расставлять этажи своим шагом нельзя: они наложатся
  // друг на друга. Вместо этого масштабируем всю башню целиком, и тогда шаг
  // и высота ящика совпадают по построению, как в самой игре.
  const scale = crateH / M.floorH;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(lean);
  ctx.scale(scale, scale);
  const w = crateW / scale;
  for (let i = 0; i < count; i++) {
    const y = -i * M.floorH - M.floorH / 2;
    // Верхний ящик — «идеальный»: золотая обвязка притягивает взгляд к вершине.
    drawCrate(ctx, 0, y, w * (1 - i * 0.04), i === count - 1, i + 3);
  }
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, s: Size): void {
  jungleBackdrop(ctx, s.w, s.h);

  // Иконка обязана читаться на 48 px: только силуэт, никакого мелкого декора
  // и никакого текста — его в иконке быть не должно.
  crateTower(ctx, s.w * 0.5, s.h * 0.95, s.w * 0.56, s.h * 0.155, 3, 0.06);

  // Бананы по углам, НЕ поверх верхнего ящика: перекрывая его, они съедали
  // золотую обвязку — единственную деталь, читаемую на иконке в 48 px.
  drawSprite(ctx, BANANA_KEYS.golden, s.w * 0.79, s.h * 0.2, s.w * 0.36, { rotation: -0.7 });
  drawSprite(ctx, BANANA_KEYS.fresh, s.w * 0.21, s.h * 0.15, s.w * 0.26, { rotation: 2.5, flip: true });
}

function drawCover(ctx: CanvasRenderingContext2D, s: Size): void {
  jungleBackdrop(ctx, s.w, s.h);
  sideTrunks(ctx, s.w, s.h, s.w * 0.16);

  const towerX = s.w * 0.72;
  crateTower(ctx, towerX, s.h * 1.04, s.w * 0.19, s.h * 0.125, 6, 0.05);

  // Обезьяны на стволах — то, чем игра отличается от абстрактного стакера.
  drawSprite(ctx, MONKEY_KEYS.cheer, s.w * 0.11, s.h * 0.42, s.w * 0.075);
  drawSprite(ctx, MONKEY_KEYS.climb, s.w * 0.9, s.h * 0.58, s.w * 0.07, { flip: true });

  // Название слева, крупно, с запасом от края: обрезанный текст — прямой
  // повод для отказа на модерации. Кегль подбирается под фактическую ширину
  // блока, потому что «Банановая» и «Banana» имеют разную длину, и
  // фиксированный размер вылез бы за край в одном из языков.
  const [line1, line2] = TITLE_LINES[s.lang ?? 'ru'];
  const x = s.w * 0.06;
  const maxW = towerX - s.w * 0.16 - x;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let size = Math.round(s.h * 0.155);
  ctx.font = font(size);
  while (size > 12 && Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) > maxW) {
    size -= 2;
    ctx.font = font(size);
  }
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = alpha(C.abyss, 0.85);
  ctx.lineJoin = 'round';
  const y1 = s.h * 0.42;
  const y2 = y1 + size * 1.05;
  ctx.strokeText(line1, x, y1);
  ctx.strokeText(line2, x, y2);
  ctx.fillStyle = C.gold;
  ctx.fillText(line1, x, y1);
  ctx.fillText(line2, x, y2);
  ctx.restore();
}

function render(s: Size, canvas: HTMLCanvasElement): void {
  canvas.width = s.w;
  canvas.height = s.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, s.w, s.h);
  if (s.kind === 'icon') drawIcon(ctx, s);
  else drawCover(ctx, s);
}

/** Карточка «холст + подпись + кнопка скачивания». */
function card(canvas: HTMLCanvasElement, name: string, note: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'item';

  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.textContent = `${name} — ${note}`;

  const save = document.createElement('button');
  save.textContent = 'Скачать PNG';
  save.onclick = () => {
    const a = document.createElement('a');
    a.download = name;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  box.append(canvas, caption, save);
  return box;
}

function heading(text: string, note?: string): HTMLElement {
  const wrap = document.createElement('div');
  const h = document.createElement('h1');
  h.textContent = text;
  wrap.append(h);
  if (note) {
    const p = document.createElement('p');
    p.textContent = note;
    wrap.append(p);
  }
  return wrap;
}

async function main(): Promise<void> {
  // Растеризуем спрайты под самый крупный материал, иначе на витрине
  // 1560 px и на скриншотах 1920 px они будут мылом.
  setPixelScale(3);
  await initSprites(3);

  document.body.append(heading('Иконка и обложки'));
  for (const s of SIZES) {
    const canvas = document.createElement('canvas');
    render(s, canvas);
    const lang = s.lang ? `, ${s.lang === 'ru' ? 'русское' : 'английское'} название` : ', без текста';
    document.body.append(card(canvas, s.name, `${s.w}×${s.h}${lang}`));
  }

  document.body.append(heading(
    'Скриншоты',
    'Настоящий рендер игры: поднимается обычная Session, симулируется забег '
    + 'до нужной высоты и кадр рисуется теми же render() и drawUi(), что в игре. '
    + 'Ничего не дорисовано вручную.',
  ));
  for (const spec of SHOTS) {
    const canvas = document.createElement('canvas');
    renderShot(spec, canvas);
    const kind = spec.w > spec.h ? 'десктоп 16:9' : 'мобильные 9:16';
    const lang = spec.lang === 'ru' ? 'русский HUD' : 'английский HUD';
    document.body.append(card(canvas, spec.name, `${spec.w}×${spec.h}, ${kind}, ${lang}`));
  }

  // Раскладка и язык — модульные синглтоны, и мы меняли их под каждый кадр.
  // Возвращаем к исходному, иначе состояние «залипнет» от последнего кадра.
  updateLayout(window.innerWidth, window.innerHeight);
  setLang(navigator.language || 'ru');
}

void main();
