/**
 * Забег: состояние, реакция на тап, камера.
 *
 * Тонкий слой поверх pendulum/tower/rules — вся математика живёт там, здесь
 * только порядок событий и то, что видит игрок.
 */

import { M } from '../art/theme';
import { getLayout } from '../core/layout';
import { Pendulum } from './pendulum';
import { Tower, type Block, WIND_MAX_ANGLE } from './tower';
import { dropBlock, coinsForFloor, PERFECT_STREAK_STEP, type DropResult } from './rules';
import { MonkeyTroop } from './monkeys';
import type { GameEvent } from './events';
import { modeParams, type GameMode } from './modes';

export type Phase = 'menu' | 'playing' | 'over';

export interface FallingSlice {
  x: number;
  y: number;
  w: number;
  vy: number;
  vx: number;
  rot: number;
  life: number;
}

/**
 * Ящик в полёте — от отцепления с лианы до посадки.
 *
 * Несёт с собой УЖЕ ПОСЧИТАННЫЙ исход (`result`): он определён тапом, а
 * полёт лишь проигрывает его. Поэтому ящик не может «промахнуться иначе»,
 * чем показал игроку прицел в момент нажатия.
 */
export interface FallingCrate {
  x: number;
  /** Мировая координата по вертикали, как у блоков: floor × floorH. */
  y: number;
  vy: number;
  w: number;
  /** Мировая высота, на которой ящик встанет в башню. */
  landingY: number;
  rot: number;
  vrot: number;
  /** После промаха ящик не останавливается, а летит мимо и кувыркается. */
  missed: boolean;
  result: DropResult;
}

/** Ускорение падения. Подобрано на ~0.26 с полёта — видно, но не тормозит игру. */
const FALL_GRAVITY = 7200;

/** Общий пустой массив: в подавляющем большинстве кадров событий нет. */
const EMPTY_EVENTS: GameEvent[] = [];

/** Пылинка/листок: посадка блока и ветер рисуются одной и той же частицей. */
export interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  /** Ветряной листок вместо пыли от удара — не тонет под гравитацией. */
  ambient?: boolean;
}

export class Session {
  phase: Phase = 'menu';
  tower: Tower;
  pendulum: Pendulum;
  /** Стайка на боковых стволах — реагирует на игру, живёт и в меню. */
  troop = new MonkeyTroop();

  /**
   * Время жизни сессии в секундах. Единственный источник фазы для ВСЕЙ
   * анимации фона: качание листвы, мерцание звёзд, дрейф облаков. Живёт в
   * симуляции, а не в рендере, поэтому пауза останавливает и картинку —
   * иначе после возврата из рекламы фон дёргался бы скачком.
   */
  time = 0;

  streak = 0;
  coins = 0;
  /** Всплывающая похвала за серию — гаснет со временем. */
  praise = 0;

  slices: FallingSlice[] = [];
  dust: DustMote[] = [];

  /** Ящик в полёте; пока он не null, новый тап не отпускает следующий. */
  falling: FallingCrate | null = null;
  /** 0..1, спадает — «вырастание» нового ящика на лиане после посадки. */
  readyPop = 0;

  /** 0..1, спадает — сила тряски камеры после грубой посадки/обрушения. */
  shake = 0;
  /** 0..~1.2, спадает — сила squash-твина верхнего блока после посадки. */
  landPulse = 0;
  /** 0..1, спадает — красная вспышка в момент обрушения башни. */
  flash = 0;
  private windSpawnTimer = 0;

  /** Плавно следует за высотой башни, чтобы верх всегда был в кадре. */
  cameraY = 0;

  /**
   * События этого кадра. Симуляция только складывает их сюда и не знает, кто
   * и что с ними сделает; владелец обязан вызвать takeEvents() каждый кадр,
   * иначе очередь будет расти.
   */
  private events: GameEvent[] = [];

  /** Забрать накопленные события и очистить очередь. */
  takeEvents(): GameEvent[] {
    if (this.events.length === 0) return EMPTY_EVENTS;
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Положить событие в очередь забега. */
  emit(e: GameEvent): void {
    this.events.push(e);
  }

  /** Текущий режим. Меняется только через reset() — посреди забега нельзя. */
  mode: GameMode = 'classic';
  /** Лучшая серия и число идеальных за забег — уходят в мета-прогресс. */
  bestStreak = 0;
  perfects = 0;

  constructor() {
    const layout = getLayout();
    this.tower = new Tower(layout.centerX);
    this.pendulum = new Pendulum(layout.centerX, layout.columnWidth * 0.42);
    this.applyMode();
  }

  /**
   * Коэффициенты режима навешиваются на уже созданные объекты, а не
   * порождают их подклассы: шторм — это те же правила с другими числами,
   * и любая правка баланса обязана действовать в обоих режимах сразу.
   */
  private applyMode(): void {
    const p = modeParams(this.mode);
    this.pendulum.speedScale = p.speed;
    this.tower.windScale = p.wind;
    this.tower.windFrom = p.windFrom;
  }

  reset(mode: GameMode = this.mode): void {
    const layout = getLayout();
    this.mode = mode;
    this.tower = new Tower(layout.centerX);
    this.pendulum = new Pendulum(layout.centerX, layout.columnWidth * 0.42);
    this.applyMode();
    this.bestStreak = 0;
    this.perfects = 0;
    this.streak = 0;
    this.coins = 0;
    this.praise = 0;
    this.slices = [];
    this.dust = [];
    this.shake = 0;
    this.landPulse = 0;
    this.flash = 0;
    this.windSpawnTimer = 0;
    this.cameraY = 0;
    this.falling = null;
    this.readyPop = 0;
    this.troop.reset();
    this.phase = 'playing';
  }

  /** Пересчёт при изменении размеров окна: башня остаётся по центру колонки. */
  relayout(): void {
    const layout = getLayout();
    const shift = layout.centerX - this.pendulum.centerX;
    if (shift === 0) return;
    this.pendulum.centerX = layout.centerX;
    this.pendulum.amplitude = layout.columnWidth * 0.42;
    for (const b of this.tower.blocks) b.x += shift;
  }

  tap(): void {
    if (this.phase === 'menu' || this.phase === 'over') {
      this.reset();
      return;
    }
    // Пока ящик летит, новый не отпускаем: иначе в воздухе окажутся два
    // ящика с уже посчитанными исходами, и второй приземлится на башню,
    // которой ещё нет.
    if (this.falling) return;
    this.drop();
  }

  /**
   * Отцепить ящик от лианы.
   *
   * Исход считается ЗДЕСЬ, в момент тапа, а не при касании башни. Тайминг
   * нажатия — единственный навык в игре, и он не должен зависеть от того,
   * сколько летит ящик: иначе смещение башни от ветра за время полёта
   * превращало бы честное попадание в промах уже после того, как игрок всё
   * сделал правильно. Падение только проигрывает принятое решение.
   */
  private drop(): void {
    const prev = this.tower.top;
    // Цель движется вместе с креном башни — целиться надо по верхушке,
    // а не по неподвижной середине экрана.
    const dropX = this.pendulum.x;
    const aimX = dropX - this.tower.topOffsetX();
    const result = dropBlock(prev, aimX, this.streak);

    this.falling = {
      x: dropX,
      y: (this.tower.floors + M.dropFloors) * M.floorH,
      vy: 0,
      w: prev.w,
      landingY: (prev.floor + 1) * M.floorH,
      rot: 0,
      vrot: 0,
      missed: false,
      result,
    };
    this.emit({ kind: 'drop' });
  }

  /** Ящик долетел до места посадки — применяем заранее посчитанный исход. */
  private land(f: FallingCrate): void {
    const result = f.result;
    const prevFloor = this.tower.top.floor;

    if (result.kind === 'miss') {
      // Обрушение — самая грубая обратная связь в игре, тряска и вспышка на максимум.
      this.shake = 1;
      this.flash = 1;
      this.troop.scare();
      // Ящик не останавливается, а проваливается мимо башни и кувыркается.
      // Итоги при этом показываются СРАЗУ: пробовал придержать их на 0.75 с
      // ради драматургии — читается как зависшая игра, а не как пауза.
      // Падение мимо остаётся видно позади панели.
      f.missed = true;
      f.vrot = (Math.random() - 0.5) * 6;
      this.phase = 'over';
      this.emit({ kind: 'collapse' });
      return;
    }

    if (result.kind === 'perfect') {
      this.streak += 1;
      this.perfects += 1;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.praise = 1;
      this.landPulse = 1.2;
      this.troop.cheer();
      this.emit({ kind: 'perfect', streak: this.streak });
    } else {
      this.streak = 0;
      this.tower.nudge(result.nudge);
      // Чем грубее посадка, тем сильнее трясёт — толчок башни уже несёт эту силу.
      this.shake = Math.min(1, this.shake + Math.abs(result.nudge));
      this.landPulse = 1;
      if (result.slice) this.spawnSlice(result.slice, prevFloor + 1);
      this.emit({ kind: 'land' });
      this.emit({ kind: 'trim', severity: Math.abs(result.nudge) });
    }

    this.tower.add(result.block as Block);
    this.spawnLandingDust(this.tower.top);
    // Награда режима: шторм платит в полтора раза больше, потому что забег
    // там короче и рискованнее. Округление вниз — иначе множитель 1.5 даёт
    // дробные бананы.
    this.coins += Math.floor(coinsForFloor(this.streak) * modeParams(this.mode).reward);
    this.pendulum.reset();
    this.falling = null;
    // Новый ящик появляется на лиане не мгновенно, а «вырастает» за долю
    // секунды: подмена объекта одним кадром читается как мигание.
    this.readyPop = 1;
  }

  private spawnSlice(slice: { x: number; w: number }, floor: number): void {
    this.slices.push({
      x: slice.x,
      y: floor * M.floorH,
      w: slice.w,
      vy: 0,
      vx: (Math.random() - 0.5) * 40,
      rot: 0,
      life: 1.4,
    });
  }

  /**
   * Полёт ящика. Шаг фиксированный (см. core/loop.ts), поэтому обычного
   * интегрирования достаточно: перепрыгнуть точку посадки ящик не может
   * больше чем на один шаг, а этот перелёт мы гасим посадкой ровно на
   * landingY.
   */
  private updateFalling(dt: number): void {
    const f = this.falling;
    if (!f) return;

    f.vy += FALL_GRAVITY * dt;
    f.y -= f.vy * dt;

    if (f.missed) {
      f.rot += f.vrot * dt;
      // Улетел заметно ниже основания башни — снимаем с симуляции.
      if (f.y < -M.floorH * 12) this.falling = null;
      return;
    }

    if (f.y <= f.landingY) {
      f.y = f.landingY;
      this.land(f);
    }
  }

  /** Короткий всплеск пыли в точке посадки — визуальный вес удара. */
  private spawnLandingDust(block: Block): void {
    const y = block.floor * M.floorH;
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI * (0.15 + 0.7 * Math.random());
      const speed = 60 + Math.random() * 90;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.dust.push({
        x: block.x + (Math.random() - 0.5) * block.w * 0.7,
        y,
        vx: Math.cos(angle) * speed * side,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        r: 3 + Math.random() * 4,
      });
    }
  }

  /**
   * Ветряные листья: частота и скорость растут вместе с силой ветра, а
   * направление совпадает со знаком крена от ветра — так порыв читается
   * ДО того, как он качнёт башню, а не постфактум.
   */
  private updateWindMotes(dt: number): void {
    const strength = Math.min(1, Math.abs(this.tower.wind) / WIND_MAX_ANGLE);
    if (strength <= 0.02) return;
    this.windSpawnTimer -= dt;
    if (this.windSpawnTimer > 0) return;
    this.windSpawnTimer = 0.5 / strength;

    const layout = getLayout();
    const dir = this.tower.wind >= 0 ? 1 : -1;
    this.dust.push({
      x: dir > 0 ? layout.columnLeft - 20 : layout.columnRight + 20,
      y: this.tower.floors * M.floorH + (Math.random() - 0.5) * M.floorH * 6,
      vx: dir * (90 + strength * 140),
      vy: -(20 + Math.random() * 20),
      life: 2.2,
      maxLife: 2.2,
      r: 3 + Math.random() * 3,
      ambient: true,
    });
  }

  update(dt: number): void {
    // Время идёт всегда: фон живёт и в меню, и на экране проигрыша.
    this.time += dt;

    if (this.phase === 'playing') {
      // Маятник замирает на время полёта: лиана осталась там, откуда ящик
      // отцепился, и он падает строго вертикально из-под неё. Если бы
      // маятник продолжал ход, точка отрыва уехала бы от падающего ящика.
      if (!this.falling) this.pendulum.update(dt, this.tower.floors);
      this.tower.update(dt);
      if (this.tower.hasCollapsed()) {
        this.phase = 'over';
        this.shake = Math.max(this.shake, 0.85);
        this.flash = 1;
        this.troop.scare();
        this.emit({ kind: 'collapse' });
      }
      this.updateWindMotes(dt);
    } else {
      // Даже в меню башня чуть покачивается — экран не выглядит мёртвым.
      this.tower.update(dt);
    }

    this.troop.update(dt, this.tower.floors);

    this.updateFalling(dt);

    if (this.praise > 0) this.praise = Math.max(0, this.praise - dt * 1.6);
    this.readyPop = Math.max(0, this.readyPop - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.landPulse = Math.max(0, this.landPulse - dt * 5.5);
    this.flash = Math.max(0, this.flash - dt * 1.8);

    for (const s of this.slices) {
      s.vy += 900 * dt;
      s.y -= s.vy * dt;
      s.x += s.vx * dt;
      s.rot += dt * 3;
      s.life -= dt;
    }
    this.slices = this.slices.filter((s) => s.life > 0);

    for (const d of this.dust) {
      if (!d.ambient) d.vy -= 260 * dt; // гравитация — пыль от удара, а не листья
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
    }
    this.dust = this.dust.filter((d) => d.life > 0);

    // Камера догоняет башню экспоненциально — без рывков на каждом этаже.
    const targetY = this.tower.floors * M.floorH;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 6);
  }

  /** Сколько идеальных осталось до прибавки ширины — для подсказки в HUD. */
  toNextRegain(): number {
    return PERFECT_STREAK_STEP - (this.streak % PERFECT_STREAK_STEP);
  }
}
