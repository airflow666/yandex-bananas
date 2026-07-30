/**
 * Единый фасад звука. Остальная игра знает только его.
 *
 * Симуляция намеренно НЕ вызывает звук напрямую: она складывает события в
 * очередь, а разбирает её main. Иначе `Session.update()` перестал бы быть
 * чистой функцией времени, и прогнать забег в тесте (что мы и делаем при
 * проверке) стало бы невозможно без звуковой карты.
 */

import { engine } from './engine';
import { music } from './music';
import {
  sfxClick, sfxCollapse, sfxDrop, sfxLand, sfxPerfect, sfxRecord, sfxTrim,
} from './sfx';
import type { GameEvent } from '../game/events';

class Audio {
  private started = false;

  get muted(): boolean { return engine.isMuted; }

  /**
   * Первый жест игрока. Только отсюда можно создать AudioContext — до жеста
   * браузер его глушит. Вызывать можно сколько угодно раз.
   */
  unlock(): void {
    engine.unlock();
    if (!engine.ready || this.started) return;
    this.started = true;
    if (!engine.isMuted) music.start();
  }

  setMuted(value: boolean): void {
    engine.setMuted(value);
    if (value) music.stop();
    else if (this.started) music.start();
  }

  /** Пауза площадки: реклама, сворачивание вкладки, окно покупки. */
  setSuspended(value: boolean): void {
    engine.setSuspended(value);
    // Секвенсор останавливаем тоже: планировать ноты в спящий контекст
    // бессмысленно, а после возврата они вывалились бы пачкой.
    if (value) music.stop();
    else if (this.started && !engine.isMuted) music.start();
  }

  /** Интенсивность музыки по высоте: чем выше биом, тем больше слоёв. */
  setBiomeIntensity(v: number): void {
    music.setBiomeIntensity(v);
  }

  /**
   * Состояние звука для отладки и автотестов. Проверить «играет ли музыка»
   * снаружи иначе нельзя: AudioContext не отражается в DOM.
   */
  diagnostics(): Record<string, unknown> {
    return {
      ready: engine.ready,
      muted: engine.isMuted,
      contextState: engine.context()?.state ?? 'none',
      sampleRate: engine.context()?.sampleRate ?? 0,
      musicRunning: music.running,
      masterGain: Number(engine.masterGain().toFixed(3)),
      started: this.started,
    };
  }

  /** Звук нажатия кнопки — отдельно от игровых событий. */
  click(): void {
    if (!engine.ready || engine.isMuted) return;
    sfxClick();
  }

  /** Разобрать очередь событий забега. */
  play(events: readonly GameEvent[]): void {
    if (!engine.ready || engine.isMuted) return;
    for (const e of events) {
      switch (e.kind) {
        case 'drop': sfxDrop(); break;
        case 'land': sfxLand(); break;
        case 'perfect': sfxPerfect(e.streak); break;
        case 'trim': sfxTrim(e.severity); break;
        case 'collapse': sfxCollapse(); break;
        case 'record': sfxRecord(); break;
      }
    }
  }
}

export const audio = new Audio();
