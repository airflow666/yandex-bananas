/**
 * Экран загрузки, трассировка старта и сторож.
 *
 * Зачем так подробно: игра на площадке крутится в кросс-доменном iframe, её
 * консоль снаружи не читается, а каждый цикл проверки требует перезаливки
 * архива. Поэтому состояние загрузки выводится прямо на экран — один заход
 * на черновик должен отвечать на вопрос «где встало», а не порождать
 * следующую гипотезу.
 *
 * Прошлая версия врала: `clearBootStatus()` вызывался сразу после
 * конструктора `new Phaser.Game()`, то есть ДО того, как Phaser реально
 * поднимется. Заглушка исчезала даже если движок не стартовал, и пустой
 * зелёный фон снова становился неотличим от зависшей сцены. Теперь заглушку
 * снимает событие готовности Phaser, а не факт вызова конструктора.
 */

/** Шаги старта по порядку; сторож покажет, до какого дошли. */
const STEPS = ['bundle', 'phaser-ready', 'boot-create', 'sdk-init', 'saves-loaded', 'menu'];

/** Если через столько меню не открылось — показываем трассировку. */
const WATCHDOG_MS = 15_000;

const reached = [];
let booted = false;
let watchdog = null;

const el = () => document.getElementById('boot-status');

/** Отметить пройденный этап загрузки. */
export function markStep(name) {
  if (reached.includes(name)) return;
  reached.push(name);
  window.__bootTrace = reached.slice();
  if (name === 'menu') {
    booted = true;
    clearTimeout(watchdog);
    el()?.remove();
  }
}

/** Убрать заглушку — движок поднялся и что-то рисует. */
export function clearBootStatus() {
  el()?.remove();
}

/** Показать, до какого этапа дошла загрузка, вместо молчаливого фона. */
function showTrace(title) {
  let node = el();
  if (!node) {
    node = document.createElement('div');
    node.id = 'boot-status';
    document.body.appendChild(node);
  }
  node.innerHTML = '';
  const head = document.createElement('div');
  head.textContent = title;
  const detail = document.createElement('div');
  detail.className = 'err';
  // Пройденные этапы и первый непройденный — этого достаточно, чтобы понять,
  // умер ли бандл, движок, инициализация платформы или переход в меню.
  const stuckAt = STEPS.find((s) => !reached.includes(s)) || '—';
  detail.textContent = `ok: ${reached.join(' → ') || 'ничего'}\nстоп: ${stuckAt}`;
  node.append(head, detail);
}

export function startWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    if (booted) return;
    showTrace('Игра не запустилась / Game did not start');
  }, WATCHDOG_MS);
}

// Модуль импортируется первым, поэтому его выполнение = «бандл ожил».
markStep('bundle');

window.addEventListener('error', (e) => {
  if (!booted) showTrace(`Ошибка: ${e.message || e.error || 'script error'}`);
});
window.addEventListener('unhandledrejection', (e) => {
  if (!booted) showTrace(`Ошибка: ${e.reason?.message || e.reason || 'unhandled rejection'}`);
});
