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

/**
 * Ограничитель плеча крена, в этажах.
 *
 * Физически башня поворачивается вокруг фундамента, и смещение верхушки
 * равно sin(угол) × полная высота. На сотом этаже это плечо огромно: поворот
 * на 3° уводит верх на сотни единиц вбок. Беда в том, что фундамент к этому
 * моменту далеко за нижней кромкой кадра, и глазу не за что зацепиться —
 * видимый кусок башни едет вбок ЦЕЛИКОМ и выглядит не накренившимся, а
 * летающим по воздуху.
 *
 * Поэтому плечо ограничено: башня ведёт себя как жёсткая стопка, шарнир
 * которой находится на 12 этажей ниже верхушки, то есть чуть ниже кадра.
 * Видимая часть при этом честно поворачивается вокруг точки под собой.
 * Величина используется И в прицеливании, И в отрисовке — разъехаться они
 * не могут по построению.
 */
export const LEVER_FLOORS = 12;

/**
 * Ниже этого этажа биом безветренный — игрок успевает освоиться.
 * В шторме перекрывается параметром режима (`windFrom = 0`).
 */
const WIND_START_FLOOR = 10;
/** На стольких этажах ветер набирает полную силу. */
const WIND_RAMP_FLOORS = 35;
/** Максимальный вклад ветра в целевой угол — доля MAX_LEAN, не фатальная сама по себе. */
export const WIND_MAX_ANGLE = 0.11;
/** Два наложенных синуса с медленными периодами — порыв должен быть читаем, не шум. */
const WIND_FREQ_1 = (Math.PI * 2) / 7.5;
const WIND_FREQ_2 = (Math.PI * 2) / 3.1;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export class Tower {
  blocks: Block[] = [];

  /** Текущий угол крена в радианах и его скорость. */
  angle = 0;
  private angleVel = 0;

  /** Ветер биома добавляется к целевому углу — считается сам от высоты и времени. */
  wind = 0;
  private windTime = 0;

  /** Коэффициенты режима: шторм усиливает ветер и убирает его отсрочку. */
  windScale = 1;
  windFrom = WIND_START_FLOOR;

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

  /**
   * Ветер как функция высоты: ниже WIND_START_FLOOR — тишина, дальше сила
   * растёт по квадрату (ощутимо позже, но потом быстро) и никогда не
   * перестаёт расти дальше потолка WIND_MAX_ANGLE. Два синуса разной частоты
   * вместо одного дают порыв, а не метроном, но остаются предсказуемыми —
   * игрок должен успевать прочитать порыв, а не гадать.
   */
  private windFor(floors: number): number {
    const ramp = clamp01((floors - this.windFrom) / WIND_RAMP_FLOORS);
    // В шторме windFrom = 0, поэтому ramp ненулевой с первого этажа, а
    // windScale = 2 удваивает потолок: ветер там — не поздняя угроза, а
    // условие игры с самого начала.
    const amp = WIND_MAX_ANGLE * this.windScale * ramp * ramp;
    const gust = 0.7 * Math.sin(this.windTime * WIND_FREQ_1)
      + 0.3 * Math.sin(this.windTime * WIND_FREQ_2 + 1.7);
    return amp * gust;
  }

  update(dt: number): void {
    this.windTime += dt;
    this.wind = this.windFor(this.floors);
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

  /** Плечо крена в логических единицах — общее для прицеливания и отрисовки. */
  leverLength(): number {
    return Math.min(this.floors, LEVER_FLOORS) * M.floorH;
  }

  /** Смещение верха башни из-за крена — цель, по которой целится игрок, движется. */
  topOffsetX(): number {
    return Math.sin(this.angle) * this.leverLength();
  }
}
