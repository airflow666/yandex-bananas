/** Простая локализация RU/EN. Язык берётся из SDK (ysdk.environment.i18n.lang). */

const DICT = {
  ru: {
    title: 'БАНАНОВАЯ\nБАШНЯ',
    play: 'ИГРАТЬ',
    shop: 'Магазин',
    leaderboard: 'Рейтинг',
    tapToDrop: 'Тапни, чтобы сбросить блок!',
    score: 'Счёт',
    best: 'Рекорд',
    coins: 'Бананы',
    floors: 'этажей',
    floorForms: ['этаж', 'этажа', 'этажей'],
    player: 'Игрок',
    perfect: 'ИДЕАЛЬНО!',
    combo: 'КОМБО',
    gameOver: 'Башня рухнула!',
    newRecord: 'НОВЫЙ РЕКОРД!',
    secondLife: 'Вторая жизнь?',
    secondLifeDesc: 'Посмотри рекламу и продолжи строить',
    continueBtn: 'ПРОДОЛЖИТЬ',
    noThanks: 'Нет, спасибо',
    x2coins: 'x2 бананов',
    restart: 'ЗАНОВО',
    menu: 'Меню',
    watchAd: 'за рекламу',
    dailyBonus: 'Ежедневный бонус!',
    dailyStreak: 'Дней подряд:',
    claim: 'ЗАБРАТЬ',
    claimX2: 'ЗАБРАТЬ x2',
    skinsTitle: 'МАГАЗИН СКИНОВ',
    buy: 'КУПИТЬ',
    select: 'ВЫБРАТЬ',
    selected: 'ВЫБРАН',
    freeForAd: 'БЕСПЛАТНО',
    notEnough: 'Не хватает бананов!',
    topPlayers: 'ТОП ИГРОКОВ',
    yourResult: 'Ты',
    back: 'Назад',
    loading: 'Загрузка...',
    lbUnavailable: 'Войди в аккаунт Яндекса,\nчтобы участвовать в рейтинге',
    skin_classic: 'Классика',
    skin_golden: 'Золотой',
    skin_space: 'Космический',
    skin_rainbow: 'Радужный',
  },
  en: {
    title: 'BANANA\nTOWER',
    play: 'PLAY',
    shop: 'Shop',
    leaderboard: 'Rating',
    tapToDrop: 'Tap to drop the block!',
    score: 'Score',
    best: 'Best',
    coins: 'Bananas',
    floors: 'floors',
    floorForms: ['floor', 'floors'],
    player: 'Player',
    perfect: 'PERFECT!',
    combo: 'COMBO',
    gameOver: 'The tower collapsed!',
    newRecord: 'NEW RECORD!',
    secondLife: 'Second life?',
    secondLifeDesc: 'Watch an ad and keep building',
    continueBtn: 'CONTINUE',
    noThanks: 'No, thanks',
    x2coins: 'x2 bananas',
    restart: 'RESTART',
    menu: 'Menu',
    watchAd: 'watch ad',
    dailyBonus: 'Daily bonus!',
    dailyStreak: 'Day streak:',
    claim: 'CLAIM',
    claimX2: 'CLAIM x2',
    skinsTitle: 'SKIN SHOP',
    buy: 'BUY',
    select: 'SELECT',
    selected: 'SELECTED',
    freeForAd: 'FREE',
    notEnough: 'Not enough bananas!',
    topPlayers: 'TOP PLAYERS',
    yourResult: 'You',
    back: 'Back',
    loading: 'Loading...',
    lbUnavailable: 'Sign in to your Yandex account\nto join the rating',
    skin_classic: 'Classic',
    skin_golden: 'Golden',
    skin_space: 'Space',
    skin_rainbow: 'Rainbow',
  },
};

// Русский показываем всему русскоязычному каталогу Яндекса, не только lang=ru
const RU_LANGS = ['ru', 'be', 'kk', 'uk', 'uz'];

let currentLang = 'ru';

export function setLang(lang) {
  currentLang = RU_LANGS.includes(lang) ? 'ru' : 'en';
}

export function t(key) {
  return DICT[currentLang][key] ?? DICT.en[key] ?? key;
}

/**
 * Правильно склонённое слово для числа: этаж / этажа / этажей.
 * forms в словаре: [один, два-четыре, много] для ru; [one, many] для en.
 */
export function pluralWord(n, key) {
  const forms = DICT[currentLang][key] ?? DICT.en[key];
  if (currentLang === 'ru') {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }
  return n === 1 ? forms[0] : forms[1];
}
