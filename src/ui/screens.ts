/**
 * Экраны интерфейса: меню, HUD, пауза, обучение, итоги забега.
 *
 * Раскладка и отрисовка намеренно РАЗДЕЛЕНЫ. `screenButtons()` — чистая
 * функция от раскладки и состояния; её вызывает и симуляция (чтобы понять,
 * куда попал палец), и рендер (чтобы нарисовать). Держать координаты кнопок
 * в двух местах — верный способ получить кнопку, которая выглядит здесь, а
 * нажимается там.
 *
 * UX-каркас каждого экрана одинаков: заголовок → одно главное действие →
 * второстепенные → справка. Игрок никогда не выбирает между двумя одинаково
 * выглядящими кнопками.
 */

import { C, M, alpha, font } from '../art/theme';
import { drawSprite } from '../art/svgRaster';
import { BANANA_KEYS } from '../art/sprites';
import type { Layout } from '../core/layout';
import { t, type Key } from '../i18n';
import type { Session } from '../game/session';
import type { GameMode } from '../game/modes';
import type { ProgressData } from '../game/progress';
import { isStormUnlocked } from '../game/progress';
import type { LeaderboardRow } from '../platform/yandex';
import {
  drawPanel, panelGeometry, rowActionRect, rowCount, type PanelScreen,
} from './panels';
import {
  centered, chip, hit, iconButton, panel, primaryButton, rect, roundRect,
  scrim, secondaryButton, titlePlate,
  type ButtonState, type IconName, type Rect,
} from './widgets';

export type UiAction =
  | 'play' | 'retry' | 'menu' | 'pause' | 'resume' | 'howto' | 'close' | 'sound'
  | 'shop' | 'missions' | 'awards' | 'leaderboard'
  | 'mode' | 'row' | 'double' | 'bonus';

export interface UiButton {
  id: UiAction;
  r: Rect;
  kind: 'primary' | 'secondary' | 'icon';
  label?: Key;
  icon?: IconName;
  /** Номер строки списка — только у id === 'row'. */
  index?: number;
  /** Нарисовать кнопку отдельно не нужно: строка уже отрисована списком. */
  invisible?: boolean;
}

/** Что открыто поверх меню. 'none' — сам экран. */
export type Overlay = 'none' | 'howto' | PanelScreen;

export interface UiState {
  paused: boolean;
  overlay: Overlay;
  /** Выбранный режим — переключается в меню, применяется при старте забега. */
  mode: GameMode;
  best: number;
  bestStorm: number;
  /** Рекорд побит именно в этом забеге — для плашки на экране итогов. */
  isRecord: boolean;
  /** Звук выключен игроком. Настройка переживает перезагрузку. */
  muted: boolean;
  /** Весь мета-прогресс: разделы читают его напрямую, копий не делаем. */
  progress: ProgressData;
  leaderboard: LeaderboardRow[] | null;
  leaderboardLoading: boolean;
  online: boolean;
  /** Награда за забег ещё не удвоена и реклама доступна. */
  canDouble: boolean;
  /** Короткое всплывающее сообщение: «не хватает бананов», «бонус получен». */
  toast: Key | null;
  toastUntil: number;
}

/** Ширина модальной панели: на телефоне почти во весь экран, на десктопе — нет. */
function panelWidth(L: Layout): number {
  return Math.min(760, L.width * 0.88);
}

/**
 * Кнопки текущего экрана. Порядок важен: попадание проверяется с конца,
 * поэтому то, что нарисовано поверх, и перехватывает нажатие.
 */
export function screenButtons(L: Layout, s: Session, ui: UiState): UiButton[] {
  // Обучение — модальное окно: пока оно открыто, доступна только его кнопка.
  if (ui.overlay === 'howto') {
    const w = panelWidth(L);
    return [{
      id: 'close',
      r: centered(L.centerX, L.height * 0.69, Math.min(340, w * 0.6), 96),
      kind: 'primary',
      label: 'close',
    }];
  }

  // Раздел поверх меню: строки списка кликабельны, плюс «назад».
  if (ui.overlay !== 'none') {
    const screen = ui.overlay;
    const n = rowCount(screen, ui.leaderboard);
    const g = panelGeometry(L, screen, ui.leaderboard, ui.online);
    const out: UiButton[] = [];

    // Строки: невидимые кнопки поверх уже отрисованного списка — так
    // раскладка строки описана ровно один раз, в panels.ts.
    if (screen === 'shop' || screen === 'missions') {
      // Выравнивание обязано совпадать с отрисовкой — иначе кнопка выглядит
      // в одном месте, а нажимается в другом.
      const align = screen === 'missions' ? 'bottom' : 'center';
      for (let i = 0; i < n; i++) {
        out.push({
          id: 'row', index: i, kind: 'icon', invisible: true,
          r: rowActionRect(g, i, align),
        });
      }
    }
    out.push({
      id: 'close',
      r: centered(L.centerX, g.panelRect.y + g.panelRect.h - 52, Math.min(300, g.panelRect.w * 0.5), 76),
      kind: 'primary',
      label: 'close',
    });
    return out;
  }

  // Кнопка звука доступна на каждом экране, кроме модальных: игрок должен
  // мочь заглушить игру в любой момент, а не только из меню.
  const soundBtn: UiButton = {
    id: 'sound',
    r: rect(L.padX, L.padY, 68, 68),
    kind: 'icon',
    icon: ui.muted ? 'muted' : 'sound',
  };

  if (s.phase === 'menu') {
    const bw = Math.min(420, L.width * 0.7);
    const out: UiButton[] = [
      soundBtn,
      // Переключатель режима — ОДНА кнопка, а не две: два одинаковых
      // прямоугольника рядом читаются как «выбери одно из двух действий»,
      // а здесь это состояние, и его надо показывать, а не предлагать.
      {
        id: 'mode',
        r: centered(L.centerX, L.height * 0.44, bw * 0.86, 76),
        kind: 'secondary',
        label: ui.mode === 'storm' ? 'modeStorm' : 'modeClassic',
      },
      {
        id: 'play',
        r: centered(L.centerX, L.height * 0.56, bw, 118),
        kind: 'primary',
        label: 'play',
      },
      {
        id: 'howto',
        r: centered(L.centerX, L.height * 0.68, bw * 0.78, 76),
        kind: 'secondary',
        label: 'howToPlay',
      },
    ];

    // Нижний ряд разделов: иконки, потому что четыре текстовые кнопки в
    // ряд не помещаются на телефоне, а в столбик — отодвигают «Играть».
    const navIcons: [UiAction, IconName][] = [
      ['shop', 'cart'], ['missions', 'list'], ['awards', 'medal'], ['leaderboard', 'trophy'],
    ];
    const gap = Math.min(28, L.width * 0.04);
    const size = 84;
    const totalW = navIcons.length * size + (navIcons.length - 1) * gap;
    const startX = L.centerX - totalW / 2;
    navIcons.forEach(([id, icon], i) => {
      out.push({
        id,
        r: rect(startX + i * (size + gap), L.height * 0.83, size, size),
        kind: 'icon',
        icon,
      });
    });
    return out;
  }

  if (s.phase === 'over') {
    const w = panelWidth(L);
    const bw = Math.min(380, w * 0.72);
    const out: UiButton[] = [soundBtn];
    // Награда за рекламу — только если есть что удваивать и реклама реально
    // доступна. Кнопка, которая ничего не делает, хуже её отсутствия.
    if (ui.canDouble && s.coins > 0) {
      out.push({
        id: 'double',
        r: centered(L.centerX, L.height * 0.6, bw, 96),
        kind: 'primary',
        label: 'doubleReward',
      });
      out.push({
        id: 'retry',
        r: centered(L.centerX, L.height * 0.72, bw * 0.86, 88),
        kind: 'secondary',
        label: 'retry',
      });
      out.push({
        id: 'menu',
        r: centered(L.centerX, L.height * 0.82, bw * 0.7, 74),
        kind: 'secondary',
        label: 'menu',
      });
      return out;
    }
    out.push({
      id: 'retry',
      r: centered(L.centerX, L.height * 0.63, bw, 112),
      kind: 'primary',
      label: 'retry',
    });
    out.push({
      id: 'menu',
      r: centered(L.centerX, L.height * 0.76, bw * 0.8, 82),
      kind: 'secondary',
      label: 'menu',
    });
    return out;
  }

  // phase === 'playing'
  if (ui.paused) {
    const bw = Math.min(380, L.width * 0.66);
    return [
      soundBtn,
      {
        id: 'resume',
        r: centered(L.centerX, L.height * 0.52, bw, 112),
        kind: 'primary',
        label: 'resume',
      },
      {
        id: 'menu',
        r: centered(L.centerX, L.height * 0.66, bw * 0.8, 82),
        kind: 'secondary',
        label: 'menu',
      },
    ];
  }

  return [{
    id: 'pause',
    r: rect(L.width - L.padX - 68, L.padY, 68, 68),
    kind: 'icon',
    icon: 'pause',
  }];
}

/** Кнопка под точкой, если она там есть. Проверка с конца — сверху вниз по слоям. */
export function buttonAt(buttons: UiButton[], x: number, y: number): UiButton | null {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i] as UiButton;
    if (hit(b.r, x, y)) return b;
  }
  return null;
}

// ---------------------------------------------------------------- отрисовка

export interface PointerUi {
  x: number;
  y: number;
  /** Кнопка, на которой было начато нажатие и палец с неё ещё не ушёл. */
  pressed: UiAction | null;
  /** Наведение — только на устройствах с курсором. */
  hovered: UiAction | null;
}

function stateOf(b: UiButton, p: PointerUi): ButtonState {
  if (p.pressed === b.id) return 'press';
  if (p.hovered === b.id) return 'hover';
  return 'idle';
}

export function drawUi(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout,
  ui: UiState, p: PointerUi, coins: number,
): void {
  if (s.phase === 'menu') drawMenu(ctx, s, L, ui);
  // На паузе HUD не рисуем: под затемнением он всё равно нечитаем, а кнопка
  // звука встаёт ровно на место чипа с этажами.
  if (s.phase === 'playing' && !ui.paused) drawHud(ctx, s, L, coins);
  if (s.phase === 'playing' && ui.paused) drawPause(ctx, L);
  if (s.phase === 'over') drawGameOver(ctx, s, L, ui, coins);
  if (ui.overlay === 'howto') drawHowto(ctx, L);
  else if (ui.overlay !== 'none') {
    drawPanel(ctx, L, ui.overlay, {
      progress: ui.progress,
      leaderboard: ui.leaderboard,
      leaderboardLoading: ui.leaderboardLoading,
      online: ui.online,
    });
  }

  for (const b of screenButtons(L, s, ui)) {
    if (b.invisible) continue;
    const st = stateOf(b, p);
    if (b.kind === 'primary') primaryButton(ctx, b.r, t(b.label as Key), st);
    else if (b.kind === 'secondary') secondaryButton(ctx, b.r, t(b.label as Key), st);
    else iconButton(ctx, b.r, b.icon as IconName, st);
  }

  drawToast(ctx, L, ui);
}

/**
 * Короткое сообщение внизу экрана. Нужно там, где действие НЕ происходит:
 * нажал «купить», а бананов не хватило — без ответа это выглядит как
 * сломанная кнопка.
 */
function drawToast(ctx: CanvasRenderingContext2D, L: Layout, ui: UiState): void {
  if (!ui.toast) return;
  const left = ui.toastUntil - performance.now();
  if (left <= 0) return;
  // Последние 300 мс — плавное угасание, иначе сообщение «моргает».
  const a = Math.min(1, left / 300);

  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(28);
  const text = t(ui.toast);
  const w = ctx.measureText(text).width + 64;
  const y = L.height * 0.92;
  ctx.fillStyle = alpha(C.abyss, 0.85);
  roundRect(ctx, L.centerX - w / 2, y - 30, w, 60, 30);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.fillText(text, L.centerX, y);
  ctx.restore();
}

// -------------------------------------------------------------------- меню

function drawMenu(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, ui: UiState,
): void {
  // Лёгкое затемнение: меню читается поверх живого фона, но фон остаётся виден —
  // игрок сразу видит, во что играет.
  scrim(ctx, L.width, L.height, 0.3);

  const plate = titlePlate(ctx, L.centerX, L.height * 0.2, L.width * 0.88, t('title'));

  // Бананы по углам вывески — герой игры на титуле, а не абстрактный текст.
  const bs = Math.min(140, plate.w * 0.24);
  drawSprite(ctx, BANANA_KEYS.golden, plate.x + 6, plate.y + plate.h - 6, bs, {
    rotation: -0.5,
  });
  drawSprite(ctx, BANANA_KEYS.fresh, plate.x + plate.w - 6, plate.y + 4, bs * 0.85, {
    rotation: 2.7, flip: true,
  });

  // Бананы в правом верхнем углу: валюта должна быть видна там, где её
  // тратят, иначе игрок не знает, зачем идти в магазин.
  chip(ctx, L.width - L.padX - 84, L.padY, t('coins'), String(ui.progress.coins), 'right');

  const stormOn = ui.mode === 'storm';
  const best = stormOn ? ui.bestStorm : ui.best;
  if (best > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    const label = `${t('best')}: ${best}`;
    ctx.font = font(34);
    const w = ctx.measureText(label).width + 56;
    const y = L.height * 0.33;
    ctx.fillStyle = alpha(C.abyss, 0.5);
    roundRect(ctx, L.centerX - w / 2, y, w, 60, 30);
    ctx.fill();
    ctx.strokeStyle = alpha(C.gold, 0.5);
    ctx.lineWidth = 2;
    roundRect(ctx, L.centerX - w / 2 + 1, y + 1, w - 2, 58, 29);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, L.centerX, y + 31);
    ctx.restore();
  }

  // Пояснение под переключателем режима: что именно выбрано и чем оно
  // отличается. Заперт режим — сказано, как открыть, а не просто «нельзя».
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(24, 'normal');
  const unlocked = isStormUnlocked(ui.progress);
  ctx.fillStyle = alpha(stormOn && !unlocked ? C.danger : C.paperDim, 0.85);
  const hint = !stormOn ? '' : unlocked ? t('stormHint') : t('stormLocked');
  if (hint) ctx.fillText(hint, L.centerX, L.height * 0.49);
  ctx.restore();
}

// --------------------------------------------------------------------- HUD

function drawHud(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, coins: number,
): void {
  chip(ctx, L.padX, L.padY, t('floors'), String(s.tower.floors), 'left');
  // Правый чип уступает место кнопке паузы — они не должны наезжать.
  chip(ctx, L.width - L.padX - 84, L.padY, t('coins'), String(coins), 'right');

  drawWindGauge(ctx, s, L);

  if (s.praise > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.praise * 1.4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = 52 + (1 - s.praise) * 16;
    ctx.font = font(size);
    ctx.fillStyle = alpha(C.abyss, 0.55);
    ctx.fillText(t('perfect'), L.centerX, L.height * 0.28 + 3);
    ctx.fillStyle = C.gold;
    ctx.fillText(t('perfect'), L.centerX, L.height * 0.28);

    if (s.streak > 1) {
      ctx.font = font(34);
      ctx.fillStyle = C.bananaPale;
      ctx.fillText(`×${s.streak}`, L.centerX, L.height * 0.28 + size * 0.82);
    }
    ctx.restore();
  }
}

/**
 * Индикатор ветра. Ветер — вторая ось риска, и до сих пор он был виден
 * только по крену башни, то есть уже постфактум. Стрелка показывает силу и
 * направление ДО того, как порыв качнёт башню, и появляется ровно тогда,
 * когда ветер начинает существовать.
 */
function drawWindGauge(ctx: CanvasRenderingContext2D, s: Session, L: Layout): void {
  const wind = s.tower.wind;
  const mag = Math.min(1, Math.abs(wind) / 0.11);
  if (mag < 0.05) return;

  const cx = L.centerX;
  const y = L.padY + 30;
  const dir = Math.sign(wind) || 1;

  ctx.save();
  ctx.globalAlpha = Math.min(1, mag * 1.3);
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  // Три штриха разной длины — «поток», а не просто стрелка.
  for (let i = 0; i < 3; i++) {
    const len = 26 + i * 16 * mag;
    const oy = y + (i - 1) * 13;
    const phase = Math.sin(s.time * 3 + i) * 5 * mag;
    ctx.globalAlpha = Math.min(1, mag * 1.3) * (0.5 + i * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx - (len / 2) * dir + phase, oy);
    ctx.lineTo(cx + (len / 2) * dir + phase, oy);
    ctx.stroke();
  }

  // Наконечник на среднем штрихе задаёт направление однозначно.
  const tip = cx + (21 + 8 * mag) * dir;
  ctx.globalAlpha = Math.min(1, mag * 1.3);
  ctx.beginPath();
  ctx.moveTo(tip, y);
  ctx.lineTo(tip - 13 * dir, y - 9);
  ctx.moveTo(tip, y);
  ctx.lineTo(tip - 13 * dir, y + 9);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ пауза

function drawPause(ctx: CanvasRenderingContext2D, L: Layout): void {
  scrim(ctx, L.width, L.height, 0.72);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.min(72, L.width * 0.1));
  ctx.fillStyle = alpha(C.abyss, 0.6);
  ctx.fillText(t('paused'), L.centerX, L.height * 0.34 + 4);
  ctx.fillStyle = C.gold;
  ctx.fillText(t('paused'), L.centerX, L.height * 0.34);
  ctx.restore();
}

// ------------------------------------------------------------------ итоги

function drawGameOver(
  ctx: CanvasRenderingContext2D, s: Session, L: Layout, ui: UiState, coins: number,
): void {
  scrim(ctx, L.width, L.height, 0.7);

  const w = panelWidth(L);
  const r = { x: L.centerX - w / 2, y: L.height * 0.2, w, h: L.height * 0.36 };
  panel(ctx, r);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = font(Math.min(56, w * 0.095));
  ctx.fillStyle = C.danger;
  ctx.fillText(t('gameOver'), L.centerX, r.y + r.h * 0.18);

  // Плашка рекорда — единственный элемент экрана с золотой заливкой,
  // поэтому её невозможно не заметить.
  if (ui.isRecord) {
    const label = t('newRecord');
    ctx.font = font(32);
    const bw = ctx.measureText(label).width + 56;
    const by = r.y + r.h * 0.3;
    ctx.fillStyle = C.gold;
    roundRect(ctx, L.centerX - bw / 2, by - 24, bw, 48, 24);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillText(label, L.centerX, by + 1);
  }

  statRow(ctx, L.centerX, r.y + r.h * 0.55, w, t('resultFloors'), String(s.tower.floors));
  statRow(ctx, L.centerX, r.y + r.h * 0.72, w, t('resultBananas'), String(coins));
  statRow(ctx, L.centerX, r.y + r.h * 0.89, w, t('best'), String(ui.best));
  ctx.restore();
}

/** Строка «подпись … значение» с точечным лидером — таблица без сетки. */
function statRow(
  ctx: CanvasRenderingContext2D, cx: number, y: number, panelW: number,
  label: string, value: string,
): void {
  const inset = panelW * 0.12;
  const left = cx - panelW / 2 + inset;
  const right = cx + panelW / 2 - inset;

  ctx.textAlign = 'left';
  ctx.font = font(30, 'normal');
  ctx.fillStyle = C.paperDim;
  ctx.fillText(label, left, y);
  const labelW = ctx.measureText(label).width;

  ctx.textAlign = 'right';
  ctx.font = font(38);
  ctx.fillStyle = C.gold;
  ctx.fillText(value, right, y);
  const valueW = ctx.measureText(value).width;

  ctx.save();
  ctx.strokeStyle = alpha(C.paperDim, 0.28);
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(left + labelW + 14, y + 2);
  ctx.lineTo(right - valueW - 14, y + 2);
  ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------- обучение

/**
 * Обучение отдельным экраном, а не всплывающими подсказками в бою: правил
 * четыре, и объяснить их лучше один раз до старта, чем дёргать игрока
 * посреди забега. Экран доступен из меню в любой момент, поэтому забыть
 * правило не страшно.
 */
function drawHowto(ctx: CanvasRenderingContext2D, L: Layout): void {
  scrim(ctx, L.width, L.height, 0.82);

  const w = panelWidth(L);
  const r = { x: L.centerX - w / 2, y: L.height * 0.17, w, h: L.height * 0.42 };
  panel(ctx, r);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.min(52, w * 0.09));
  ctx.fillStyle = C.gold;
  ctx.fillText(t('howtoTitle'), L.centerX, r.y + 62);

  const lines: Key[] = ['howto1', 'howto2', 'howto3', 'howto4'];
  const size = Math.min(28, w * 0.045);
  const lineH = size * 1.42;
  ctx.font = font(size, 'normal');
  ctx.textAlign = 'left';

  let y = r.y + 132;
  const left = r.x + w * 0.1;
  const maxW = w * 0.8 - 44;

  lines.forEach((key, i) => {
    // Нумерованный маркер: правила читаются как последовательность шагов.
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(left + 14, y + size * 0.4, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.font = font(22);
    ctx.fillText(String(i + 1), left + 14, y + size * 0.4 + 1);

    ctx.textAlign = 'left';
    ctx.font = font(size, 'normal');
    ctx.fillStyle = C.paper;
    // Отступ до следующего пункта отсчитывается от ПОСЛЕДНЕЙ строки и равен
    // полной высоте строки плюс воздух: иначе перенесённая строка наезжала
    // на следующий пункт списка.
    y = wrapText(ctx, t(key), left + 44, y, maxW, lineH) + lineH + size * 0.3;
  });
  ctx.restore();
}

/**
 * Перенос по словам. Без него длинные строки обучения вылезали бы за панель
 * на узком экране, а на широком выглядели бы одной простынёй.
 * Возвращает Y последней нарисованной строки.
 */
function wrapText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, maxW: number, lineH: number,
): number {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

void M;
