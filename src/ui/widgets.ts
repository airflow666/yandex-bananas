/**
 * Примитивы интерфейса: панели, кнопки, чипы, иконки.
 *
 * UI/UX-правила, которым здесь всё подчинено:
 *
 * 1. **Палец больше курсора.** Минимальная сторона интерактивного элемента —
 *    M.touchMin (64 логических единицы), это с запасом перекрывает требование
 *    в 44 px. Зона нажатия при этом ШИРЕ рисунка кнопки: мелкие иконки
 *    остаются мелкими визуально, но промахнуться по ним нельзя.
 * 2. **Состояние всегда видно.** У каждой кнопки три состояния — покой,
 *    наведение, нажатие. Нажатие «вдавливает» кнопку: она уезжает на
 *    толщину своего торца, и тень схлопывается. Это единственная анимация,
 *    которую игрок замечает подсознательно, и без неё интерфейс ощущается
 *    сломанным.
 * 3. **Одна главная кнопка на экран.** Главное действие — золотое и
 *    крупное, всё остальное — тёмное и мельче. Игрок не должен выбирать.
 * 4. **Контраст текста.** Тёмный текст на золоте, светлый на зелени; и то и
 *    другое — заведомо выше 4.5:1.
 */

import { C, M, alpha, font, mix } from '../art/theme';

export interface Rect { x: number; y: number; w: number; h: number }

export type ButtonState = 'idle' | 'hover' | 'press';

/** Толщина «торца» кнопки: на неё она и вдавливается при нажатии. */
const EDGE = 8;

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

/** Прямоугольник по центру — так удобнее описывать раскладку от середины экрана. */
export function centered(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Попадание с расширением зоны до минимального размера под палец.
 * Именно поэтому маленькие иконки не требуют снайперской точности.
 */
export function hit(r: Rect, px: number, py: number): boolean {
  const padX = Math.max(0, (M.touchMin - r.w) / 2);
  const padY = Math.max(0, (M.touchMin - r.h) / 2);
  return (
    px >= r.x - padX && px <= r.x + r.w + padX &&
    py >= r.y - padY && py <= r.y + r.h + padY
  );
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Тёмная панель под контент: скрим + рамка в цвет листвы. */
export function panel(
  ctx: CanvasRenderingContext2D, r: Rect, radius = 34,
): void {
  ctx.save();
  ctx.shadowColor = alpha(C.abyss, 0.55);
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = alpha(C.canopyDeep, 0.93);
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = alpha(C.jungleLit, 0.75);
  ctx.lineWidth = 3;
  roundRect(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, radius - 1);
  ctx.stroke();

  // Внутренний блик по верхней кромке — панель выглядит выпуклой, а не дырой.
  ctx.strokeStyle = alpha(C.leaf, 0.22);
  ctx.lineWidth = 2;
  roundRect(ctx, r.x + 8, r.y + 8, r.w - 16, r.h - 16, radius - 8);
  ctx.stroke();
}

/**
 * Главная кнопка: золотая, с торцом и тенью. При нажатии уезжает вниз на
 * толщину торца — «физическая» кнопка, которую видно, что нажали.
 */
export function primaryButton(
  ctx: CanvasRenderingContext2D, r: Rect, label: string, state: ButtonState,
): void {
  const pressed = state === 'press';
  const dy = pressed ? EDGE : 0;
  const radius = M.uiRadius;

  // Торец: тёмная плашка под кнопкой, видна только пока не нажата.
  ctx.fillStyle = C.bananaShadow;
  roundRect(ctx, r.x, r.y + EDGE, r.w, r.h, radius);
  ctx.fill();

  if (!pressed) {
    ctx.save();
    ctx.shadowColor = alpha(C.abyss, 0.45);
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = C.bananaDeep;
    roundRect(ctx, r.x, r.y + dy, r.w, r.h, radius);
    ctx.fill();
    ctx.restore();
  }

  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + dy + r.h);
  g.addColorStop(0, state === 'hover' ? '#fff0b0' : C.bananaLight);
  g.addColorStop(0.5, C.banana);
  g.addColorStop(1, C.bananaDeep);
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, radius);
  ctx.fill();

  // Блик по верхней половине — объём без текстур.
  ctx.fillStyle = alpha('#ffffff', 0.35);
  roundRect(ctx, r.x + 12, r.y + dy + 8, r.w - 24, r.h * 0.34, radius * 0.7);
  ctx.fill();

  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.min(44, r.h * 0.42));
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 + 1);
}

/** Второстепенная кнопка: тёмная, читается как «не сюда в первую очередь». */
export function secondaryButton(
  ctx: CanvasRenderingContext2D, r: Rect, label: string, state: ButtonState,
): void {
  const pressed = state === 'press';
  const dy = pressed ? 5 : 0;

  ctx.fillStyle = alpha(C.abyss, 0.65);
  roundRect(ctx, r.x, r.y + 5, r.w, r.h, M.uiRadius);
  ctx.fill();

  ctx.fillStyle = state === 'hover'
    ? alpha(C.jungle, 0.98)
    : alpha(C.canopyMid, 0.95);
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, M.uiRadius);
  ctx.fill();

  ctx.strokeStyle = alpha(C.leaf, state === 'hover' ? 0.9 : 0.5);
  ctx.lineWidth = 2.5;
  roundRect(ctx, r.x + 1.5, r.y + dy + 1.5, r.w - 3, r.h - 3, M.uiRadius - 1);
  ctx.stroke();

  ctx.fillStyle = C.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.min(34, r.h * 0.38));
  ctx.fillText(label, r.x + r.w / 2, r.y + dy + r.h / 2 + 1);
}

export type IconName =
  | 'pause' | 'play' | 'home' | 'question' | 'close' | 'trophy'
  | 'sound' | 'muted' | 'cart' | 'list' | 'medal';

/** Круглая иконочная кнопка. Зона нажатия расширяется в hit(), см. выше. */
export function iconButton(
  ctx: CanvasRenderingContext2D, r: Rect, icon: IconName, state: ButtonState,
): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + (state === 'press' ? 4 : 0);
  const rad = r.w / 2;

  ctx.fillStyle = alpha(C.abyss, 0.6);
  ctx.beginPath();
  ctx.arc(cx, r.y + r.h / 2 + 5, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = state === 'hover' ? alpha(C.jungle, 0.98) : alpha(C.canopyMid, 0.95);
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = alpha(C.leaf, state === 'hover' ? 0.9 : 0.55);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rad - 1.5, 0, Math.PI * 2);
  ctx.stroke();

  drawIcon(ctx, icon, cx, cy, rad * 0.86);
}

function drawIcon(
  ctx: CanvasRenderingContext2D, icon: IconName, cx: number, cy: number, s: number,
): void {
  ctx.save();
  ctx.fillStyle = C.paper;
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (icon) {
    case 'pause':
      roundRect(ctx, cx - s * 0.32, cy - s * 0.42, s * 0.22, s * 0.84, s * 0.08);
      ctx.fill();
      roundRect(ctx, cx + s * 0.1, cy - s * 0.42, s * 0.22, s * 0.84, s * 0.08);
      ctx.fill();
      break;
    case 'play':
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.26, cy - s * 0.42);
      ctx.lineTo(cx + s * 0.42, cy);
      ctx.lineTo(cx - s * 0.26, cy + s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    case 'home':
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.46);
      ctx.lineTo(cx + s * 0.48, cy - s * 0.02);
      ctx.lineTo(cx + s * 0.32, cy - s * 0.02);
      ctx.lineTo(cx + s * 0.32, cy + s * 0.44);
      ctx.lineTo(cx - s * 0.32, cy + s * 0.44);
      ctx.lineTo(cx - s * 0.32, cy - s * 0.02);
      ctx.lineTo(cx - s * 0.48, cy - s * 0.02);
      ctx.closePath();
      ctx.fill();
      break;
    case 'question':
      ctx.font = font(s * 1.25);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy + s * 0.04);
      break;
    case 'close':
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.34, cy - s * 0.34);
      ctx.lineTo(cx + s * 0.34, cy + s * 0.34);
      ctx.moveTo(cx + s * 0.34, cy - s * 0.34);
      ctx.lineTo(cx - s * 0.34, cy + s * 0.34);
      ctx.stroke();
      break;
    case 'cart': {
      // Корзина: трапеция с ручкой. Узнаётся силуэтом, поэтому детали лишние.
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.44, cy - s * 0.12);
      ctx.lineTo(cx + s * 0.44, cy - s * 0.12);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.42);
      ctx.lineTo(cx - s * 0.3, cy + s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.14, s * 0.24, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'list': {
      // Список: три строки с маркерами.
      for (let i = -1; i <= 1; i++) {
        const y = cy + i * s * 0.28;
        ctx.beginPath();
        ctx.arc(cx - s * 0.34, y, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.16, y);
        ctx.lineTo(cx + s * 0.4, y);
        ctx.stroke();
      }
      break;
    }
    case 'medal': {
      // Ленты — тонкими штрихами и ВЫШЕ диска, а не залитыми треугольниками
      // вплотную к нему: сплошные фигуры одного цвета сливались в одно пятно,
      // и иконка читалась как клык, а не как медаль.
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.24, cy - s * 0.46);
      ctx.lineTo(cx - s * 0.1, cy - s * 0.16);
      ctx.moveTo(cx + s * 0.24, cy - s * 0.46);
      ctx.lineTo(cx + s * 0.1, cy - s * 0.16);
      ctx.stroke();
      // Диск обводкой: внутри остаётся «дырка», по которой круг опознаётся
      // даже в 24 px.
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.16, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.16, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sound':
    case 'muted': {
      // Корпус динамика общий, различаются только волны и перечёркивание —
      // так две иконки читаются как одно состояние, а не как две кнопки.
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy - s * 0.16);
      ctx.lineTo(cx - s * 0.22, cy - s * 0.16);
      ctx.lineTo(cx + s * 0.02, cy - s * 0.44);
      ctx.lineTo(cx + s * 0.02, cy + s * 0.44);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.16);
      ctx.lineTo(cx - s * 0.42, cy + s * 0.16);
      ctx.closePath();
      ctx.fill();
      if (icon === 'sound') {
        for (let i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(cx + s * 0.04, cy, s * (0.12 + i * 0.16), -0.9, 0.9);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.18, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.5, cy + s * 0.2);
        ctx.moveTo(cx + s * 0.5, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.18, cy + s * 0.2);
        ctx.stroke();
      }
      break;
    }
    case 'trophy':
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.3, cy - s * 0.4);
      ctx.lineTo(cx + s * 0.22, cy + s * 0.06);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - s * 0.08, cy + s * 0.06, s * 0.16, s * 0.24);
      roundRect(ctx, cx - s * 0.26, cy + s * 0.3, s * 0.52, s * 0.14, s * 0.06);
      ctx.fill();
      break;
  }
  ctx.restore();
}

/**
 * Чип статистики — тёмная скруглённая плашка с подписью и значением.
 * Используется в HUD, где текст лежит поверх пёстрого фона: без подложки
 * счёт теряется на листве.
 */
export function chip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, label: string, value: string,
  align: 'left' | 'right' = 'left',
): Rect {
  ctx.font = font(30);
  const labelW = ctx.measureText(label).width;
  ctx.font = font(34);
  const valueW = ctx.measureText(value).width;
  const w = labelW + valueW + 58;
  const h = 58;
  const rx = align === 'left' ? x : x - w;

  ctx.fillStyle = alpha(C.abyss, 0.5);
  roundRect(ctx, rx, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = alpha(C.leaf, 0.35);
  ctx.lineWidth = 2;
  roundRect(ctx, rx + 1, y + 1, w - 2, h - 2, h / 2);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.paperDim;
  ctx.font = font(30, 'normal');
  ctx.fillText(label, rx + 24, y + h / 2 + 1);
  ctx.fillStyle = C.gold;
  ctx.font = font(34);
  ctx.fillText(value, rx + 24 + labelW + 12, y + h / 2 + 1);

  return { x: rx, y, w, h };
}

/**
 * Заголовок-вывеска: табличка из тёмной зелени с золотым текстом.
 * Плашка нужна, чтобы название читалось поверх любого биома — на закатном
 * небе голый золотой текст пропадал бы.
 */
export function titlePlate(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, maxW: number, text: string,
): Rect {
  const size = Math.min(84, maxW * 0.115);
  ctx.font = font(size);
  const textW = ctx.measureText(text).width;
  const w = Math.min(maxW, textW + 96);
  const h = size * 1.9;
  const r = { x: cx - w / 2, y: cy - h / 2, w, h };

  ctx.save();
  ctx.shadowColor = alpha(C.abyss, 0.5);
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + h);
  g.addColorStop(0, mix(C.canopyMid, C.jungle, 0.4));
  g.addColorStop(1, C.canopyDeep);
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y, w, h, 28);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = alpha(C.gold, 0.75);
  ctx.lineWidth = 3;
  roundRect(ctx, r.x + 2, r.y + 2, w - 4, h - 4, 26);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(size);
  // Тень под буквами: золото на зелени иначе «звенит» по краю.
  ctx.fillStyle = alpha(C.abyss, 0.6);
  ctx.fillText(text, cx, cy + 4);
  const tg = ctx.createLinearGradient(0, cy - size * 0.6, 0, cy + size * 0.6);
  tg.addColorStop(0, C.bananaPale);
  tg.addColorStop(0.55, C.gold);
  tg.addColorStop(1, C.bananaDeep);
  ctx.fillStyle = tg;
  ctx.fillText(text, cx, cy);

  return r;
}

/** Затемнение под модальным окном — фокус на панели, а не на игре под ней. */
export function scrim(ctx: CanvasRenderingContext2D, w: number, h: number, a = 0.68): void {
  ctx.fillStyle = alpha(C.abyss, a);
  ctx.fillRect(0, 0, w, h);
}
