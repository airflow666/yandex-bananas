/**
 * Разделы меню: магазин, задания, награды, таблица рекордов.
 *
 * Все четыре — один и тот же каркас: заголовок, вертикальный список строк,
 * кнопка «назад». Это не экономия кода, а UX-решение: игрок учится читать
 * такой экран один раз, и дальше все разделы для него уже знакомы. Разница
 * между ними только в содержимом строки и в том, есть ли у неё действие.
 *
 * Списки намеренно НЕ прокручиваются. Прокрутка на канвасе требует своей
 * инерции, полос и обработки жеста, который конфликтует с игровым тапом.
 * Вместо этого число строк в каждом разделе подобрано так, чтобы список
 * целиком помещался на экран телефона: шесть скинов, три задания, десять
 * строк таблицы. Достижений десять — они идут в две колонки на широком
 * экране и мельче на узком.
 */

import { C, alpha, font } from '../art/theme';
import type { Layout } from '../core/layout';
import { t, tf, type Key } from '../i18n';
import {
  ACHIEVEMENTS, isMissionClaimed, isMissionDone, missionsForDay,
  type Mission, type ProgressData,
} from '../game/progress';
import { SKINS } from '../game/skins';
import type { LeaderboardRow } from '../platform/yandex';
import { drawSprite } from '../art/svgRaster';
import { BANANA_KEYS } from '../art/sprites';
import { panel, rect, roundRect, scrim, type Rect } from './widgets';

/** Раздел, открытый поверх меню. */
export type PanelScreen = 'shop' | 'missions' | 'awards' | 'leaderboard';

/** Геометрия списка: одна на раскладку и на хит-тест — разъехаться не могут. */
export interface ListGeometry {
  panelRect: Rect;
  rowH: number;
  firstRowY: number;
  rowX: number;
  rowW: number;
  /** Кнопка действия в строке — справа, фиксированной ширины. */
  actionW: number;
}

/**
 * Геометрия раздела. ОДНА точка входа и для отрисовки, и для хит-теста —
 * иначе подвал приходится вычислять дважды и он расходится.
 */
export function panelGeometry(
  L: Layout, screen: PanelScreen, lb: LeaderboardRow[] | null, _online: boolean,
): ListGeometry {
  return listGeometry(L, rowCount(screen, lb));
}

export function listGeometry(L: Layout, rows: number): ListGeometry {
  const w = Math.min(760, L.width * 0.94);
  const rowH = Math.min(96, Math.max(70, (L.height * 0.52) / Math.max(1, rows)));
  const headerH = 120;
  const footerH = 130;
  const h = Math.min(L.height * 0.86, headerH + rows * rowH + footerH);
  const x = L.centerX - w / 2;
  const y = (L.height - h) / 2;
  const pad = Math.min(28, w * 0.045);
  return {
    panelRect: rect(x, y, w, h),
    rowH,
    firstRowY: y + headerH,
    rowX: x + pad,
    rowW: w - pad * 2,
    actionW: Math.min(190, w * 0.3),
  };
}

/**
 * Прямоугольник кнопки действия в строке i.
 *
 * В заданиях кнопка стоит НИЖЕ середины — на одной линии с полосой
 * прогресса. Это освобождает верхнюю линию строки целиком под описание:
 * когда описание делило ширину с кнопкой, на телефоне от него оставалось
 * ~200 единиц, и текст приходилось резать многоточием до нечитаемого.
 * Бегущая строка эту задачу не решает — прочитать её нельзя сразу, надо
 * ждать прокрутки, а движение рядом со статичным списком отвлекает.
 */
export function rowActionRect(
  g: ListGeometry, i: number, align: 'center' | 'bottom' = 'center',
): Rect {
  const h = Math.min(64, g.rowH - 16);
  const top = g.firstRowY + i * g.rowH;
  const y = align === 'bottom'
    ? top + g.rowH * 0.62 - h / 2 + 6
    : top + (g.rowH - h) / 2;
  return rect(g.rowX + g.rowW - g.actionW, y, g.actionW, h);
}

/** Сколько строк в разделе — нужно и раскладке, и хит-тесту. */
export function rowCount(screen: PanelScreen, lb: LeaderboardRow[] | null): number {
  switch (screen) {
    case 'shop': return SKINS.length;
    case 'missions': return 3;
    case 'awards': return ACHIEVEMENTS.length;
    case 'leaderboard': return Math.max(1, Math.min(10, lb?.length ?? 1));
  }
}

// ---------------------------------------------------------------- отрисовка

export interface PanelData {
  progress: ProgressData;
  leaderboard: LeaderboardRow[] | null;
  leaderboardLoading: boolean;
  /** Платформа вообще умеет таблицу — на локальной сборке нет. */
  online: boolean;
}

export function drawPanel(
  ctx: CanvasRenderingContext2D, L: Layout, screen: PanelScreen, data: PanelData,
): void {
  const g = panelGeometry(L, screen, data.leaderboard, data.online);
  scrim(ctx, L.width, L.height, 0.72);
  panel(ctx, g.panelRect);

  const titleKey: Key = screen === 'shop' ? 'shopTitle'
    : screen === 'missions' ? 'missionsTitle'
      : screen === 'awards' ? 'awardsTitle' : 'leaderboardTitle';

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.gold;
  ctx.font = font(46);
  ctx.fillText(t(titleKey), L.centerX, g.panelRect.y + 54);

  // Баланс бананов виден в магазине всегда: решение о покупке принимается
  // здесь, и уходить за цифрой в другой экран — плохо.
  if (screen === 'shop') {
    ctx.fillStyle = C.bananaLight;
    ctx.font = font(30);
    ctx.fillText(`${t('coins')}: ${data.progress.coins}`, L.centerX, g.panelRect.y + 94);
  } else if (screen === 'missions') {
    ctx.fillStyle = alpha(C.paperDim, 0.8);
    ctx.font = font(26, 'normal');
    ctx.fillText(t('missionsHint'), L.centerX, g.panelRect.y + 94);
  }
  ctx.restore();

  switch (screen) {
    case 'shop': drawShopRows(ctx, g, data.progress); break;
    case 'missions': drawMissionRows(ctx, g, data.progress); break;
    case 'awards': drawAwardRows(ctx, g, data.progress); break;
    case 'leaderboard': drawLeaderboardRows(ctx, g, data); break;
  }
}

/** Подложка строки — чередование, чтобы длинный список читался. */
function rowPlate(ctx: CanvasRenderingContext2D, g: ListGeometry, i: number): number {
  const y = g.firstRowY + i * g.rowH;
  ctx.save();
  ctx.fillStyle = alpha(C.abyss, i % 2 === 0 ? 0.28 : 0.16);
  roundRect(ctx, g.rowX, y + 4, g.rowW, g.rowH - 8, 16);
  ctx.fill();
  ctx.restore();
  return y;
}

/** Текст действия в строке: сама кнопка рисуется поверх в screens.ts. */
function actionPill(
  ctx: CanvasRenderingContext2D, r: Rect, label: string,
  tone: 'gold' | 'muted' | 'done', coin = false,
): void {
  ctx.save();
  const fill = tone === 'gold' ? C.gold : tone === 'done' ? alpha(C.jungle, 0.5) : alpha(C.abyss, 0.45);
  ctx.fillStyle = fill;
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.fillStyle = tone === 'gold' ? C.abyss : alpha(C.paperDim, 0.9);
  ctx.font = font(26);
  ctx.textBaseline = 'middle';
  const cy = r.y + r.h / 2;

  if (!coin) {
    ctx.textAlign = 'center';
    ctx.fillText(label, r.x + r.w / 2, cy);
    ctx.restore();
    return;
  }

  // Значок валюты — СВОЙ спрайт, а не эмодзи 🍌: отрисовка эмодзи зависит от
  // системного шрифта, а внешние шрифты в проекте запрещены. На части
  // устройств вместо банана вышел бы пустой квадрат.
  const gap = 6;
  // Внутренние поля плашки: без них банан вылезал за её скруглённый край.
  const inner = r.w - 20;
  const textW = ctx.measureText(label).width;
  // Значок ужимается, если пара «число + банан» не влезает: на телефоне
  // плашка узкая, и приоритет у числа — цену надо прочитать.
  const icon = Math.max(14, Math.min(r.h * 0.6, inner - textW - gap));
  const startX = r.x + (r.w - textW - gap - icon) / 2;
  ctx.textAlign = 'left';
  ctx.fillText(label, startX, cy);
  ctx.restore();
  drawSprite(ctx, BANANA_KEYS.golden, startX + textW + gap + icon / 2, cy, icon, {
    rotation: -0.5,
  });
}

function drawShopRows(
  ctx: CanvasRenderingContext2D, g: ListGeometry, p: ProgressData,
): void {
  SKINS.forEach((skin, i) => {
    const y = rowPlate(ctx, g, i);
    const cy = y + g.rowH / 2;

    // Образец цвета: покупают глазами, а не по названию.
    const sw = Math.min(52, g.rowH - 26);
    ctx.save();
    ctx.fillStyle = skin.tint ?? C.bark;
    roundRect(ctx, g.rowX + 14, cy - sw / 2, sw, sw, 10);
    ctx.fill();
    ctx.strokeStyle = alpha(C.abyss, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = C.paper;
    ctx.font = font(30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(t(skin.key as Key), g.rowX + sw + 30, cy);
    ctx.restore();

    const owned = p.ownedSkins.includes(skin.id);
    const equipped = p.skin === skin.id;
    const r = rowActionRect(g, i);
    if (equipped) actionPill(ctx, r, t('equipped'), 'done');
    else if (owned) actionPill(ctx, r, t('equip'), 'gold');
    else actionPill(ctx, r, String(skin.price), p.coins >= skin.price ? 'gold' : 'muted', true);
  });
}

/** Описание задания одной строкой — подстановка, а не склейка. */
export function missionText(m: Mission): string {
  const key: Key = m.kind === 'floors' ? 'missionFloors'
    : m.kind === 'coins' ? 'missionCoins'
      : m.kind === 'streak' ? 'missionStreak'
        : m.kind === 'perfects' ? 'missionPerfects' : 'missionRuns';
  return tf(key, { n: m.goal });
}

function drawMissionRows(
  ctx: CanvasRenderingContext2D, g: ListGeometry, p: ProgressData,
): void {
  const missions = missionsForDay(p.missionDay);
  missions.forEach((m, i) => {
    const y = rowPlate(ctx, g, i);
    const done = isMissionDone(p, i);
    const claimed = isMissionClaimed(p, i);
    const progress = Math.min(m.goal, p.missionProgress[i] ?? 0);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = claimed ? alpha(C.paperDim, 0.55) : C.paper;

    // Описание занимает ВСЮ ширину строки — кнопка ушла на линию ниже.
    // Кегль подбирается под фактическую ширину: сузить шрифт на пару пунктов
    // лучше, чем обрезать смысл. Многоточие остаётся только страховкой на
    // совсем узких экранах.
    const full = missionText(m);
    const avail = g.rowW - 36;
    let size = 26;
    ctx.font = font(size, 'normal');
    while (size > 19 && ctx.measureText(full).width > avail) {
      size -= 1;
      ctx.font = font(size, 'normal');
    }
    ctx.fillText(clipText(ctx, full, avail), g.rowX + 18, y + g.rowH * 0.3);

    // Полоса прогресса: числом «12/30» цель не чувствуется, полосой — да.
    ctx.font = font(21, 'normal');
    const counter = `${progress} / ${m.goal}`;
    const counterW = ctx.measureText(counter).width;
    const textLimit = g.rowW - g.actionW - 20;
    const barW = Math.max(40, textLimit - 18 - counterW - 12);
    const barY = y + g.rowH * 0.62;

    ctx.fillStyle = alpha(C.abyss, 0.5);
    roundRect(ctx, g.rowX + 18, barY, barW, 12, 6);
    ctx.fill();
    ctx.fillStyle = done ? C.gold : C.jungleLit;
    roundRect(ctx, g.rowX + 18, barY, barW * (progress / m.goal), 12, 6);
    ctx.fill();

    ctx.fillStyle = alpha(C.paperDim, 0.85);
    ctx.textAlign = 'right';
    ctx.fillText(counter, g.rowX + textLimit, barY + 6);
    ctx.restore();

    const r = rowActionRect(g, i, 'bottom');
    if (claimed) actionPill(ctx, r, t('claimed'), 'done');
    else if (done) actionPill(ctx, r, `+${m.reward}`, 'gold', true);
    else actionPill(ctx, r, String(m.reward), 'muted', true);
  });
}

function drawAwardRows(
  ctx: CanvasRenderingContext2D, g: ListGeometry, p: ProgressData,
): void {
  ACHIEVEMENTS.forEach((a, i) => {
    const y = rowPlate(ctx, g, i);
    const cy = y + g.rowH / 2;
    const got = p.achievements.includes(a.id);
    const value = Math.min(a.goal, a.measure(p));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = got ? C.gold : alpha(C.paper, 0.85);
    ctx.font = font(25, got ? 'bold' : 'normal');
    // Награда справа занимает свою зону — описание обрезаем по остатку.
    ctx.fillText(clipText(ctx, t(a.key as Key), g.rowW - 150), g.rowX + 18, cy - 12);

    ctx.fillStyle = alpha(C.paperDim, 0.7);
    ctx.font = font(21, 'normal');
    ctx.fillText(`${value} / ${a.goal}`, g.rowX + 18, cy + 16);

    // Награда справа: галочка, если получена, иначе сумма.
    ctx.textAlign = 'right';
    ctx.fillStyle = got ? C.gold : alpha(C.bananaLight, 0.6);
    ctx.font = font(26);
    ctx.fillText(got ? '✓' : `+${a.reward}`, g.rowX + g.rowW - 18, cy);
    ctx.restore();
  });
}

function drawLeaderboardRows(
  ctx: CanvasRenderingContext2D, g: ListGeometry, data: PanelData,
): void {
  const rows = data.leaderboard;

  if (!rows || rows.length === 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = alpha(C.paperDim, 0.8);
    ctx.font = font(28, 'normal');
    const message = data.leaderboardLoading ? t('loading')
      : data.online ? t('leaderboardEmpty') : t('leaderboardOffline');
    ctx.fillText(message, g.panelRect.x + g.panelRect.w / 2, g.firstRowY + g.rowH / 2);
    ctx.restore();
    return;
  }

  rows.slice(0, 10).forEach((row, i) => {
    const y = rowPlate(ctx, g, i);
    const cy = y + g.rowH / 2;
    ctx.save();
    ctx.textBaseline = 'middle';
    // Своя строка подсвечена: в таблице из десяти имён игрок ищет себя, и
    // заставлять его читать все — плохой интерфейс.
    ctx.fillStyle = row.isPlayer ? C.gold : alpha(C.paperDim, 0.9);
    ctx.font = font(26, row.isPlayer ? 'bold' : 'normal');
    ctx.textAlign = 'right';
    ctx.fillText(String(row.rank), g.rowX + 46, cy);
    ctx.textAlign = 'left';
    // Подпись «(Вы)» добавляется только если имя ей не равно: у
    // неавторизованного игрока имени нет, и подставляется то же самое слово —
    // получалось «Вы (Вы)». Своя строка и так выделена золотом.
    const you = t('you');
    const name = row.isPlayer && row.name !== you ? `${row.name} (${you})` : row.name;
    ctx.fillText(clipText(ctx, name, g.rowW - 200), g.rowX + 64, cy);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.bananaLight;
    ctx.fillText(String(row.score), g.rowX + g.rowW - 18, cy);
    ctx.restore();
  });
}

/** Обрезка длинного имени многоточием — иначе оно налезет на счёт. */
function clipText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}
