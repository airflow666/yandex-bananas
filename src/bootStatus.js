/**
 * Экран загрузки/ошибки из index.html.
 *
 * Заглушка `#boot-status` отрисована обычным HTML+CSS (без инлайнового JS,
 * чтобы её нельзя было потерять из-за CSP площадки) и снимается отсюда,
 * когда бандл действительно выполнился. Смысл не косметический: фон body
 * и backgroundColor канваса Phaser — один и тот же #1a2f1a, так что без
 * этой надписи «JS не загрузился/упал при разборе» и «Phaser стартовал, но
 * завис в Boot» дают на экране абсолютно одинаковую картинку. Так состояние
 * читается прямо в игре, без DevTools — что важно, когда воспроизвести
 * проблему можно только в черновике на самой площадке.
 */

let booted = false;

const el = () => document.getElementById('boot-status');

/** Убрать заглушку — бандл выполнился и игра сконструирована. */
export function clearBootStatus() {
  booted = true;
  el()?.remove();
}

/** Показать текст ошибки поверх пустого фона (только до старта игры). */
function showBootError(message) {
  const node = el();
  if (!node) return;
  node.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Ошибка загрузки / Failed to load';
  const detail = document.createElement('div');
  detail.className = 'err';
  detail.textContent = String(message);
  node.append(title, detail);
}

// Регистрируем до создания игры: падение на этапе загрузки перестаёт быть
// молчаливым пустым фоном. После clearBootStatus() ничего не перехватываем —
// ошибка в середине геймплея не должна закрывать игру красной плашкой.
window.addEventListener('error', (e) => {
  if (!booted) showBootError(e.message || e.error || 'script error');
});
window.addEventListener('unhandledrejection', (e) => {
  if (!booted) showBootError(e.reason?.message || e.reason || 'unhandled rejection');
});
