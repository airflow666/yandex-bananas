/**
 * Игровой цикл с фиксированным шагом симуляции.
 *
 * Фиксированный шаг нужен из-за физики крена: пружина с затуханием при
 * переменном dt ведёт себя по-разному на 60 и 144 Гц, и «честность» посадки
 * блока начала бы зависеть от монитора. Отрисовка при этом идёт каждый кадр.
 *
 * Пауза здесь одна на всех и приходит из platform/lifecycle: реклама,
 * сворачивание вкладки, окно покупки. Пока стоим на паузе — время не
 * накапливается, поэтому возврат из рекламы не даёт скачка симуляции.
 */

const STEP_MS = 1000 / 120;
/** Больше этого за кадр не досчитываем — иначе после долгой паузы будет рывок. */
const MAX_FRAME_MS = 250;

export interface LoopHandlers {
  update(dtSec: number): void;
  render(alpha: number): void;
}

export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private paused = false;
  private running = false;

  constructor(private readonly h: LoopHandlers) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(value: boolean): void {
    if (this.paused === value) return;
    this.paused = value;
    // Сбрасываем точку отсчёта, чтобы простой не превратился в накопленное
    // время симуляции при возобновлении.
    this.last = performance.now();
    this.acc = 0;
  }

  isPaused(): boolean { return this.paused; }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const frame = Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;

    if (!this.paused) {
      this.acc += frame;
      while (this.acc >= STEP_MS) {
        this.h.update(STEP_MS / 1000);
        this.acc -= STEP_MS;
      }
    }
    this.h.render(this.acc / STEP_MS);
  };
}
