// Первым импортом — вешает обработчики ошибок до того, как выполнится
// код остальных модулей.
import { clearBootStatus, markStep, startWatchdog } from './bootStatus.js';
import Phaser from 'phaser';
import { GAME_W, GAME_H } from './ui.js';
import { audio } from './systems/audio.js';
import { saves } from './systems/saves.js';
import BootScene from './scenes/Boot.js';
import MenuScene from './scenes/Menu.js';
import GameScene from './scenes/Game.js';
import GameOverScene from './scenes/GameOver.js';
import ShopScene from './scenes/Shop.js';
import LeaderboardScene from './scenes/Leaderboard.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a2f1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, ShopScene, LeaderboardScene],
});

// Заглушку снимаем не по факту вызова конструктора, а по событию готовности
// движка: конструктор возвращается синхронно, до создания рендерера, и
// снятие заглушки здесь врало бы, если Phaser не поднялся.
game.events.once(Phaser.Core.Events.READY, () => {
  markStep('phaser-ready');
  clearBootStatus();
});

// Сторож живёт вне Phaser: если движок не поднимется вообще, ни один
// таймер внутри сцен не выполнится, и без этого игрок остался бы на пустом
// фоне без единого признака происходящего.
startWatchdog();

// Освобождаем контекст рендерера при уходе со страницы. Браузер держит
// ограниченное число живых WebGL-контекстов, и быстрые перезагрузки подряд
// (сценарий, которым проверяют п. 1.14) способны упереться в этот предел —
// тогда движок не стартует на пустом фоне.
window.addEventListener('pagehide', () => {
  try { game.destroy(true); } catch { /* уже уничтожен */ }
});

// Обратная сторона destroy(): при возврате «назад» страница может быть
// восстановлена из bfcache вместе с уже уничтоженной игрой — получился бы
// мёртвый канвас. Навигация по истории явно перечислена в п. 1.14, поэтому
// восстановленную страницу перезагружаем; прогресс от этого не страдает,
// он лежит в localStorage и в облаке.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});

// Когда вкладка скрыта — глушим звук (реклама управляет звуком отдельно, см. ads.js)
game.events.on(Phaser.Core.Events.HIDDEN, () => audio.ctx?.suspend());
game.events.on(Phaser.Core.Events.VISIBLE, () => {
  if (audio.enabled && !audio.suspendedByAd) audio.ctx?.resume();
});

// Требование модерации 1.6.2.7: взаимодействие с игровым полем не должно
// открывать браузерное контекстное меню (правый клик на десктопе).
document.getElementById('game')?.addEventListener('contextmenu', (e) => e.preventDefault());

window.__game = game;   // для автотестов
window.__saves = saves; // для автотестов
