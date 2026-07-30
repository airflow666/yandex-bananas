/**
 * Адаптивная музыка: секвенсор с предпросмотром и слои по биомам.
 *
 * **Почему секвенсор, а не setInterval на каждую ноту.** Таймеры JS дрожат на
 * десятки миллисекунд, и ритм, выстроенный по ним, «плывёт» — особенно когда
 * основной поток занят отрисовкой. Поэтому таймер только ПЛАНИРУЕТ: раз в
 * 25 мс он заглядывает на 150 мс вперёд и расставляет ноты по часам
 * аудиоконтекста, которые идут в отдельном потоке и не дрожат вообще. Ритм
 * держится ровно даже при просадке кадров.
 *
 * **Адаптивность.** Никаких отдельных треков на биом: есть одна гармония и
 * пять слоёв, а биом задаёт «интенсивность» 0..1, которая открывает фильтр и
 * вводит слои. Подлесок — только шейкер и бас, к вершине добавляются пэд и
 * мелодия. Переход между биомами получается плавным сам собой, потому что
 * интенсивность интерполируется, а не переключается.
 *
 * Гармония — четыре аккорда в эолийском ладу и пентатоника для мелодии. В
 * пентатонике нет полутоновых столкновений, поэтому случайно выбранная нота
 * не может прозвучать фальшиво: генератору можно доверить импровизацию.
 */

import { engine } from './engine';

const BPM = 88;
/** Шестнадцатая — базовая единица сетки. */
const STEP_S = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const BARS = 4;
const TOTAL_STEPS = STEPS_PER_BAR * BARS;

/** Как далеко вперёд расставляем ноты и как часто заглядываем. */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;

/** Ля минор → фа мажор → до мажор → соль мажор. Корни в герцах. */
const ROOTS = [110.0, 87.31, 130.81, 98.0];
/** Трезвучия относительно корня, в полутонах. */
const TRIADS = [
  [0, 3, 7],
  [0, 4, 7],
  [0, 4, 7],
  [0, 4, 7],
];
/** Минорная пентатоника от ля. */
const PENTA = [0, 3, 5, 7, 10];

function hz(root: number, semis: number): number {
  return root * Math.pow(2, semis / 12);
}

export class Music {
  private timer: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private intensity = 0;
  private target = 0;

  /** Плавно подводит интенсивность к цели — биом не должен щёлкать. */
  setBiomeIntensity(v: number): void {
    this.target = Math.min(1, Math.max(0, v));
  }

  get running(): boolean { return this.timer !== null; }

  start(): void {
    const ctx = engine.context();
    if (!ctx || this.timer !== null) return;
    this.nextStepTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const ctx = engine.context();
    if (!ctx) return;

    // Контекст мог уснуть (вкладка в фоне) — время замерло, планировать
    // некуда, иначе после возврата вывалится пачка нот разом.
    if (ctx.state !== 'running') {
      this.nextStepTime = ctx.currentTime + 0.06;
      return;
    }

    this.intensity += (this.target - this.intensity) * 0.06;

    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += STEP_S;
      this.step = (this.step + 1) % TOTAL_STEPS;
    }
  }

  private playStep(step: number, time: number): void {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const beat = step % STEPS_PER_BAR;
    const root = ROOTS[bar] as number;
    const k = this.intensity;

    // --- бас: фундамент, звучит всегда, включая самый тёмный биом
    if (beat === 0 || beat === 10) {
      this.voice({
        freq: root, type: 'triangle', time,
        attack: 0.006, dur: beat === 0 ? 0.5 : 0.34,
        gain: 0.5, cutoff: 380 + k * 500,
      });
    }

    // --- перкуссия: шейкер по восьмым, бочка на сильных долях
    if (beat % 4 === 2) {
      this.perc(time, 0.055, 5200, 0.05 + k * 0.05);
    }
    if (beat === 0 || beat === 6) {
      this.voice({
        freq: 62, type: 'sine', time, attack: 0.002, dur: 0.16,
        gain: 0.55, cutoff: 200, slideTo: 40,
      });
    }

    // --- пэд: аккорд на такт, входит со средней интенсивности
    if (beat === 0 && k > 0.22) {
      const triad = TRIADS[bar] as number[];
      for (const semis of triad) {
        this.voice({
          freq: hz(root * 2, semis), type: 'sawtooth', time,
          attack: 0.35, dur: STEP_S * STEPS_PER_BAR * 0.95,
          gain: 0.1 * (k - 0.22), cutoff: 300 + k * 1400, reverb: 0.4,
        });
      }
    }

    // --- мелодия: только в светлых биомах, поверх всего
    if (k > 0.45 && MELODY[beat] === 1) {
      // Нота выводится из позиции детерминированно: рисунок повторяется от
      // такта к такту узнаваемо, но не буквально.
      const idx = (bar * 3 + beat) % PENTA.length;
      const octave = beat > 8 ? 2 : 1;
      this.voice({
        freq: hz(root * 4 * octave, PENTA[idx] as number),
        type: 'triangle', time, attack: 0.004, dur: 0.28,
        gain: 0.16 * (k - 0.45) * 2, cutoff: 4000, reverb: 0.45,
      });
    }
  }

  /** Одна нота музыкальной шины: осциллятор → фильтр → огибающая → шина. */
  private voice(o: {
    freq: number; type: OscillatorType; time: number;
    attack: number; dur: number; gain: number; cutoff: number;
    slideTo?: number; reverb?: number;
  }): void {
    const ctx = engine.context();
    const bus = engine.music();
    if (!ctx || !bus) return;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, o.time);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.gain), o.time + o.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, o.time + o.dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.cutoff;
    lp.Q.value = 0.7;

    env.connect(lp);
    lp.connect(bus);
    if (o.reverb) {
      const send = engine.sendToReverb(o.reverb);
      if (send) lp.connect(send);
    }

    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, o.time);
    if (o.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), o.time + o.dur);
    }
    osc.connect(env);
    osc.start(o.time);
    osc.stop(o.time + o.dur + 0.05);
  }

  /** Шейкер: короткий всплеск высокочастотного шума. */
  private perc(time: number, dur: number, freq: number, gain: number): void {
    const ctx = engine.context();
    const bus = engine.music();
    if (!ctx || !bus) return;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.value = gain;

    src.connect(hp);
    hp.connect(g);
    g.connect(bus);
    src.start(time);
  }
}

/** Ритмический рисунок мелодии по шестнадцатым внутри такта. */
const MELODY = [
  1, 0, 0, 1, 0, 0, 1, 0,
  0, 1, 0, 0, 1, 0, 0, 0,
];

export const music = new Music();
