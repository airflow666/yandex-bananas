/**
 * Правила посадки блока: обрез, идеальное попадание, возврат ширины.
 *
 * Главное отличие от прошлой версии — идеальное попадание теперь
 * ВОЗНАГРАЖДАЕТСЯ. Раньше было `newW = min(w, prev.w)`: ширина в лучшем
 * случае сохранялась, ошибки накапливались необратимо, и любой забег
 * монотонно деградировал до проигрыша. Отыграться было нельзя в принципе.
 *
 * Теперь серия идеальных попаданий возвращает ширину. Появляется и
 * comeback после ошибки, и потолок мастерства: игрок, который держит серию,
 * может стабилизировать башню и уйти выше.
 */

import { M } from '../art/theme';
import type { Block } from './tower';

/** Каждые столько идеальных подряд ширина растёт. */
export const PERFECT_STREAK_STEP = 4;
/** Насколько растёт — в долях стартовой ширины. */
const WIDTH_REGAIN = 0.10;
/** Выше стартовой ширины подниматься можно, но недалеко. */
const WIDTH_CAP = 1.2;

export interface DropResult {
  kind: 'perfect' | 'ok' | 'miss';
  block: Block | null;
  /** Отрезанный кусок — для анимации падения. */
  slice: { x: number; w: number } | null;
  /** Сила толчка башни: чем грубее посадка, тем сильнее раскачивает. */
  nudge: number;
}

/**
 * Допуск идеального попадания — в ДОЛЯХ ширины, а не в пикселях.
 * С фиксированным пиксельным допуском узкие блоки становились бы
 * физически непопадаемыми, и игра упиралась бы в невозможность, а не в
 * мастерство. Нижняя граница держит допуск осязаемым и на широких блоках.
 */
export function perfectTolerance(width: number): number {
  return Math.max(6, width * 0.045);
}

/**
 * Ширина после серии идеальных попаданий. Растёт ступенчато, чтобы возврат
 * ощущался как награда за серию, а не размазывался незаметно.
 */
export function widthAfterStreak(current: number, streak: number): number {
  if (streak === 0 || streak % PERFECT_STREAK_STEP !== 0) return current;
  return Math.min(current + M.baseW * WIDTH_REGAIN, M.baseW * WIDTH_CAP);
}

/**
 * Посадка блока шириной prev.w в позиции dropX поверх блока prev.
 * Возвращает новый блок либо промах, если перекрытия не осталось.
 */
export function dropBlock(prev: Block, dropX: number, streak: number): DropResult {
  const delta = dropX - prev.x;
  const dist = Math.abs(delta);
  const tol = perfectTolerance(prev.w);

  if (dist <= tol) {
    // Идеально: блок садится ровно, ширина не теряется, а по серии растёт.
    const w = widthAfterStreak(prev.w, streak + 1);
    return {
      kind: 'perfect',
      block: { x: prev.x, w, floor: prev.floor + 1, perfect: true },
      slice: null,
      nudge: 0,
    };
  }

  const overlap = prev.w - dist;
  if (overlap <= M.minW) {
    return { kind: 'miss', block: null, slice: null, nudge: 0 };
  }

  // Обрез: остаётся только перекрытие, центр смещается к общей части.
  const newX = prev.x + delta / 2;
  const sliceW = dist;
  const sliceX = delta > 0
    ? prev.x + prev.w / 2 + sliceW / 2
    : prev.x - prev.w / 2 - sliceW / 2;

  return {
    kind: 'ok',
    block: { x: newX, w: overlap, floor: prev.floor + 1, perfect: false },
    slice: { x: sliceX, w: sliceW },
    // Толчок пропорционален грубости посадки и направлен в сторону промаха.
    nudge: Math.sign(delta) * Math.min(dist / prev.w, 1) * 0.9,
  };
}

/** Награда за этаж; комбо ограничено, иначе экономика разгоняется до абсурда. */
export function coinsForFloor(streak: number): number {
  return 1 + Math.min(streak, 8);
}
