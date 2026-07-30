/**
 * Звуковые эффекты игры.
 *
 * Правило подбора: каждый звук отвечает на вопрос «что сейчас произошло» за
 * первые 30 мс. Поэтому у всех ударных звуков атака мгновенная, а различаются
 * они материалом (полосой фильтра), а не длиной.
 *
 * Питч серии — главный приём. Идеальные попадания подряд поднимают ноту по
 * пентатонике, и игрок СЛЫШИТ длину серии, не глядя на счётчик. Пентатоника
 * выбрана потому, что в ней нет полутоновых столкновений: любая
 * последовательность ступеней звучит согласно, а значит серия из 20 попаданий
 * не превратится в какофонию. Выше восьмой ступени нота уходит в следующую
 * октаву, но громкость слегка падает — иначе на длинной серии звук становится
 * невыносимо резким.
 */

import { noise, tone } from './synth';

/** Мажорная пентатоника от C: ступени в полутонах. */
const PENTATONIC = [0, 2, 4, 7, 9];
/** Базовая нота серии — C5. */
const BASE_HZ = 523.25;

function semitone(n: number): number {
  return BASE_HZ * Math.pow(2, n / 12);
}

/** Нота для попадания номер `streak` в серии. */
function streakNote(streak: number): number {
  const i = Math.max(0, streak - 1);
  const octave = Math.floor(i / PENTATONIC.length);
  const step = PENTATONIC[i % PENTATONIC.length] as number;
  return semitone(step + octave * 12);
}

/** Ящик отцепился от лианы: короткий воздушный «вжух» вниз. */
export function sfxDrop(): void {
  noise({
    dur: 0.26,
    gain: 0.1,
    attack: 0.02,
    filter: { type: 'bandpass', freq: 1300, q: 0.9, sweepTo: 420 },
  });
}

/**
 * Обычная посадка: деревянный удар. Низкий тон даёт вес, шумовой щелчок —
 * материал. Без щелчка удар звучит резиновым.
 */
export function sfxLand(): void {
  tone({
    freq: 190, slideTo: 92, type: 'triangle',
    attack: 0.002, decay: 0.14, dur: 0.16, gain: 0.5, reverb: 0.1,
  });
  noise({
    dur: 0.075, gain: 0.34, attack: 0.001,
    filter: { type: 'bandpass', freq: 1900, q: 1.1, sweepTo: 900 },
  });
}

/**
 * Идеальная посадка. Тот же деревянный удар плюс колокольчик на ступени
 * серии — награда слышна отдельно от факта посадки.
 */
export function sfxPerfect(streak: number): void {
  sfxLand();
  const f = streakNote(streak);
  // Затухание на длинной серии: к двадцатому попаданию нота уже высокая,
  // и на прежней громкости она резала бы слух.
  const fade = Math.max(0.45, 1 - streak * 0.02);

  tone({
    freq: f, type: 'triangle',
    attack: 0.004, decay: 0.34, dur: 0.38,
    gain: 0.3 * fade, reverb: 0.36, detune: 6,
  });
  // Квинта сверху с задержкой — «блеск», из-за которого попадание звучит
  // как событие, а не как нота.
  tone({
    freq: f * 1.5, type: 'sine',
    attack: 0.003, decay: 0.26, dur: 0.3,
    gain: 0.15 * fade, reverb: 0.42, delay: 0.035,
  });
}

/** Ящик обрезало: сухой треск дерева плюс глухой удар. */
export function sfxTrim(severity: number): void {
  const s = Math.min(1, Math.max(0.2, severity));
  noise({
    dur: 0.13 + s * 0.1, gain: 0.3 + s * 0.2, attack: 0.001,
    filter: { type: 'highpass', freq: 900 + s * 700, q: 0.7 },
  });
  tone({
    freq: 150, slideTo: 70, type: 'square',
    attack: 0.002, decay: 0.1, dur: 0.13, gain: 0.16 * s, reverb: 0.12,
    filter: { type: 'lowpass', freq: 900 },
  });
}

/** Промах и обрушение: длинный обвал с уходящим вниз фильтром. */
export function sfxCollapse(): void {
  noise({
    dur: 1.1, gain: 0.42, attack: 0.004,
    filter: { type: 'lowpass', freq: 2600, q: 0.6, sweepTo: 180 },
    reverb: 0.5,
  });
  tone({
    freq: 130, slideTo: 38, type: 'sawtooth',
    attack: 0.006, decay: 0.8, dur: 0.9, gain: 0.34, reverb: 0.4,
    filter: { type: 'lowpass', freq: 620 },
  });
  // Догоняющие обломки: три удара со сдвигом — обвал, а не один «бум».
  for (let i = 0; i < 3; i++) {
    noise({
      dur: 0.14, gain: 0.2 - i * 0.04, attack: 0.001,
      delay: 0.09 + i * 0.13,
      filter: { type: 'bandpass', freq: 700 - i * 140, q: 1.4 },
    });
  }
}

/** Нажатие кнопки интерфейса. */
export function sfxClick(): void {
  tone({
    freq: 620, slideTo: 880, type: 'triangle',
    attack: 0.002, decay: 0.05, dur: 0.06, gain: 0.16,
  });
}

/** Новый рекорд — маленькая восходящая фанфара. */
export function sfxRecord(): void {
  [0, 4, 7, 12].forEach((step, i) => {
    tone({
      freq: semitone(step), type: 'triangle',
      attack: 0.004, decay: 0.3, dur: 0.34,
      gain: 0.24, reverb: 0.4, detune: 5, delay: i * 0.09,
    });
  });
}
