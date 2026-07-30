/**
 * Звуковая шина: контекст, мастер-цепочка, процедурный реверб.
 *
 * Ни одного стороннего сэмпла — всё синтезируется (п. 4 CLAUDE.md). Реверб
 * тоже: импульсная характеристика собирается из шума с экспоненциальным
 * затуханием прямо на старте, поэтому в архиве нет ни одного аудиофайла.
 *
 * Три вещи, которые в вебе ломают звук чаще всего, и как они закрыты здесь:
 *
 * 1. **Автоплей.** Браузер не даёт создать звук до жеста пользователя.
 *    Поэтому AudioContext создаётся ЛЕНИВО, при первом касании, а не на
 *    загрузке. До этого момента все вызовы — тихий no-op, а не исключение.
 * 2. **Звук в фоне.** Требование площадки — звук обязан замолкать при
 *    сворачивании вкладки. Контекст суспендится по единому событию паузы
 *    (platform/lifecycle), а не по таймеру.
 * 3. **Щелчки на огибающих.** Резкий старт и стоп громкости дают щелчок.
 *    Все включения и выключения идут через рампу, даже мьют.
 *
 * Маршрутизация:
 *   источник → [сухой] ──────────────┐
 *           └→ [посыл] → конволвер → ├→ шина (музыка|эффекты) → мастер
 *                                     компрессор → выход
 */

/** Длительность рампы мьюта. Короче — щёлкает, длиннее — заметна задержка. */
const MUTE_RAMP_S = 0.08;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;

  private muted = false;
  /** Пауза от площадки/вкладки — независима от мьюта игрока. */
  private suspended = false;

  /** true, когда контекст создан и готов принимать звуки. */
  get ready(): boolean { return this.ctx !== null && this.ctx.state !== 'closed'; }

  get isMuted(): boolean { return this.muted; }

  /**
   * Создать контекст. Вызывается ТОЛЬКО из обработчика жеста пользователя —
   * иначе браузер создаст его в состоянии suspended и первые звуки пропадут.
   * Идемпотентна и никогда не бросает: игра без звука обязана работать.
   */
  unlock(): void {
    if (this.ctx) {
      // Контекст мог уйти в suspended сам (политика автоплея, возврат из фона).
      if (this.ctx.state === 'suspended' && !this.suspended) void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();

      const comp = ctx.createDynamicsCompressor();
      // Мягкая склейка: не «качает», но держит пики от наложения эффектов.
      comp.threshold.value = -18;
      comp.knee.value = 26;
      comp.ratio.value = 3.2;
      comp.attack.value = 0.006;
      comp.release.value = 0.22;
      comp.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 1;
      master.connect(comp);

      const music = ctx.createGain();
      music.gain.value = 0.34;
      music.connect(master);

      const sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);

      const reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(ctx, 1.9, 2.6);
      reverb.connect(master);

      this.ctx = ctx;
      this.master = master;
      this.musicBus = music;
      this.sfxBus = sfx;
      this.reverb = reverb;
    } catch (e) {
      console.warn('[audio] context unavailable, running silent', e);
      this.ctx = null;
    }
  }

  /** Текущее время контекста; 0, если звука ещё нет. */
  now(): number { return this.ctx?.currentTime ?? 0; }

  /** Фактическая громкость мастера — для диагностики мьюта и паузы. */
  masterGain(): number { return this.master?.gain.value ?? 0; }

  context(): AudioContext | null { return this.ctx; }
  music(): GainNode | null { return this.musicBus; }
  sfx(): GainNode | null { return this.sfxBus; }

  /**
   * Посыл на реверб для источника. Возвращает узел, в который надо подать
   * сигнал; сухая часть подключается вызывающим отдельно.
   */
  sendToReverb(amount: number): GainNode | null {
    if (!this.ctx || !this.reverb) return null;
    const send = this.ctx.createGain();
    send.gain.value = amount;
    send.connect(this.reverb);
    return send;
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.rampMaster();
  }

  /** Пауза площадки: реклама, сворачивание вкладки, окно покупки. */
  setSuspended(value: boolean): void {
    if (this.suspended === value) return;
    this.suspended = value;
    this.rampMaster();
    const ctx = this.ctx;
    if (!ctx) return;
    // Рампа успевает отработать до фактического suspend — иначе щелчок.
    if (value) {
      setTimeout(() => {
        if (this.suspended && ctx.state === 'running') void ctx.suspend();
      }, MUTE_RAMP_S * 1000 + 20);
    } else if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  private rampMaster(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const target = this.muted || this.suspended ? 0 : 1;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(target, t + MUTE_RAMP_S);
  }
}

/**
 * Импульсная характеристика зала из шума с экспоненциальным затуханием.
 *
 * Каналы заполняются НЕЗАВИСИМО: одинаковый шум слева и справа дал бы
 * моно-хвост, схлопнутый в центр. Разный — даёт ширину, ради которой реверб
 * и нужен. Первые миллисекунды приглушены, чтобы хвост не забивал атаку.
 */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Нарастание первых 8 мс: без него слышен «взрыв» в начале хвоста.
      const attack = Math.min(1, i / (rate * 0.008));
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * attack;
    }
  }
  return buffer;
}

export const engine = new AudioEngine();
