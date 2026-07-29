/**
 * Ввод: одно действие «тап» плюс координаты для кнопок.
 *
 * Игра управляется одним касанием в любом месте экрана — на мобильных это
 * обязательное требование (управление жестами), а на десктопе дублируется
 * пробелом и мышью. Отдельных виртуальных кнопок для геймплея нет.
 *
 * Здесь же выполняются требования п. 1.6: не должно быть контекстного меню
 * по долгому нажатию и правому клику, выделения текста и скролла страницы.
 */

import { toLogical } from './canvas';

export interface Pointer { x: number; y: number }

type TapHandler = (p: Pointer) => void;

const tapHandlers = new Set<TapHandler>();
let lastPointer: Pointer = { x: 0, y: 0 };

export function onTap(fn: TapHandler): () => void {
  tapHandlers.add(fn);
  return () => tapHandlers.delete(fn);
}

export function getPointer(): Pointer { return lastPointer; }

function emitTap(p: Pointer): void {
  lastPointer = p;
  tapHandlers.forEach((fn) => {
    try { fn(p); } catch (e) { console.warn('[input] tap handler failed', e); }
  });
}

export function bindInput(target: HTMLElement): void {
  target.addEventListener('pointerdown', (e) => {
    // Только основная кнопка: правый клик не должен играть.
    if (e.button !== 0) return;
    e.preventDefault();
    emitTap(toLogical(e.clientX, e.clientY));
  });

  target.addEventListener('pointermove', (e) => {
    lastPointer = toLogical(e.clientX, e.clientY);
  });

  target.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    // Системные сочетания не перехватываем (п. 1.6.2.9).
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      emitTap(lastPointer);
    }
  });
}
