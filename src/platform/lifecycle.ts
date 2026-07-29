/**
 * Единая точка «игра приостановлена / возобновлена».
 *
 * Складывает два независимых источника:
 *  - game_api_pause / game_api_resume от SDK — только они знают про показ
 *    рекламы и окна покупки;
 *  - браузерные blur/focus, visibilitychange и pagehide — они работают и без
 *    SDK, и в локальной разработке.
 *
 * Пункт 1.14 перечисляет среди проверяемых действий сворачивание браузера и
 * навигацию по истории, поэтому pagehide здесь не для порядка: это последний
 * момент, когда можно успеть записать прогресс.
 */

import { platform } from './yandex';

type Handler = () => void;

const pauseHandlers = new Set<Handler>();
const resumeHandlers = new Set<Handler>();
const teardownHandlers = new Set<Handler>();

let paused = false;
let bound = false;

export function onPause(fn: Handler): void { pauseHandlers.add(fn); }
export function onResume(fn: Handler): void { resumeHandlers.add(fn); }
/** Последний шанс сбросить данные: уход со страницы, закрытие вкладки. */
export function onTeardown(fn: Handler): void { teardownHandlers.add(fn); }

function run(handlers: Set<Handler>): void {
  handlers.forEach((fn) => {
    try { fn(); } catch (e) { console.warn('[lifecycle] handler failed', e); }
  });
}

/** Идемпотентно: два источника легко дают дубли, реагируем только на смену. */
function pause(): void {
  if (paused) return;
  paused = true;
  run(pauseHandlers);
}

function resume(): void {
  if (!paused) return;
  paused = false;
  run(resumeHandlers);
}

function teardown(): void {
  run(teardownHandlers);
}

export function bindLifecycle(): void {
  if (bound) return;
  bound = true;

  platform.onPause(pause);
  platform.onResume(resume);

  window.addEventListener('blur', pause);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { pause(); teardown(); } else { resume(); }
  });
  // pagehide надёжнее unload: срабатывает и при переходе в bfcache на iOS.
  window.addEventListener('pagehide', teardown);
}

export function isPaused(): boolean { return paused; }
