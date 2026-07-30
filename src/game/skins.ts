/**
 * Скины ящиков — то, на что тратятся бананы.
 *
 * Без стока валюта бессмысленна: счётчик, который только растёт, перестают
 * замечать через два забега. Скины выбраны сознательно как чисто
 * КОСМЕТИЧЕСКАЯ трата — покупка не должна давать преимущества, иначе игра
 * превращается в «накопи и выиграй», а рекорд перестаёт сравнивать умение.
 *
 * Технически скин — это не отдельный набор спрайтов, а тонировка. Ящик
 * отрисован деревянным со всей светотенью, а скин умножает его цвет:
 * текстура, блики и тени сохраняются, меняется только оттенок. Отдельные
 * спрайты на каждый скин раздули бы растровый кэш впятеро ради того же
 * результата.
 */

export interface Skin {
  id: string;
  /** Ключ названия в i18n. */
  key: string;
  price: number;
  /**
   * Цвет умножения поверх ящика; null — исходное дерево.
   * Умножение выбрано вместо замены: оно не может «выбелить» светотень.
   */
  tint: string | null;
  /** Сила тонировки. Выше 0.5 текстура досок перестаёт читаться. */
  strength: number;
}

export const SKINS: Skin[] = [
  { id: 'classic', key: 'skinClassic', price: 0, tint: null, strength: 0 },
  { id: 'bamboo', key: 'skinBamboo', price: 150, tint: '#c8d98a', strength: 0.42 },
  { id: 'mahogany', key: 'skinMahogany', price: 300, tint: '#c96a4a', strength: 0.45 },
  { id: 'frost', key: 'skinFrost', price: 500, tint: '#8fc4e8', strength: 0.44 },
  { id: 'charcoal', key: 'skinCharcoal', price: 750, tint: '#6b6f7a', strength: 0.5 },
  { id: 'gold', key: 'skinGold', price: 1200, tint: '#f0c04a', strength: 0.4 },
];

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? (SKINS[0] as Skin);
}
