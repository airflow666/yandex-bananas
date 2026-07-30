/**
 * Реестр спрайтов. Один вызов registerAll() на старте — и дальше рендер
 * обращается к графике только по строковым ключам, не зная про SVG вообще.
 */

import { registerSprite, preloadSprites } from '../svgRaster';
import { bananaSprite, bindingSprite, BANANA_KEYS, BINDING_KEY, type Ripeness } from './banana';
import { crateEndSprite, crateMidSprite, CRATE_KEYS } from './crate';
import { monkeySprite, MONKEY_KEYS, type Pose } from './monkey';
import {
  trunkSprite, TRUNK_KEY, palmFrondSprite, monsteraSprite, bromeliadSprite,
  flowerSprite, vineLeafSprite, canopyBlobSprite, FLORA_KEYS,
} from './flora';

export { BANANA_KEYS, BINDING_KEY, CRATE_KEYS, MONKEY_KEYS, TRUNK_KEY, FLORA_KEYS };
export type { Ripeness, Pose };

let registered = false;

export function registerAll(): void {
  if (registered) return;
  registered = true;

  for (const r of ['fresh', 'ripe', 'golden'] as const) {
    registerSprite(BANANA_KEYS[r], bananaSprite(r));
  }
  registerSprite(BINDING_KEY, bindingSprite());

  registerSprite(CRATE_KEYS.midPlain, crateMidSprite('plain'));
  registerSprite(CRATE_KEYS.midPerfect, crateMidSprite('perfect'));
  registerSprite(CRATE_KEYS.endPlain, crateEndSprite('plain'));
  registerSprite(CRATE_KEYS.endPerfect, crateEndSprite('perfect'));

  for (const p of ['hang', 'climb', 'cheer', 'scared'] as const) {
    registerSprite(MONKEY_KEYS[p], monkeySprite(p));
  }

  registerSprite(TRUNK_KEY, trunkSprite());
  registerSprite(FLORA_KEYS.palm, palmFrondSprite());
  registerSprite(FLORA_KEYS.monstera, monsteraSprite());
  registerSprite(FLORA_KEYS.bromeliad, bromeliadSprite());
  registerSprite(FLORA_KEYS.flower, flowerSprite());
  registerSprite(FLORA_KEYS.vineLeaf, vineLeafSprite());
  registerSprite(FLORA_KEYS.canopy, canopyBlobSprite());
}

/** Зарегистрировать и растеризовать всё под текущий масштаб экрана. */
export async function initSprites(pixelScale: number): Promise<void> {
  registerAll();
  await preloadSprites(pixelScale);
}
