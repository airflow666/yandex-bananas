/**
 * Программная загрузка /sdk.js.
 *
 * Документация называет динамическое подключение равноправным с тегом в
 * разметке и требует ровно одного: чтобы скрипт был подключён до вызова
 * YaGames.init(). Путь относительный — абсолютный нужен только при
 * встраивании игры через iframe со своего домена, а мы заливаем архив.
 *
 * Обработчики вешаются как JS-свойства (.onload/.onerror), а не HTML-атрибуты,
 * и создание элемента с подпиской происходит в одном синхронном блоке —
 * гонки с async-загрузкой не возникает.
 */

const SDK_SRC = '/sdk.js';

let pending: Promise<boolean> | null = null;

/**
 * Резолвится, когда глобальный YaGames доступен (true) либо когда скрипт
 * не загрузился (false). Повторные вызовы переиспользуют один промис —
 * второй тег на страницу не добавляется.
 */
export function loadSdkScript(): Promise<boolean> {
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => {
    // Площадка может подключить SDK сама — тогда делать нечего.
    if (typeof window.YaGames !== 'undefined') { resolve(true); return; }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(typeof window.YaGames !== 'undefined'));
    script.addEventListener('error', () => resolve(false));
    if (!existing) {
      script.async = true;
      script.src = SDK_SRC;
      document.head.appendChild(script);
    }
  });
  return pending;
}
