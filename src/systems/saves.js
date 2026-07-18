/**
 * Прогресс игрока: монеты, рекорд, скины, звук, ежедневный бонус.
 * Хранится в облаке Яндекса (player.setData) с fallback на localStorage внутри SDK-обёртки.
 * Запись — с дебаунсом, чтобы не спамить API при каждой монете.
 */

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
    this.sdk = null;
    this.data = { ...DEFAULTS };
    this._saveTimer = null;
  }

  async load(sdk) {
    this.sdk = sdk;
    const stored = await sdk.getData();
    this.data = {
      ...DEFAULTS,
      ...stored,
      daily: { ...DEFAULTS.daily, ...(stored.daily || {}) },
    };
    if (!this.data.ownedSkins.includes('classic')) this.data.ownedSkins.push('classic');
  }

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.sdk?.setData(this.data);
    }, 500);
  }

  /** Немедленная запись с flush — для критичных моментов (game over, покупка). */
  saveNow() {
    clearTimeout(this._saveTimer);
    this.sdk?.setData(this.data, true);
  }

  addCoins(n) {
    this.data.coins += n;
    this.save();
  }

  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.saveNow();
    return true;
  }

  /** Обновляет рекорд; возвращает true, если это новый рекорд. */
  submitScore(score) {
    if (score > this.data.best) {
      this.data.best = score;
      this.saveNow();
      return true;
    }
    return false;
  }

  ownSkin(id) {
    if (!this.data.ownedSkins.includes(id)) {
      this.data.ownedSkins.push(id);
      this.saveNow();
    }
  }

  setActiveSkin(id) {
    this.data.activeSkin = id;
    this.saveNow();
  }

  toggleSound() {
    this.data.soundOn = !this.data.soundOn;
    this.save();
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
    this.data.daily = { lastClaim: today, streak: bonus.streak };
    this.data.coins += bonus.amount * multiplier;
    this.saveNow();
    return bonus.amount * multiplier;
  }
}

export const saves = new Saves();
