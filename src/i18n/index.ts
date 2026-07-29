/**
 * Локализация. Русский обязателен, английский — для остального каталога.
 * Никакого захардкоженного текста в отрисовке (п. 2.10).
 */

const ru = {
  title: 'Банановая башня',
  tapToStart: 'Нажми, чтобы начать',
  tapToDrop: 'Нажимай, чтобы ставить блоки',
  floors: 'Этажей',
  best: 'Рекорд',
  coins: 'Бананы',
  perfect: 'Идеально!',
  gameOver: 'Башня рухнула',
  tapToRestart: 'Нажми, чтобы начать заново',
  newRecord: 'Новый рекорд!',
  loading: 'Загрузка…',
} as const;

const en: Record<keyof typeof ru, string> = {
  title: 'Banana Tower',
  tapToStart: 'Tap to start',
  tapToDrop: 'Tap to drop blocks',
  floors: 'Floors',
  best: 'Best',
  coins: 'Bananas',
  perfect: 'Perfect!',
  gameOver: 'The tower fell',
  tapToRestart: 'Tap to restart',
  newRecord: 'New record!',
  loading: 'Loading…',
};

export type Key = keyof typeof ru;

/** Русскоязычный каталог Яндекс Игр — не только ru. */
const RU_LOCALES = new Set(['ru', 'be', 'kk', 'uk', 'uz']);

let dict: Record<Key, string> = ru;

export function setLang(rawLang: string): void {
  const code = (rawLang || 'ru').toLowerCase().split('-')[0] ?? 'ru';
  dict = RU_LOCALES.has(code) ? ru : en;
}

export function t(key: Key): string {
  return dict[key];
}
