/**
 * Примитивы синтеза: тон с огибающей и шумовой всплеск.
 *
 * Всё в игре собрано из этих двух кирпичей. Осциллятор даёт высоту и тембр,
 * шум — удар и материал (дерево, шелест), фильтр решает, чем именно звучит
 * шум. Никаких сэмплов.
 *
 * Огибающая везде ADSR на linearRamp/exponentialRamp. Экспонента для спада
 * важнее, чем кажется: линейный спад слышен как «выключили», а не как
 * «затихло», потому что громкость воспринимается логарифмически.
 * exponentialRamp не умеет идти в ноль, поэтому целимся в 0.0001.
 */

import { engine } from './engine';

/** Ниже этого значения экспоненциальная рампа считается нулём. */
const EPS = 0.0001;

export interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  /** Куда съехать по частоте к концу — для «вжух» и падающих тонов. */
  slideTo?: number;
  attack?: number;
  decay?: number;
  /** Полная длительность звучания. */
  dur?: number;
  gain?: number;
  /** Расстройка второго голоса в центах; 0 — второго голоса нет. */
  detune?: number;
  /** Доля сигнала, уходящая в реверб. */
  reverb?: number;
  /** Задержка старта относительно «сейчас». */
  delay?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
}

export function tone(o: ToneOptions): void {
  const ctx = engine.context();
  const out = engine.sfx();
  if (!ctx || !out) return;

  const {
    freq, type = 'sine', slideTo, attack = 0.005, decay = 0.12,
    dur = 0.25, gain = 0.3, detune = 0, reverb = 0, delay = 0, filter,
  } = o;

  const t0 = ctx.currentTime + delay;
  const env = ctx.createGain();
  env.gain.setValueAtTime(EPS, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(EPS, gain), t0 + attack);
  env.gain.exponentialRampToValueAtTime(EPS, t0 + Math.max(attack + decay, dur));

  let node: AudioNode = env;
  if (filter) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.setValueAtTime(filter.freq, t0);
    if (filter.sweepTo !== undefined) {
      biquad.frequency.exponentialRampToValueAtTime(
        Math.max(20, filter.sweepTo), t0 + dur,
      );
    }
    if (filter.q !== undefined) biquad.Q.value = filter.q;
    env.connect(biquad);
    node = biquad;
  }

  node.connect(out);
  if (reverb > 0) {
    const send = engine.sendToReverb(reverb);
    if (send) node.connect(send);
  }

  const voices = detune ? [-detune, detune] : [0];
  for (const cents of voices) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    // Делим громкость между голосами, иначе расстройка удваивает уровень.
    if (voices.length > 1) {
      const v = ctx.createGain();
      v.gain.value = 1 / voices.length;
      osc.connect(v);
      v.connect(env);
    } else {
      osc.connect(env);
    }
    osc.start(t0);
    osc.stop(t0 + Math.max(attack + decay, dur) + 0.05);
  }
}

export interface NoiseOptions {
  dur?: number;
  gain?: number;
  attack?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };
  reverb?: number;
  delay?: number;
}

/**
 * Шумовой всплеск. Буфер генерируется один раз и переиспользуется: создавать
 * секунду случайных чисел на каждый удар — заметная работа на слабом
 * телефоне, а на слух разницы нет.
 */
let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 1.2);
  const buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

export function noise(o: NoiseOptions = {}): void {
  const ctx = engine.context();
  const out = engine.sfx();
  if (!ctx || !out) return;

  const { dur = 0.2, gain = 0.3, attack = 0.002, filter, reverb = 0, delay = 0 } = o;
  const t0 = ctx.currentTime + delay;

  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  // Случайная точка старта: одинаковый кусок шума на каждом ударе слышен
  // как повтор, особенно на длинных звуках вроде обрушения.
  src.loop = true;
  const bufDur = src.buffer.duration;

  const env = ctx.createGain();
  env.gain.setValueAtTime(EPS, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(EPS, gain), t0 + attack);
  env.gain.exponentialRampToValueAtTime(EPS, t0 + dur);

  let node: AudioNode = env;
  if (filter) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter.type;
    biquad.frequency.setValueAtTime(filter.freq, t0);
    if (filter.sweepTo !== undefined) {
      biquad.frequency.exponentialRampToValueAtTime(
        Math.max(20, filter.sweepTo), t0 + dur,
      );
    }
    if (filter.q !== undefined) biquad.Q.value = filter.q;
    env.connect(biquad);
    node = biquad;
  }

  node.connect(out);
  if (reverb > 0) {
    const send = engine.sendToReverb(reverb);
    if (send) node.connect(send);
  }

  src.connect(env);
  src.start(t0, Math.random() * Math.max(0.001, bufDur - dur - 0.05));
  src.stop(t0 + dur + 0.05);
}
