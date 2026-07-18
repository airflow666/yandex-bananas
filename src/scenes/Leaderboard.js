import Phaser from 'phaser';
import { GAME_W, GAME_H, FONT, makeButton } from '../ui.js';
import { audio } from '../systems/audio.js';
import { t } from '../systems/i18n.js';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x1b4332).setOrigin(0);

    this.add.text(GAME_W / 2, 120, t('topPlayers'), {
      fontFamily: FONT, fontSize: '68px', color: '#ffe680', fontStyle: 'bold',
    }).setOrigin(0.5);

    const status = this.add.text(GAME_W / 2, GAME_H / 2, t('loading'), {
      fontFamily: FONT, fontSize: '48px', color: '#d8f3dc', align: 'center',
    }).setOrigin(0.5);

    makeButton(this, GAME_W / 2, GAME_H - 140, 480, 120, t('back'), () => {
      audio.click();
      this.scene.start('Menu');
    }, { variant: 'gray' });

    this._load(status);
  }

  async _load(status) {
    const sdk = this.registry.get('sdk');
    const res = await sdk.getLeaderboardEntries();
    if (!this.scene.isActive()) return;

    if (!res || !res.entries.length) {
      status.setText(t('lbUnavailable'));
      return;
    }
    status.destroy();

    res.entries.slice(0, 10).forEach((e, i) => {
      const y = 260 + i * 124;
      const isMe = !!e.isPlayer;
      const bg = this.add.graphics();
      bg.fillStyle(isMe ? 0xffd93b : 0x081c15, isMe ? 0.25 : 0.7)
        .fillRoundedRect(48, y, GAME_W - 96, 104, 24);

      const medals = ['🥇', '🥈', '🥉'];
      const rankLabel = e.rank <= 3 ? medals[e.rank - 1] : `${e.rank}.`;
      this.add.text(92, y + 52, rankLabel, {
        fontFamily: FONT, fontSize: '44px', color: '#ffe680', fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      const name = isMe ? `${e.name} (${t('yourResult')})` : e.name;
      this.add.text(210, y + 52, name, {
        fontFamily: FONT, fontSize: '40px', color: isMe ? '#ffe680' : '#ffffff',
      }).setOrigin(0, 0.5);

      this.add.text(GAME_W - 92, y + 52, String(e.score), {
        fontFamily: FONT, fontSize: '44px', color: '#95d5b2', fontStyle: 'bold',
      }).setOrigin(1, 0.5);
    });
  }
}
