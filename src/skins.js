/**
 * Скины блоков башни. Палитра: body — основной цвет, dark — низ/тень,
 * light — блик, accent — бананы на блоке.
 * adUnlock: скин выдаётся бесплатно за просмотр rewarded-рекламы.
 */
export const SKINS = [
  { id: 'classic', cost: 0, body: 0xffd93b, dark: 0xd4a017, light: 0xfff3a0, accent: 0xf5b700 },
  { id: 'golden', cost: 250, body: 0xffc400, dark: 0xa66a00, light: 0xffe680, accent: 0xff9d00 },
  { id: 'space', cost: 600, body: 0x7b5cff, dark: 0x43299e, light: 0xb7a6ff, accent: 0x3ee6c4 },
  { id: 'rainbow', cost: 0, adUnlock: true, body: 0xff6b9d, dark: 0xb03060, light: 0xffc2d9, accent: 0x59d9ff },
];

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}
