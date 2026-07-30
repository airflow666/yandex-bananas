/**
 * Скриншоты для черновика — НАСТОЯЩИМ рендером игры.
 *
 * Здесь не рисуется ни одного пикселя «от руки». Поднимается обычная
 * `Session`, симулируется забег до нужной высоты, и кадр рисуется теми же
 * `render()` и `drawUi()`, что и в игре. Поэтому п. 5.1.1.2 («настоящий
 * геймплей не менее чем на 70% кадра») выполняется буквально: это и есть
 * геймплей, просто снятый в заданном разрешении и в заданной точке забега,
 * а не там, где случайно оказался живой игрок.
 *
 * Требования к размерам (docs/yandex-notes.md): длинная сторона 1280–2560,
 * десктоп строго 16:9, мобильные 16:9 или 9:16.
 */

import { updateLayout, getLayout, BASE_H } from '../src/core/layout';
import { Session } from '../src/game/session';
import { render } from '../src/render/scene';
import { drawUi, type UiState } from '../src/ui/screens';
import { DEFAULT_PROGRESS } from '../src/game/progress';
import type { GameMode } from '../src/game/modes';
import { setLang } from '../src/i18n';

export interface ShotSpec {
  name: string;
  w: number;
  h: number;
  mode: GameMode;
  /** До какой высоты доводим башню. */
  floors: number;
  /** Доля идеальных посадок — чем ниже, тем кривее и «живее» башня. */
  accuracy: number;
  /** Язык HUD в кадре. Витрина двуязычная — комплект нужен на оба. */
  lang: 'ru' | 'en';
}

/** Сцены: биом, режим и высота. Имя файла и язык добавляются ниже. */
const SCENES: { slug: string; mode: GameMode; floors: number; accuracy: number }[] = [
  { slug: 'canopy', mode: 'classic', floors: 16, accuracy: 0.8 },
  { slug: 'clouds', mode: 'classic', floors: 64, accuracy: 0.7 },
  { slug: 'storm', mode: 'storm', floors: 28, accuracy: 0.6 },
];

const FORMATS: { slug: string; w: number; h: number }[] = [
  // Десктоп — строго 16:9. Мобильные — 9:16.
  { slug: 'desktop', w: 1920, h: 1080 },
  { slug: 'mobile', w: 1080, h: 1920 },
];

/**
 * Полный комплект: два формата × три сцены × два языка. Высота башни на
 * мобильных берётся чуть меньше — кадр уже, и та же башня уезжает за кромку.
 */
export const SHOTS: ShotSpec[] = FORMATS.flatMap((f) =>
  (['ru', 'en'] as const).flatMap((lang) =>
    SCENES.map((s) => ({
      name: `${f.slug}-${lang}-${s.slug}.png`,
      w: f.w,
      h: f.h,
      mode: s.mode,
      floors: f.slug === 'mobile' ? Math.round(s.floors * 0.9) : s.floors,
      accuracy: s.accuracy,
      lang,
    })),
  ),
);

/** Интерфейсное состояние для кадра: чистый HUD, без меню и модалок. */
function shotUi(): UiState {
  return {
    paused: false,
    overlay: 'none',
    mode: 'classic',
    best: 0,
    bestStorm: 0,
    isRecord: false,
    muted: false,
    progress: { ...DEFAULT_PROGRESS },
    leaderboard: null,
    leaderboardLoading: false,
    online: false,
    canDouble: false,
    toast: null,
    toastUntil: 0,
  };
}

/**
 * Довести башню до нужной высоты, играя «как человек».
 *
 * Маятник не отключается: вместо этого в момент тапа фаза подводится к
 * нужной точке. Идеальные попадания чередуются с промахами по заданной
 * доле — башня получается слегка кривой и живой, а не стерильной колонной,
 * какой она вышла бы при amplitude = 0.
 */
function buildTower(spec: ShotSpec): Session {
  const s = new Session();
  s.reset(spec.mode);

  const dt = 1 / 120;
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  while (s.tower.floors < spec.floors && s.phase === 'playing') {
    const prev = s.tower.top;
    // Целимся в верхушку с поправкой на крен, добавляя промах.
    const miss = rnd() < spec.accuracy ? 0 : (rnd() - 0.5) * prev.w * 0.5;
    s.pendulum.centerX = prev.x + s.tower.topOffsetX() + miss;
    const savedAmp = s.pendulum.amplitude;
    s.pendulum.amplitude = 0;
    s.tap();
    // Доводим ящик до посадки.
    for (let i = 0; i < 60 && s.falling; i++) s.update(dt);
    s.pendulum.amplitude = savedAmp;
    // Немного времени между этажами: камера догоняет, пыль оседает.
    for (let i = 0; i < 14; i++) s.update(dt);
  }

  // Пара секунд «дожития»: маятник отходит от края, ветер набирает фазу,
  // обезьяны занимают позы — кадр перестаёт выглядеть застывшим.
  for (let i = 0; i < 150; i++) s.update(dt);
  return s;
}

export function renderShot(spec: ShotSpec, canvas: HTMLCanvasElement): void {
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Раскладка игры считается от РЕАЛЬНЫХ размеров кадра — ровно как в
  // браузере игрока, поэтому композиция в скриншоте та же, что в игре.
  updateLayout(spec.w, spec.h);
  const L = getLayout();
  const scale = spec.h / BASE_H;

  // Язык HUD переключается ПЕРЕД отрисовкой: словарь — модульный синглтон,
  // и кадр берёт то, что стоит на момент вызова.
  setLang(spec.lang);

  const session = buildTower(spec);
  const ui = shotUi();
  ui.mode = spec.mode;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  render(ctx, session);
  drawUi(ctx, session, L, ui, { x: -9999, y: -9999, pressed: null, hovered: null }, session.coins);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
