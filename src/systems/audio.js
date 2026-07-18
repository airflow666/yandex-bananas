/**
 * Звуки через WebAudio — генерируются на лету, без внешних файлов.
 * Это избавляет от лицензионных вопросов и держит сборку маленькой.
 */

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.suspendedByAd = false;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /** На время рекламы звук глушим полностью (требование площадки). */
  muteForAd() {
    this.suspendedByAd = true;
    this.ctx?.suspend();
  }

  unmuteAfterAd() {
    this.suspendedByAd = false;
    if (this.enabled) this.ctx?.resume();
  }

  _tone({ freq = 440, endFreq, time = 0.12, type = 'square', gain = 0.12, delay = 0 }) {
    if (!this.enabled || this.suspendedByAd) return;
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + time);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + time);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + time + 0.02);
  }

  click() { this._tone({ freq: 600, time: 0.05, type: 'sine', gain: 0.08 }); }
  drop() { this._tone({ freq: 300, endFreq: 120, time: 0.15, type: 'triangle' }); }
  land() { this._tone({ freq: 160, endFreq: 90, time: 0.1, type: 'square', gain: 0.1 }); }
  perfect() {
    this._tone({ freq: 660, time: 0.08, type: 'sine', gain: 0.1 });
    this._tone({ freq: 880, time: 0.1, type: 'sine', gain: 0.1, delay: 0.08 });
    this._tone({ freq: 1320, time: 0.14, type: 'sine', gain: 0.08, delay: 0.16 });
  }
  cut() { this._tone({ freq: 220, endFreq: 90, time: 0.2, type: 'sawtooth', gain: 0.06 }); }
  coin() { this._tone({ freq: 987, time: 0.06, type: 'sine', gain: 0.08 }); this._tone({ freq: 1318, time: 0.12, type: 'sine', gain: 0.08, delay: 0.06 }); }
  gameOver() {
    this._tone({ freq: 392, time: 0.18, type: 'triangle', gain: 0.1 });
    this._tone({ freq: 311, time: 0.18, type: 'triangle', gain: 0.1, delay: 0.18 });
    this._tone({ freq: 233, time: 0.35, type: 'triangle', gain: 0.1, delay: 0.36 });
  }
}

export const audio = new AudioSystem();
