# Карточка игры для консоли Яндекс Игр

Готовые материалы и тексты — скопируй в соответствующие поля консоли
([games.yandex.ru/console](https://games.yandex.ru/console/)).

## Файлы в этой папке

| Файл | Куда загружать |
|---|---|
| `icon-512.png` | Иконка игры (512×512, без текста — по требованиям Яндекса) |
| `cover-800x470.png` | Обложка / промо-изображение |
| `screenshot-1-menu.png` … `screenshot-5-shop.png` | Скриншоты (портрет 480×854) |

## Название

- **RU:** Банановая башня
- **EN:** Banana Tower

## Короткое описание

- **RU:** Строй башню из бананов! Тапни вовремя, поймай идеальное комбо и побей рекорды друзей.
- **EN:** Stack the banana tower! Tap at the right moment, catch perfect combos and beat your friends' records.

## Полное описание

**RU:**

Связка бананов качается над башней — тапни в нужный момент, чтобы поставить её ровно!

🍌 Поставил неровно — край отрежется, и башня станет уже. Промахнулся совсем — башня рухнет!
🍌 Идеальное попадание сохраняет ширину и даёт комбо: чем длиннее серия, тем больше бананов.
🍌 Чем выше башня, тем быстрее качается блок: поднимись из джунглей до самого космоса.
🍌 Собирай бананы, открывай скины и заходи каждый день за бонусом.
🍌 Соревнуйся с другими игроками в таблице рекордов.

Простая, залипательная и бесплатная. Сколько этажей построишь ты?

**EN:**

A bunch of bananas swings above the tower — tap at the right moment to place it!

🍌 Land it off-center and the overhang gets cut off, making the tower narrower. Miss completely and the tower falls!
🍌 A perfect drop keeps the full width and builds a combo: the longer the streak, the more bananas you earn.
🍌 The higher the tower, the faster the swing: climb from the jungle all the way to space.
🍌 Collect bananas, unlock skins and come back daily for bonuses.
🍌 Compete with other players on the leaderboard.

Simple, addictive and free. How many floors can you stack?

## Настройки в консоли

- **Категория:** Аркады (доп.: Казуальные)
- **Возрастной рейтинг:** 0+ (нет насилия, покупок за реальные деньги, внешних ссылок)
- **Ориентация:** портретная (на десктопе игра корректно работает в любом окне — Scale.FIT)
- **Устройства:** десктоп + мобильные + планшеты (управление: тап / клик / пробел)
- **Лидерборд:** создать с техническим именем `towerScore`, тип «числовой»,
  сортировка «больше — лучше» (имя должно совпадать с `LEADERBOARD_NAME` в `src/yandex/sdk.js`)
- **Монетизация:** включить показ рекламы (interstitial + rewarded + sticky-баннер уже встроены в игру)
