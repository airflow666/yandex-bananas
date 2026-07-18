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
