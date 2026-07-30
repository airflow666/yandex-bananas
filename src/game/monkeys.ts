/**
 * Обезьяны на боковых стволах.
 *
 * Они держатся на уровне верхушки башни: камера следует за башней, поэтому
 * экранная позиция обезьяны почти постоянна, а ствол за её спиной уезжает
 * вниз с параллаксом 0.55. Из-за разницы скоростей глаз читает это именно
 * как «обезьяна лезет вверх вместе с башней», хотя на экране она почти
 * стоит. Тот же приём, что у бегущего персонажа на прокручивающемся фоне.
 *
 * Прыжок анимируется дугой при КАЖДОМ новом этаже — это и есть обещанное
 * «прыгают вверх вместе с постройкой». Реакции (ликование, испуг) живут
 * поверх и перебивают базовую позу на время.
 */

import { hash01 } from '../art/theme';
import type { Pose } from '../art/sprites';

/** Сколько секунд держится реакция на событие. */
const REACTION_S = 1.1;
/** Длительность прыжка на новый этаж. */
const HOP_S = 0.42;

export interface Monkey {
  /** -1 — левый ствол, +1 — правый. */
  side: -1 | 1;
  /** Смещение по вертикали от верхушки башни, в логических единицах. */
  offsetY: number;
  /** Смещение по горизонтали внутри ствола, в долях его ширины. */
  offsetX: number;
  /** Прогресс прыжка 0..1; 1 — стоит на месте. */
  hop: number;
  /** Остаток времени реакции. */
  reaction: number;
  reactionPose: Pose;
  /** Фаза покачивания — чтобы обезьяны не двигались синхронно. */
  phase: number;
}

export class MonkeyTroop {
  monkeys: Monkey[] = [];
  private lastFloors = 0;

  constructor(count = 4) {
    for (let i = 0; i < count; i++) {
      const h = hash01(i * 17 + 3);
      this.monkeys.push({
        side: i % 2 === 0 ? -1 : 1,
        // Разнесены по высоте ВОКРУГ верхушки и выше неё: стайка вдоль
        // башни, а не шеренга. Смещения отрицательные — иначе обезьяны
        // оказываются ниже верхнего ящика и уходят под нижнюю кромку кадра.
        offsetY: -330 + h * 240 + Math.floor(i / 2) * 150,
        offsetX: 0.1 + hash01(i * 7 + 11) * 0.3,
        hop: 1,
        reaction: 0,
        reactionPose: 'climb',
        phase: h * Math.PI * 2,
      });
    }
  }

  reset(): void {
    this.lastFloors = 0;
    for (const m of this.monkeys) {
      m.hop = 1;
      m.reaction = 0;
    }
  }

  /** Ликование по идеальной посадке — не у всех сразу, иначе выглядит роботами. */
  cheer(): void {
    this.monkeys.forEach((m, i) => {
      if (hash01(i * 13 + Math.round(m.phase * 100)) > 0.25) {
        m.reaction = REACTION_S;
        m.reactionPose = 'cheer';
      }
    });
  }

  /** Башня рухнула — закрывают глаза. Держится дольше обычной реакции. */
  scare(): void {
    for (const m of this.monkeys) {
      m.reaction = REACTION_S * 2.5;
      m.reactionPose = 'scared';
    }
  }

  update(dt: number, floors: number): void {
    if (floors > this.lastFloors) {
      // Новый этаж — вся стайка подтягивается следом.
      for (const m of this.monkeys) m.hop = 0;
    }
    this.lastFloors = floors;

    for (const m of this.monkeys) {
      if (m.hop < 1) m.hop = Math.min(1, m.hop + dt / HOP_S);
      if (m.reaction > 0) m.reaction = Math.max(0, m.reaction - dt);
    }
  }

  /** Поза с учётом реакции и прыжка: реакция важнее движения. */
  poseOf(m: Monkey): Pose {
    if (m.reaction > 0) return m.reactionPose;
    return m.hop < 1 ? 'climb' : 'hang';
  }

  /**
   * Вертикальный сдвиг прыжка. Дуга: обезьяна проваливается вниз и догоняет
   * верхушку с перелётом — без перелёта прыжок выглядит лифтом.
   */
  hopOffset(m: Monkey): number {
    if (m.hop >= 1) return 0;
    const t = m.hop;
    return (1 - t) * 90 - Math.sin(t * Math.PI) * 26;
  }
}
