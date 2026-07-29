/**
 * Точка входа.
 *
 * Порядок здесь важен и выстроен вокруг п. 1.14. Игра запускается и
 * отрисовывает первый кадр НЕ дожидаясь платформы: SDK инициализируется в
 * фоне, а `markLoaded()` уходит сразу, как только игрок реально может
 * играть. Ни один сетевой вызов не стоит на пути между загрузкой бандла и
 * первым кадром — именно это раньше давало пустой экран.
 */

import { platform } from './platform/yandex';
import { bindLifecycle, onPause, onResume, onTeardown } from './platform/lifecycle';
import { createSurface, beginFrame, getCanvas } from './core/canvas';
import { onLayout } from './core/layout';
import { bindInput, onTap } from './core/input';
import { Loop } from './core/loop';
import { SaveStore } from './core/storage';
import { setLang, t } from './i18n';
import { Session } from './game/session';
import { render } from './render/scene';

interface SaveShape extends Record<string, unknown> {
  best: number;
  coins: number;
}

const saves = new SaveStore<SaveShape>({ best: 0, coins: 0 });

function boot(): void {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game container missing');

  createSurface(parent);
  bindInput(getCanvas());

  const session = new Session();
  onLayout(() => session.relayout());

  const loop = new Loop({
    update: (dt) => {
      const wasPlaying = session.phase === 'playing';
      session.update(dt);
      // Забег закончился именно в этом кадре — фиксируем результат.
      if (wasPlaying && session.phase === 'over') endRun(session);
    },
    render: () => {
      const ctx = beginFrame();
      render(ctx, session);
    },
  });

  onTap(() => {
    const before = session.phase;
    session.tap();
    if (before !== 'playing' && session.phase === 'playing') platform.gameplayStart();
  });

  // Пауза — единая точка: реклама, сворачивание вкладки, окно покупки.
  onPause(() => { loop.setPaused(true); platform.gameplayStop(); });
  onResume(() => loop.setPaused(false));
  onTeardown(() => saves.flush());

  loop.start();

  // Для отладки и автотестов: в скрытой вкладке requestAnimationFrame не
  // идёт, и симуляцию приходится крутить вручную.
  (window as unknown as Record<string, unknown>).__session = session;
  (window as unknown as Record<string, unknown>).__saves = saves;

  // Первый кадр отрисован, игрок может играть — сообщаем платформе.
  // Вызов идемпотентен и буферизуется, если SDK ещё не приехал.
  platform.markLoaded();
  document.getElementById('boot-status')?.remove();

  // Платформа подключается в фоне и ничего не блокирует.
  void platform.boot().then(async () => {
    setLang(platform.lang);
    bindLifecycle();
    await saves.load();
  });
}

function endRun(session: Session): void {
  platform.gameplayStop();
  const floors = session.tower.floors;
  saves.update((d) => {
    if (floors > d.best) d.best = floors;
    d.coins += session.coins;
  });
  void platform.setLeaderboardScore(Math.max(floors, saves.data.best));
}

try {
  boot();
} catch (e) {
  // Единственный по-настоящему фатальный случай — показываем текст, а не
  // пустой фон: иначе отличить «не загрузилось» от «зависло» невозможно.
  const node = document.getElementById('boot-status');
  if (node) node.textContent = `${t('loading')} — ${String(e)}`;
  console.error('[boot] failed', e);
}
