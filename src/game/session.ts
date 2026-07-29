/**
 * Забег: состояние, реакция на тап, камера.
 *
 * Тонкий слой поверх pendulum/tower/rules — вся математика живёт там, здесь
 * только порядок событий и то, что видит игрок.
 */

import { M } from '../art/theme';
import { getLayout } from '../core/layout';
import { Pendulum } from './pendulum';
import { Tower, type Block } from './tower';
import { dropBlock, coinsForFloor, PERFECT_STREAK_STEP } from './rules';

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

export class Session {
  phase: Phase = 'menu';
  tower: Tower;
  pendulum: Pendulum;

  streak = 0;
  coins = 0;
  /** Всплывающая похвала за серию — гаснет со временем. */
  praise = 0;

  slices: FallingSlice[] = [];

  /** Плавно следует за высотой башни, чтобы верх всегда был в кадре. */
  cameraY = 0;

  constructor() {
    const layout = getLayout();
    this.tower = new Tower(layout.centerX);
    this.pendulum = new Pendulum(layout.centerX, layout.columnWidth * 0.42);
  }

  reset(): void {
    const layout = getLayout();
    this.tower = new Tower(layout.centerX);
    this.pendulum = new Pendulum(layout.centerX, layout.columnWidth * 0.42);
    this.streak = 0;
    this.coins = 0;
    this.praise = 0;
    this.slices = [];
    this.cameraY = 0;
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
    this.drop();
  }

  private drop(): void {
    const prev = this.tower.top;
    // Цель движется вместе с креном башни — целиться надо по верхушке,
    // а не по неподвижной середине экрана.
    const dropX = this.pendulum.x;
    const aimX = dropX - this.tower.topOffsetX();
    const result = dropBlock(prev, aimX, this.streak);

    if (result.kind === 'miss') {
      this.phase = 'over';
      return;
    }

    if (result.kind === 'perfect') {
      this.streak += 1;
      this.praise = 1;
    } else {
      this.streak = 0;
      this.tower.nudge(result.nudge);
      if (result.slice) this.spawnSlice(result.slice, prev.floor + 1);
    }

    this.tower.add(result.block as Block);
    this.coins += coinsForFloor(this.streak);
    this.pendulum.reset();
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

  update(dt: number): void {
    if (this.phase === 'playing') {
      this.pendulum.update(dt, this.tower.floors);
      this.tower.update(dt);
      if (this.tower.hasCollapsed()) this.phase = 'over';
    } else {
      // Даже в меню башня чуть покачивается — экран не выглядит мёртвым.
      this.tower.update(dt);
    }

    if (this.praise > 0) this.praise = Math.max(0, this.praise - dt * 1.6);

    for (const s of this.slices) {
      s.vy += 900 * dt;
      s.y -= s.vy * dt;
      s.x += s.vx * dt;
      s.rot += dt * 3;
      s.life -= dt;
    }
    this.slices = this.slices.filter((s) => s.life > 0);

    // Камера догоняет башню экспоненциально — без рывков на каждом этаже.
    const targetY = this.tower.floors * M.floorH;
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 6);
  }

  /** Сколько идеальных осталось до прибавки ширины — для подсказки в HUD. */
  toNextRegain(): number {
    return PERFECT_STREAK_STEP - (this.streak % PERFECT_STREAK_STEP);
  }
}
