/**
 * Точка входа.
 *
 * Порядок здесь важен и выстроен вокруг п. 1.14. Игра запускается и
 * отрисовывает первый кадр НЕ дожидаясь платформы: SDK инициализируется в
 * фоне, а `markLoaded()` уходит сразу, как только игрок реально может
 * играть. Ни один сетевой вызов не стоит на пути между загрузкой бандла и
 * первым кадром — именно это раньше давало пустой экран.
 *
 * Спрайты — единственное, чего мы ждём до первого кадра, и ждём осознанно:
 * они собираются локально из SVG в бандле (никакой сети), занимают
 * десятки миллисекунд, а показать кадр без графики хуже, чем показать его
 * на кадр позже. Отказ растеризации не блокирует запуск.
 */

import { platform } from './platform/yandex';
import { bindLifecycle, onPause, onResume, onTeardown } from './platform/lifecycle';
import { createSurface, beginFrame, getCanvas, getPixelScale, onPixelScale } from './core/canvas';
import { getLayout, onLayout } from './core/layout';
import { bindInput, onPress, onRelease, onMove, onEscape, canHover } from './core/input';
import { Loop } from './core/loop';
import { SaveStore } from './core/storage';
import { setLang, t, type Key } from './i18n';
import {
  DEFAULT_PROGRESS, applyRun, canClaimDailyBonus, claimDailyBonus,
  claimMission, dayIndex, isMissionDone, isStormUnlocked, missionsForDay,
  newlyEarned, rotateMissions, ACHIEVEMENTS,
  type ProgressData,
} from './game/progress';
import { SKINS, skinById } from './game/skins';
import { setCrateTint } from './render/tower';
import { Session } from './game/session';
import { render } from './render/scene';
import { initSprites } from './art/sprites';
import { setPixelScale } from './art/svgRaster';
import { audio } from './audio';
import { BIOMES } from './art/theme';
import { buttonAt, drawUi, screenButtons, type UiAction, type UiState } from './ui/screens';

const saves = new SaveStore<ProgressData>({ ...DEFAULT_PROGRESS });

/** Состояние интерфейса. Живёт отдельно от Session: это не часть симуляции. */
const ui: UiState = {
  paused: false,
  overlay: 'none',
  mode: 'classic',
  best: 0,
  bestStorm: 0,
  isRecord: false,
  muted: false,
  progress: saves.data,
  leaderboard: null,
  leaderboardLoading: false,
  online: false,
  canDouble: false,
  toast: null,
  toastUntil: 0,
};

/** Показать короткое сообщение. Единственный способ ответить на «не вышло». */
function toast(key: Key): void {
  ui.toast = key;
  ui.toastUntil = performance.now() + 1800;
}

/** Указатель для кнопок: где он, что нажато, что подсвечено. */
const pointer = { x: -9999, y: -9999, pressed: null as UiAction | null, hovered: null as UiAction | null };

async function boot(): Promise<void> {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game container missing');

  createSurface(parent);
  bindInput(getCanvas());

  const session = new Session();
  onLayout(() => session.relayout());

  // Векторные спрайты растеризуются под фактический масштаб экрана и
  // пересобираются при его смене (поворот, другой монитор, зум).
  onPixelScale((scale) => setPixelScale(scale));
  try {
    await initSprites(getPixelScale());
  } catch (e) {
    console.warn('[boot] sprite preload failed, continuing', e);
  }

  const loop = new Loop({
    update: (dt) => {
      // Пауза интерфейса замораживает симуляцию, но не сам цикл: кнопки
      // паузы обязаны оставаться живыми и перерисовываться.
      if (ui.paused || ui.overlay !== 'none') return;
      const wasPlaying = session.phase === 'playing';
      session.update(dt);
      // Забег закончился именно в этом кадре — фиксируем результат.
      if (wasPlaying && session.phase === 'over') endRun(session);
      // Очередь событий разбирается КАЖДЫЙ кадр, иначе она растёт без предела.
      audio.play(session.takeEvents());
      // Музыка следует за биомом: чем выше башня, тем больше слоёв.
      audio.setBiomeIntensity(biomeIntensity(session.tower.floors));
    },
    render: () => {
      const ctx = beginFrame();
      render(ctx, session);
      drawUi(ctx, session, getLayout(), ui, pointer, session.coins);
    },
  });

  // --- ввод -----------------------------------------------------------

  const buttons = () => screenButtons(getLayout(), session, ui);

  onPress((p) => {
    // Первое касание — единственный момент, когда браузер разрешает создать
    // AudioContext. Делаем это до любой другой реакции на нажатие, чтобы
    // звук самого этого нажатия уже был слышен.
    audio.unlock();
    if (saves.data.muted !== audio.muted) audio.setMuted(saves.data.muted);

    pointer.x = p.x;
    pointer.y = p.y;
    const b = buttonAt(buttons(), p.x, p.y);
    if (b) {
      // Нажатие на кнопку только подсвечивает её: действие произойдёт по
      // отпусканию, и игрок может передумать, уведя палец.
      pointer.pressed = b.id;
      return;
    }
    pointer.pressed = null;
    if (ui.overlay !== 'none') return;
    // Мимо кнопок — это игровое действие, и оно обязано сработать
    // немедленно: игра на тайминг не прощает задержки до pointerup.
    if (session.phase === 'playing' && !ui.paused) session.tap();
    // В меню тап по экрану тоже начинает игру — это ровно то, что обещает
    // подсказка «Нажми, чтобы начать». На экране итогов так НЕ делаем:
    // случайный тап после проигрыша не должен съедать результат.
    else if (session.phase === 'menu') activate('play', session);
  });

  onRelease((p) => {
    const pressed = pointer.pressed;
    pointer.pressed = null;
    if (!pressed) return;
    const b = buttonAt(buttons(), p.x, p.y);
    // Действие засчитывается, только если палец отпущен на той же кнопке.
    if (b && b.id === pressed) activate(b.id, session, b.index ?? 0);
  });

  onMove((p) => {
    pointer.x = p.x;
    pointer.y = p.y;
    const b = buttonAt(buttons(), p.x, p.y);
    pointer.hovered = canHover() && b ? b.id : null;
    // Палец уехал с зажатой кнопки — снимаем подсветку нажатия.
    if (pointer.pressed && (!b || b.id !== pointer.pressed)) pointer.pressed = null;
  });

  // Escape — привычная пауза на десктопе.
  onEscape(() => {
    if (ui.overlay !== 'none') { ui.overlay = 'none'; return; }
    if (session.phase === 'playing') togglePause(!ui.paused);
  });

  // --- жизненный цикл --------------------------------------------------

  // Пауза — единая точка: реклама, сворачивание вкладки, окно покупки.
  onPause(() => {
    loop.setPaused(true);
    platform.gameplayStop();
    // Требование площадки: звук обязан замолкать при сворачивании вкладки.
    audio.setSuspended(true);
  });
  onResume(() => {
    // Возврат из фона НЕ возобновляет игру автоматически, если игрок сам
    // поставил паузу: иначе сворачивание вкладки отменяло бы его решение.
    loop.setPaused(false);
    audio.setSuspended(false);
    // GameplayAPI обязан быть возобновлён симметрично остановке (п. 1.19).
    // Без этого после сворачивания вкладки или показа рекламы посреди забега
    // площадка до самого конца забега считала бы, что геймплей не идёт:
    // stop() был, start() — нет.
    if (session.phase === 'playing' && !ui.paused) platform.gameplayStart();
  });
  onTeardown(() => saves.flush());

  loop.start();

  // Для отладки и автотестов: в скрытой вкладке requestAnimationFrame не
  // идёт, и симуляцию приходится крутить вручную.
  const dbg = window as unknown as Record<string, unknown>;
  dbg.__session = session;
  dbg.__saves = saves;
  dbg.__ui = ui;
  dbg.__audio = audio;
  // Кнопки текущего экрана — чтобы автотест целился по фактической
  // раскладке, а не повторял её вычисление у себя и не расходился с ней.
  dbg.__buttons = buttons;
  // Чистая логика меты — её можно прогнать на отдельном объекте, не трогая
  // сохранения игрока. Нужно для автотестов раздела верификации.
  dbg.__meta = {
    DEFAULT_PROGRESS, applyRun, newlyEarned, rotateMissions, missionsForDay,
    claimMission, isMissionDone, dayIndex, isStormUnlocked, ACHIEVEMENTS,
  };

  // Первый кадр отрисован, игрок может играть — сообщаем платформе.
  // Вызов идемпотентен и буферизуется, если SDK ещё не приехал.
  platform.markLoaded();
  document.getElementById('boot-status')?.remove();

  // Платформа подключается в фоне и ничего не блокирует.
  void platform.boot().then(async () => {
    setLang(platform.lang);
    bindLifecycle();
    await saves.load();
    // ui.progress обязан указывать на АКТУАЛЬНЫЙ объект: load() заменяет
    // saves.data целиком, и старая ссылка показывала бы дефолты вечно.
    ui.progress = saves.data;
    ui.best = saves.data.best;
    ui.bestStorm = saves.data.bestStorm;
    ui.muted = Boolean(saves.data.muted);
    ui.online = !platform.isMock;
    audio.setMuted(ui.muted);
    applySkin();

    // Задания дня и ежедневный бонус — при заходе, а не по кнопке: бонус,
    // за которым надо охотиться по меню, не выполняет своей задачи.
    const day = dayIndex();
    let bonus = 0;
    saves.update((d) => {
      rotateMissions(d, day);
      if (canClaimDailyBonus(d, day)) bonus = claimDailyBonus(d, day);
    });
    if (bonus > 0) toast('dailyBonus');

    // Sticky-баннер — единственный допустимый дополнительный формат.
    void platform.showBanner();
  });

  /**
   * Старт забега. Реклама показывается ДО него и ОЖИДАЕТСЯ.
   *
   * Раньше вызов не ожидался (`void maybeInterstitial()`), забег стартовал в
   * ту же миллисекунду, и ролик всплывал поверх уже идущего геймплея — это
   * прямое нарушение п. 4.4 «реклама показывается только в логических
   * паузах». Теперь ролик идёт, пока игрок ещё на экране итогов или в меню,
   * то есть в настоящей паузе, и забег начинается после его закрытия.
   */
  let starting = false;

  async function startRun(s: Session): Promise<void> {
    // Пока крутится ролик, экран остаётся живым, и по нему можно нажать ещё
    // раз. Без флага это запустило бы вторую реклама-и-старт параллельно.
    if (starting) return;
    starting = true;
    try {
      ui.isRecord = false;
      ui.paused = false;
      ui.canDouble = false;
      await maybeInterstitial();
      s.reset(ui.mode);
      platform.gameplayStart();
    } finally {
      starting = false;
    }
  }

  function togglePause(value: boolean): void {
    ui.paused = value;
    if (value) platform.gameplayStop();
    else platform.gameplayStart();
  }

  function activate(id: UiAction, s: Session, pressedIndex = 0): void {
    // Щелчок звучит до самого действия: реакция на нажатие не должна ждать,
    // пока отработает переход экрана.
    if (id !== 'sound') audio.click();
    switch (id) {
      case 'sound':
        ui.muted = !ui.muted;
        audio.setMuted(ui.muted);
        // Настройка переживает перезагрузку — иначе выключать звук пришлось
        // бы каждый заход.
        saves.update((d) => { d.muted = ui.muted; });
        if (!ui.muted) audio.click();
        break;
      case 'play':
      case 'retry': {
        // Заперт шторм — не пускаем и объясняем условие, а не молча ничего
        // не делаем: кнопка обязана отвечать на нажатие.
        if (ui.mode === 'storm' && !isStormUnlocked(saves.data)) {
          toast('stormLocked');
          break;
        }
        void startRun(s);
        break;
      }
      case 'menu':
        ui.paused = false;
        s.phase = 'menu';
        platform.gameplayStop();
        break;
      case 'pause':
        togglePause(true);
        break;
      case 'resume':
        togglePause(false);
        break;
      case 'howto':
        ui.overlay = 'howto';
        break;
      case 'close':
        ui.overlay = 'none';
        break;

      // --- разделы меню
      case 'shop':
      case 'missions':
      case 'awards':
        ui.overlay = id;
        break;
      case 'leaderboard':
        ui.overlay = 'leaderboard';
        void loadLeaderboard();
        break;

      case 'mode':
        // Переключение по кругу. Заперт шторм — переключить дают, но старт
        // не пустит: так игрок узнаёт, что режим существует, и видит условие.
        ui.mode = ui.mode === 'classic' ? 'storm' : 'classic';
        break;

      case 'double':
        void doubleReward(s);
        break;

      case 'row':
        handleRow(pressedIndex);
        break;
    }
  }

  /** Нажатие по строке списка — что именно, зависит от открытого раздела. */
  function handleRow(index: number): void {
    if (ui.overlay === 'shop') {
      const skin = SKINS[index];
      if (!skin) return;
      const owned = saves.data.ownedSkins.includes(skin.id);
      if (owned) {
        saves.update((d) => { d.skin = skin.id; });
      } else if (saves.data.coins >= skin.price) {
        saves.update((d) => {
          d.coins -= skin.price;
          d.ownedSkins.push(skin.id);
          d.skin = skin.id;
        });
      } else {
        toast('notEnough');
        return;
      }
      applySkin();
      return;
    }
    if (ui.overlay === 'missions') {
      let reward = 0;
      saves.update((d) => { reward = claimMission(d, index); });
      if (reward > 0) audio.play([{ kind: 'record' }]);
    }
  }

  /**
   * Rewarded-видео за удвоение награды. Требования площадки, которые здесь
   * закрыты: показ только по явной кнопке, на кнопке написано, что будет
   * реклама и какая награда, награда — бонус СВЕРХУ (без неё бананы уже
   * начислены), засчитывается только по onRewarded.
   */
  async function doubleReward(s: Session): Promise<void> {
    if (!ui.canDouble) return;
    ui.canDouble = false;
    const bonus = s.coins;
    const res = await platform.showRewarded();
    if (res.rewarded) {
      saves.update((d) => { d.coins += bonus; });
      toast('rewardDoubled');
    } else {
      toast('adUnavailable');
    }
  }

  /** Скин из сохранений — в рендер. Одна точка, чтобы не разъехалось. */
  function applySkin(): void {
    const skin = skinById(saves.data.skin);
    setCrateTint(skin.tint, skin.strength);
  }

  async function loadLeaderboard(): Promise<void> {
    ui.leaderboardLoading = true;
    ui.leaderboard = await platform.getLeaderboardEntries(t('you'));
    ui.leaderboardLoading = false;
  }
}

/**
 * Интенсивность музыки по высоте: доля пройденного пути до последнего биома.
 * Слои вводятся тем же числом, что управляет светом, поэтому картинка и звук
 * светлеют синхронно.
 */
function biomeIntensity(floors: number): number {
  const last = BIOMES[BIOMES.length - 1]?.from ?? 110;
  return Math.min(1, floors / last);
}

/**
 * Межстраничная реклама между забегами.
 *
 * Требования площадки, которые здесь закрыты: показ только в логической
 * паузе (мы стоим на экране итогов/меню и стартуем новый забег, активного
 * геймплея нет) и никогда по таймеру во время игры. Сверх требований —
 * собственные ограничители: не раньше чем через 3 минуты после прошлой и не
 * на первых двух забегах. Реклама в лицо новому игроку — верный способ
 * потерять его до того, как он поймёт, во что играет.
 */
const INTERSTITIAL_GAP_MS = 180_000;
const INTERSTITIAL_MIN_RUNS = 2;
let lastInterstitialAt = 0;

async function maybeInterstitial(): Promise<void> {
  if (saves.data.totalRuns < INTERSTITIAL_MIN_RUNS) return;
  const now = Date.now();
  if (now - lastInterstitialAt < INTERSTITIAL_GAP_MS) return;
  lastInterstitialAt = now;
  // Пауза и звук снимаются самой платформой через game_api_pause/resume,
  // на которые подписан lifecycle — отдельного управления тут не нужно.
  await platform.showInterstitial();
}

function endRun(session: Session): void {
  platform.gameplayStop();
  const floors = session.tower.floors;
  const mode = session.mode;
  const before = mode === 'storm' ? saves.data.bestStorm : saves.data.best;
  ui.isRecord = floors > before;

  saves.update((d) => {
    rotateMissions(d, dayIndex());
    applyRun(d, {
      mode,
      floors,
      coins: session.coins,
      bestStreak: session.bestStreak,
      perfects: session.perfects,
    });
    // Достижения проверяются ПОСЛЕ записи забега, иначе результат этого
    // забега в них не попадёт.
    for (const a of newlyEarned(d)) {
      d.achievements.push(a.id);
      d.coins += a.reward;
    }
  });

  ui.best = saves.data.best;
  ui.bestStorm = saves.data.bestStorm;
  // Удвоить можно только то, что заработано, и только если реклама реальна.
  ui.canDouble = session.coins > 0 && !platform.isMock;

  // Фанфару ставит владелец сохранений: только он знает про рекорд.
  if (ui.isRecord && floors > 0) session.emit({ kind: 'record' });
  // В таблицу идёт только классика: шторм — другой набор правил, и мешать
  // их результаты в одном рейтинге нечестно.
  if (mode === 'classic') {
    void platform.setLeaderboardScore(Math.max(floors, saves.data.best));
  }
}

void boot().catch((e) => {
  // Единственный по-настоящему фатальный случай. Анимация загрузки молчалива
  // и при зависании неотличима от нормальной работы, поэтому здесь её
  // ОСТАНАВЛИВАЕМ и показываем текст ошибки — иначе «не загрузилось» и
  // «грузится» выглядят одинаково.
  const node = document.getElementById('boot-status');
  if (node) {
    node.replaceChildren();
    const err = document.createElement('div');
    err.className = 'err';
    err.textContent = `${t('loading')} — ${String(e)}`;
    node.append(err);
  }
  console.error('[boot] failed', e);
});
