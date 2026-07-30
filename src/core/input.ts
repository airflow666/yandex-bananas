/**
 * Ввод: два независимых потока событий.
 *
 * `onPress` (pointerdown) — для геймплея. Блок обязан падать в момент
 * касания: задержка в 60–100 мс до pointerup для игры на тайминг
 * катастрофична, промахи начинают ощущаться нечестными.
 *
 * `onRelease` (pointerup) — для кнопок интерфейса. Это стандартное поведение
 * во всех ОС: нажал не туда — увёл палец, действие отменилось. Кнопка,
 * срабатывающая по нажатию, лишает игрока этой возможности.
 *
 * Здесь же выполняются требования п. 1.6: не должно быть контекстного меню
 * по долгому нажатию и правому клику, выделения текста и скролла страницы.
 */

import { toLogical } from './canvas';

export interface Pointer { x: number; y: number }

type Handler = (p: Pointer) => void;

const pressHandlers = new Set<Handler>();
const releaseHandlers = new Set<Handler>();
const moveHandlers = new Set<Handler>();

let lastPointer: Pointer = { x: 0, y: 0 };
let pointerDown = false;
/** true, если устройство умеет наводить курсор: на тач-экранах hover не бывает. */
let hoverCapable = false;

export function onPress(fn: Handler): () => void {
  pressHandlers.add(fn);
  return () => pressHandlers.delete(fn);
}

export function onRelease(fn: Handler): () => void {
  releaseHandlers.add(fn);
  return () => releaseHandlers.delete(fn);
}

export function onMove(fn: Handler): () => void {
  moveHandlers.add(fn);
  return () => moveHandlers.delete(fn);
}

export function getPointer(): Pointer { return lastPointer; }
export function isPointerDown(): boolean { return pointerDown; }
export function canHover(): boolean { return hoverCapable; }

function emit(handlers: Set<Handler>, p: Pointer): void {
  handlers.forEach((fn) => {
    try { fn(p); } catch (e) { console.warn('[input] handler failed', e); }
  });
}

export function bindInput(target: HTMLElement): void {
  target.addEventListener('pointerdown', (e) => {
    // Только основная кнопка: правый клик не должен играть.
    if (e.button !== 0) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') hoverCapable = true;
    pointerDown = true;
    lastPointer = toLogical(e.clientX, e.clientY);
    // Захват указателя: палец, уехавший за пределы канваса, всё равно
    // должен отдать pointerup — иначе кнопка залипнет в нажатом состоянии.
    try { target.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    emit(pressHandlers, lastPointer);
  });

  target.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pointerDown = false;
    lastPointer = toLogical(e.clientX, e.clientY);
    emit(releaseHandlers, lastPointer);
  });

  // Отмена (системный жест, входящий звонок) обязана снять нажатие.
  target.addEventListener('pointercancel', () => { pointerDown = false; });

  target.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hoverCapable = true;
    lastPointer = toLogical(e.clientX, e.clientY);
    emit(moveHandlers, lastPointer);
  });

  // Курсор ушёл с канваса — состояние наведения обязано сброситься.
  target.addEventListener('pointerleave', () => {
    pointerDown = false;
    lastPointer = { x: -9999, y: -9999 };
  });

  target.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    // Системные сочетания не перехватываем (п. 1.6.2.9).
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      // С клавиатуры действие атомарно: нажатие и отпускание сразу.
      emit(pressHandlers, lastPointer);
      emit(releaseHandlers, lastPointer);
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      emit(escapeHandlers, lastPointer);
    }
  });
}

const escapeHandlers = new Set<Handler>();
/** Escape — пауза на десктопе. Отдельно, чтобы не путать с игровым тапом. */
export function onEscape(fn: Handler): () => void {
  escapeHandlers.add(fn);
  return () => escapeHandlers.delete(fn);
}
