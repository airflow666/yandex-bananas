/**
 * Локализация. Русский обязателен, английский — для остального каталога.
 * Никакого захардкоженного текста в отрисовке (п. 2.10).
 */

const ru = {
  title: 'Банановая башня',
  tapToStart: 'Нажми, чтобы начать',
  tapToDrop: 'Нажимай, чтобы ставить ящики',
  floors: 'Этажей',
  best: 'Рекорд',
  coins: 'Бананы',
  perfect: 'Идеально!',
  gameOver: 'Башня рухнула',
  tapToRestart: 'Нажми, чтобы начать заново',
  newRecord: 'Новый рекорд!',
  loading: 'Загрузка…',

  // Кнопки
  play: 'Играть',
  retry: 'Ещё раз',
  menu: 'В меню',
  resume: 'Продолжить',
  paused: 'Пауза',
  howToPlay: 'Как играть',
  close: 'Понятно',

  // Обучение
  howtoTitle: 'Как играть',
  howto1: 'Ящик с бананами качается на лиане. Нажми — и он упадёт вниз.',
  howto2: 'Точно над башней — идеальная посадка: ящик не теряет ширину.',
  howto3: 'Промахнулся — ящик обрежет. Башня накренится, а выше начнётся ветер.',
  howto4: 'Четыре идеальных подряд возвращают потерянную ширину.',

  // Итоги забега
  resultFloors: 'Этажей построено',
  resultBananas: 'Бананов собрано',
  wind: 'Ветер',

  // Режимы
  modeClassic: 'Классика',
  modeStorm: 'Шторм',
  stormLocked: 'Постройте 20 этажей в классике',
  stormHint: 'Сильный ветер с самого низа. Награда ×1,5',

  // Разделы меню
  shop: 'Магазин',
  missions: 'Задания',
  awards: 'Награды',
  leaderboard: 'Рекорды',

  // Магазин
  shopTitle: 'Магазин',
  owned: 'Куплено',
  equipped: 'Надето',
  equip: 'Надеть',
  buy: 'Купить',
  notEnough: 'Не хватает бананов',
  skinClassic: 'Дерево',
  skinBamboo: 'Бамбук',
  skinMahogany: 'Красное дерево',
  skinFrost: 'Иней',
  skinCharcoal: 'Уголь',
  skinGold: 'Золото',

  // Задания
  missionsTitle: 'Задания дня',
  missionsHint: 'Обновляются каждый день',
  claim: 'Забрать',
  claimed: 'Получено',
  missionFloors: 'Построй {n} этажей за забег',
  missionCoins: 'Собери {n} бананов',
  missionStreak: 'Серия из {n} идеальных',
  missionPerfects: 'Сделай {n} идеальных посадок',
  missionRuns: 'Сыграй {n} забегов',

  // Достижения
  awardsTitle: 'Награды',
  achFloors10: 'Построй 10 этажей',
  achFloors25: 'Построй 25 этажей',
  achFloors50: 'Построй 50 этажей',
  achFloors100: 'Построй 100 этажей',
  achStreak5: 'Серия из 5 идеальных',
  achStreak15: 'Серия из 15 идеальных',
  achTotal500: '500 этажей всего',
  achTotal2000: '2000 этажей всего',
  achPerfect100: '100 идеальных посадок',
  achStorm25: '25 этажей в шторме',

  // Лидерборд
  leaderboardTitle: 'Рекорды',
  leaderboardEmpty: 'Таблица пока пуста',
  leaderboardOffline: 'Таблица рекордов сейчас недоступна',
  you: 'Вы',

  // Ежедневный бонус
  dailyBonus: 'Ежедневный бонус',
  dailyBonusGot: 'Бонус получен',
  take: 'Забрать',

  // Реклама
  doubleReward: 'Удвоить бананы',
  watchAd: 'за просмотр рекламы',
  adUnavailable: 'Реклама недоступна',
  rewardDoubled: 'Бананы удвоены!',
} as const;

const en: Record<keyof typeof ru, string> = {
  title: 'Banana Tower',
  tapToStart: 'Tap to start',
  tapToDrop: 'Tap to drop crates',
  floors: 'Floors',
  best: 'Best',
  coins: 'Bananas',
  perfect: 'Perfect!',
  gameOver: 'The tower fell',
  tapToRestart: 'Tap to restart',
  newRecord: 'New record!',
  loading: 'Loading…',

  play: 'Play',
  retry: 'Again',
  menu: 'Menu',
  resume: 'Resume',
  paused: 'Paused',
  howToPlay: 'How to play',
  close: 'Got it',

  howtoTitle: 'How to play',
  howto1: 'A crate of bananas swings on a vine. Tap and it drops.',
  howto2: 'Land it dead centre for a perfect hit — the crate keeps its full width.',
  howto3: 'Miss and the crate gets trimmed. The tower leans, and higher up the wind picks up.',
  howto4: 'Four perfect hits in a row win back the width you lost.',

  resultFloors: 'Floors built',
  resultBananas: 'Bananas collected',
  wind: 'Wind',

  modeClassic: 'Classic',
  modeStorm: 'Storm',
  stormLocked: 'Reach 20 floors in Classic',
  stormHint: 'Strong wind from the ground up. Reward ×1.5',

  shop: 'Shop',
  missions: 'Tasks',
  awards: 'Awards',
  leaderboard: 'Scores',

  shopTitle: 'Shop',
  owned: 'Owned',
  equipped: 'Equipped',
  equip: 'Equip',
  buy: 'Buy',
  notEnough: 'Not enough bananas',
  skinClassic: 'Timber',
  skinBamboo: 'Bamboo',
  skinMahogany: 'Mahogany',
  skinFrost: 'Frost',
  skinCharcoal: 'Charcoal',
  skinGold: 'Gold',

  missionsTitle: 'Daily tasks',
  missionsHint: 'A new set every day',
  claim: 'Claim',
  claimed: 'Claimed',
  missionFloors: 'Build {n} floors in one run',
  missionCoins: 'Collect {n} bananas',
  missionStreak: 'Get a streak of {n} perfect hits',
  missionPerfects: 'Land {n} perfect hits',
  missionRuns: 'Play {n} runs',

  awardsTitle: 'Awards',
  achFloors10: 'Build 10 floors',
  achFloors25: 'Build 25 floors',
  achFloors50: 'Build 50 floors',
  achFloors100: 'Build 100 floors',
  achStreak5: 'A streak of 5 perfect hits',
  achStreak15: 'A streak of 15 perfect hits',
  achTotal500: '500 floors in total',
  achTotal2000: '2000 floors in total',
  achPerfect100: '100 perfect landings',
  achStorm25: '25 floors in Storm',

  leaderboardTitle: 'Scores',
  leaderboardEmpty: 'No scores yet',
  leaderboardOffline: 'The score table is unavailable right now',
  you: 'You',

  dailyBonus: 'Daily bonus',
  dailyBonusGot: 'Bonus claimed',
  take: 'Claim',

  doubleReward: 'Double the bananas',
  watchAd: 'for watching an ad',
  adUnavailable: 'Ads unavailable',
  rewardDoubled: 'Bananas doubled!',
};

export type Key = keyof typeof ru;

/** Русскоязычная витрина — не только код ru. */
const RU_LOCALES = new Set(['ru', 'be', 'kk', 'uk', 'uz']);

let dict: Record<Key, string> = ru;

export function setLang(rawLang: string): void {
  const code = (rawLang || 'ru').toLowerCase().split('-')[0] ?? 'ru';
  dict = RU_LOCALES.has(code) ? ru : en;
}

export function t(key: Key): string {
  return dict[key];
}

/**
 * Строка с подстановкой: `t('missionFloors')` → «Построй {n} этажей за забег».
 * Плейсхолдер, а не склейка из двух половин: порядок слов в русском и
 * английском разный, и склейка неизбежно даёт кривую фразу в одном из них.
 */
export function tf(key: Key, values: Record<string, string | number>): string {
  return dict[key].replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = values[name];
    return v === undefined ? m : String(v);
  });
}
