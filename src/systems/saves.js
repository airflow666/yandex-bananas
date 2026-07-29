/**
 * Прогресс игрока: монеты, рекорд, скины, звук, ежедневный бонус.
 *
 * Запись идёт через core/storage.ts: изменение сразу фиксируется в
 * localStorage и объединяется в одну облачную запись. Прежняя схема слала
 * `setData(flush=true)` на каждое событие — три подряд в одном тике при
 * завершении забега, из-за чего покупка или рекорд могли молча потеряться.
 * Обновление страницы сразу после изменения больше ничего не теряет:
 * локальная копия обновляется синхронно, до всякой сети.
 */

import { SaveStore } from '../core/storage';

const DEFAULTS = {
  coins: 0,
  best: 0,
  ownedSkins: ['classic'],
  activeSkin: 'classic',
  soundOn: true,
  daily: { lastClaim: '', streak: 0 },
};

class Saves {
  constructor() {
    this.store = new SaveStore(DEFAULTS);
  }

  get data() { return this.store.data; }

  async load() {
    await this.store.load();
    const d = this.store.data;
    d.daily = { ...DEFAULTS.daily, ...(d.daily || {}) };
    if (!Array.isArray(d.ownedSkins)) d.ownedSkins = [...DEFAULTS.ownedSkins];
    if (!d.ownedSkins.includes('classic')) d.ownedSkins.push('classic');
  }

  /** Немедленный сброс в облако — критичные моменты (game over, покупка). */
  saveNow() { this.store.flush(); }

  addCoins(n) {
    this.store.update((d) => { d.coins += n; });
  }

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.store.update((d) => { d.coins -= n; });
    this.saveNow();
    return true;
  }

  /** Обновляет рекорд; возвращает true, если это новый рекорд. */
  submitScore(score) {
    if (score <= this.data.best) return false;
    this.store.update((d) => { d.best = score; });
    this.saveNow();
    return true;
  }

  ownSkin(id) {
    if (this.data.ownedSkins.includes(id)) return;
    this.store.update((d) => { d.ownedSkins.push(id); });
    this.saveNow();
  }

  setActiveSkin(id) {
    this.store.update((d) => { d.activeSkin = id; });
  }

  toggleSound() {
    this.store.update((d) => { d.soundOn = !d.soundOn; });
    return this.data.soundOn;
  }

  /** Ежедневный бонус: null, если сегодня уже забран, иначе { streak, amount }. */
  getDailyBonus() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.daily.lastClaim === today) return null;
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const streak = this.data.daily.lastClaim === yesterday ? this.data.daily.streak + 1 : 1;
    return { streak, amount: Math.min(streak, 7) * 25 };
  }

  claimDailyBonus(multiplier = 1) {
    const bonus = this.getDailyBonus();
    if (!bonus) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const gain = bonus.amount * multiplier;
    this.store.update((d) => {
      d.daily = { lastClaim: today, streak: bonus.streak };
      d.coins += gain;
    });
    this.saveNow();
    return gain;
  }
}

export const saves = new Saves();
