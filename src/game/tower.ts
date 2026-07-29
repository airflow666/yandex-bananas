/**
 * Башня: блоки, центр масс и крен.
 *
 * Вторая ось риска поверх точности. Каждый блок смещает центр масс, а башня
 * отклоняется к углу, пропорциональному этому смещению, и идёт к нему
 * пружиной с затуханием — то есть раскачивается, а не щёлкает в новое
 * положение. Чем кривее построено, тем сильнее ходит верх башни, и тем
 * труднее попадать дальше. Сложность растёт из действий игрока, а не из
 * таблицы коэффициентов.
 */

import { M } from '../art/theme';

export interface Block {
  /** Центр блока по горизонтали в логических единицах. */
  x: number;
  /** Ширина блока. */
  w: number;
  /** Индекс этажа снизу вверх, 0 — фундамент. */
  floor: number;
  /** Было ли попадание идеальным — влияет на отрисовку. */
  perfect: boolean;
}

/** Жёсткость и затухание пружины крена. Подобраны на «тяжёлую, но живую» башню. */
const SPRING_K = 26;
const SPRING_DAMP = 6.5;
/** Во сколько радиан переводится единица относительного смещения центра масс. */
const LEAN_GAIN = 0.42;
/** Больше этого угла башня считается рухнувшей. */
export const MAX_LEAN = 0.38;

export class Tower {
  blocks: Block[] = [];

  /** Текущий угол крена в радианах и его скорость. */
  angle = 0;
  private angleVel = 0;

  /** Ветер биома добавляется к целевому углу. */
  wind = 0;

  constructor(private readonly baseX: number) {
    this.blocks.push({ x: baseX, w: M.baseW, floor: 0, perfect: false });
  }

  get top(): Block {
    // Массив никогда не пуст: фундамент кладётся в конструкторе.
    return this.blocks[this.blocks.length - 1] as Block;
  }

  get floors(): number {
    return this.blocks.length - 1;
  }

  add(block: Block): void {
    this.blocks.push(block);
  }

  /**
   * Центр масс по горизонтали. Вес блока считаем пропорциональным ширине —
   * узкие блоки наверху раскачивают башню слабее широких, что интуитивно
   * верно и вознаграждает аккуратную игру.
   */
  centerOfMass(): number {
    let sum = 0;
    let mass = 0;
    for (const b of this.blocks) {
      sum += b.w * b.x;
      mass += b.w;
    }
    return mass > 0 ? sum / mass : this.baseX;
  }

  /** Целевой угол: смещение центра масс относительно основания плюс ветер. */
  private targetAngle(): number {
    const base = this.blocks[0] as Block;
    const offset = (this.centerOfMass() - this.baseX) / base.w;
    return offset * LEAN_GAIN + this.wind;
  }

  update(dt: number): void {
    const target = this.targetAngle();
    const accel = -SPRING_K * (this.angle - target) - SPRING_DAMP * this.angleVel;
    this.angleVel += accel * dt;
    this.angle += this.angleVel * dt;
  }

  /** Толчок при неидеальной посадке — башня отзывается на удар. */
  nudge(strength: number): void {
    this.angleVel += strength;
  }

  hasCollapsed(): boolean {
    return Math.abs(this.angle) > MAX_LEAN;
  }

  /** Смещение верха башни из-за крена — цель, по которой целится игрок, движется. */
  topOffsetX(): number {
    return Math.sin(this.angle) * this.floors * M.floorH;
  }
}
