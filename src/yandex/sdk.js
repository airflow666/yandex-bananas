/**
 * Адаптер между сценами и новым платформенным фасадом (src/platform/yandex.ts).
 *
 * Сцены пока написаны на старом интерфейсе; чтобы лечение п. 1.14 доехало до
 * черновика уже сейчас, а не после полной переработки геймплея, интерфейс
 * сохранён, а вся логика ушла в фасад. Сцены будут переписаны в следующей
 * итерации, после чего адаптер исчезнет.
 *
 * Локально (dev-сервер, тесты) настоящего SDK нет — работает mock-режим:
 * реклама «показывается» мгновенно с записью в лог, лидерборд отдаёт фейковый
 * топ. Сохранения в mock-режиме идут через тот же SaveStore, то есть в
 * localStorage.
 */

import { platform, LEADERBOARD_NAME as LB_NAME } from '../platform/yandex';
import { bindLifecycle } from '../platform/lifecycle';
import { t } from '../systems/i18n.js';

const LS_LB_KEY = 'bananaTower.mockLeaderboard';

export const LEADERBOARD_NAME = LB_NAME;

function mockLog(...args) {
  console.log('[YSDK-mock]', ...args);
  window.__ysdkMockLog = window.__ysdkMockLog || [];
  window.__ysdkMockLog.push(args.join(' '));
}

class SDKAdapter {
  get isMock() { return platform.isMock; }
  get lang() { return platform.lang; }

  loadingReady() {
    if (this.isMock) mockLog('LoadingAPI.ready');
    // Даже в mock-режиме вызываем: запрос буферизуется и уйдёт, если SDK
    // приедет с опозданием. Раньше он в этом случае терялся навсегда, и
    // лоадер Яндекса оставался на экране — внешне «игра зависла».
    platform.markLoaded();
  }

  gameplayStart() {
    if (this.isMock) mockLog('GameplayAPI.start');
    platform.gameplayStart();
  }

  gameplayStop() {
    if (this.isMock) mockLog('GameplayAPI.stop');
    platform.gameplayStop();
  }

  showInterstitial() {
    if (this.isMock) {
      mockLog('showFullscreenAdv');
      return Promise.resolve({ wasShown: true });
    }
    return platform.showInterstitial();
  }

  showRewarded() {
    if (this.isMock) {
      mockLog('showRewardedVideo');
      return Promise.resolve({ rewarded: true });
    }
    return platform.showRewarded();
  }

  async showBanner() {
    if (this.isMock) { mockLog('showBannerAdv'); return; }
    await platform.showBanner();
  }

  async hideBanner() {
    if (this.isMock) { mockLog('hideBannerAdv'); return; }
    await platform.hideBanner();
  }

  async setLeaderboardScore(score) {
    if (this.isMock) {
      mockLog('setLeaderboardScore', score);
      const prev = Number(localStorage.getItem(LS_LB_KEY)) || 0;
      if (score > prev) localStorage.setItem(LS_LB_KEY, String(score));
      return;
    }
    await platform.setLeaderboardScore(score);
  }

  async getLeaderboardEntries() {
    if (this.isMock) {
      mockLog('getLeaderboardEntries');
      const myScore = Number(localStorage.getItem(LS_LB_KEY)) || 0;
      const fake = [
        { name: 'BananaKing', score: 184 }, { name: 'Обезьянка99', score: 121 },
        { name: 'StackMaster', score: 96 }, { name: 'Кожура', score: 71 },
        { name: 'MinionFan', score: 44 }, { name: 'Джунгли', score: 23 },
      ];
      fake.push({ name: t('player'), score: myScore, isPlayer: true });
      fake.sort((a, b) => b.score - a.score);
      return { entries: fake.map((e, i) => ({ rank: i + 1, ...e })) };
    }
    const entries = await platform.getLeaderboardEntries(t('player'));
    return entries ? { entries } : null;
  }
}

/**
 * Инициализация платформы. Не блокирует игру дольше общего бюджета: если
 * SDK ответит позже, фасад подхватит его сам и доотправит накопленные вызовы.
 */
export async function initSDK() {
  await platform.boot();
  bindLifecycle();
  const adapter = new SDKAdapter();
  if (adapter.isMock) mockLog('init (mock mode)');
  window.__sdk = adapter; // для отладки и автотестов
  window.__platform = platform;
  return adapter;
}
