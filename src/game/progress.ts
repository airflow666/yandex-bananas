/**
 * Мета-прогресс: достижения, задания, экономика, разблокировки.
 *
 * Зачем это вообще есть. Один бесконечный забег — это меньше десяти минут
 * содержания, чего требует модерация, и, что важнее, у игрока нет ни одной
 * причины начать второй забег после того, как рекорд перестал расти. Мета
 * даёт три разных горизонта цели:
 *
 *  - **задание** — на один-два забега («собери 60 бананов»), закрывается сегодня;
 *  - **достижение** — на десятки забегов («500 этажей суммарно»), закрывается за неделю;
 *  - **покупка** — тратит накопленное, поэтому бананы перестают быть просто счётчиком.
 *
 * Всё считается ЛОКАЛЬНО и детерминированно. Никакого сервера: задания
 * выводятся из номера дня, поэтому набор одинаков в течение суток и меняется
 * сам, без запросов и без хранения списка.
 *
 * Модуль намеренно не знает ни про рендер, ни про платформу — только данные
 * и правила. Его можно прогнать в тесте целиком.
 */

/** Порядковый номер суток по UTC. База ротации заданий и ежедневного бонуса. */
export function dayIndex(now: number = Date.now()): number {
  return Math.floor(now / 86_400_000);
}

// --------------------------------------------------------------- статистика

/** Итог одного забега — всё, из чего считается прогресс. */
export interface RunStats {
  mode: GameMode;
  floors: number;
  coins: number;
  bestStreak: number;
  perfects: number;
}

export type GameMode = 'classic' | 'storm';

// ------------------------------------------------------------------ хранимое

export interface ProgressData extends Record<string, unknown> {
  best: number;
  bestStorm: number;
  coins: number;
  totalFloors: number;
  totalRuns: number;
  totalPerfects: number;
  bestStreak: number;
  /** Идентификаторы полученных достижений. */
  achievements: string[];
  /** Прогресс активных заданий по слотам, сбрасывается сменой суток. */
  missionProgress: number[];
  /** Какие слоты уже оплачены — награда выдаётся один раз. */
  missionClaimed: number[];
  /** Сутки, для которых выданы текущие задания. */
  missionDay: number;
  /** Сутки последнего полученного ежедневного бонуса. */
  bonusDay: number;
  skin: string;
  ownedSkins: string[];
  muted: boolean;
}

export const DEFAULT_PROGRESS: ProgressData = {
  best: 0,
  bestStorm: 0,
  coins: 0,
  totalFloors: 0,
  totalRuns: 0,
  totalPerfects: 0,
  bestStreak: 0,
  achievements: [],
  missionProgress: [0, 0, 0],
  missionClaimed: [],
  missionDay: -1,
  bonusDay: -1,
  skin: 'classic',
  ownedSkins: ['classic'],
  muted: false,
};

// ---------------------------------------------------------------- достижения

export interface Achievement {
  id: string;
  /** Ключ строки в i18n. */
  key: string;
  /** Порог и способ его извлечь из накопленной статистики. */
  goal: number;
  measure: (p: ProgressData) => number;
  reward: number;
}

/**
 * Пороги подобраны так, чтобы первые два-три достижения закрывались в первые
 * же забеги: пустой список наград — худшее, что можно показать новому игроку.
 * Дальше шаг растёт, и последние остаются целью надолго.
 */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'floors10', key: 'achFloors10', goal: 10, measure: (p) => p.best, reward: 20 },
  { id: 'floors25', key: 'achFloors25', goal: 25, measure: (p) => p.best, reward: 50 },
  { id: 'floors50', key: 'achFloors50', goal: 50, measure: (p) => p.best, reward: 120 },
  { id: 'floors100', key: 'achFloors100', goal: 100, measure: (p) => p.best, reward: 300 },
  { id: 'streak5', key: 'achStreak5', goal: 5, measure: (p) => p.bestStreak, reward: 30 },
  { id: 'streak15', key: 'achStreak15', goal: 15, measure: (p) => p.bestStreak, reward: 100 },
  { id: 'total500', key: 'achTotal500', goal: 500, measure: (p) => p.totalFloors, reward: 80 },
  { id: 'total2000', key: 'achTotal2000', goal: 2000, measure: (p) => p.totalFloors, reward: 250 },
  { id: 'perfect100', key: 'achPerfect100', goal: 100, measure: (p) => p.totalPerfects, reward: 150 },
  { id: 'storm25', key: 'achStorm25', goal: 25, measure: (p) => p.bestStorm, reward: 200 },
];

/** Достижения, выполненные, но ещё не отмеченные в сохранении. */
export function newlyEarned(p: ProgressData): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => !p.achievements.includes(a.id) && a.measure(p) >= a.goal,
  );
}

// -------------------------------------------------------------------- задания

export type MissionKind = 'floors' | 'coins' | 'streak' | 'perfects' | 'runs';

export interface Mission {
  kind: MissionKind;
  goal: number;
  reward: number;
}

/** Три слота заданий; в каждом свой тип, чтобы день не состоял из трёх похожих. */
const MISSION_TABLE: { kind: MissionKind; goals: number[]; rate: number }[] = [
  { kind: 'floors', goals: [15, 20, 25, 30], rate: 2 },
  { kind: 'coins', goals: [60, 90, 120, 150], rate: 0.5 },
  { kind: 'streak', goals: [4, 5, 6, 8], rate: 12 },
  { kind: 'perfects', goals: [10, 15, 20, 25], rate: 3 },
  { kind: 'runs', goals: [3, 5, 7], rate: 10 },
];

/** Дешёвый детерминированный хэш — тот же приём, что в отрисовке декора. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43_758.545;
  return x - Math.floor(x);
}

/**
 * Задания дня. Выводятся из номера суток, поэтому одинаковы у игрока весь
 * день, меняются сами в полночь UTC и не требуют ни сервера, ни хранения
 * самого списка — в сохранении лежит только прогресс по слотам.
 */
export function missionsForDay(day: number): Mission[] {
  const out: Mission[] = [];
  const used = new Set<number>();
  for (let slot = 0; slot < 3; slot++) {
    // Разные типы в слотах: иначе день из трёх «собери бананы» выглядит
    // как ошибка генератора, даже если пороги разные.
    let t = Math.floor(hash(day * 7 + slot * 31) * MISSION_TABLE.length);
    let guard = 0;
    while (used.has(t) && guard++ < MISSION_TABLE.length) {
      t = (t + 1) % MISSION_TABLE.length;
    }
    used.add(t);
    const row = MISSION_TABLE[t] as typeof MISSION_TABLE[number];
    const goal = row.goals[Math.floor(hash(day * 13 + slot * 5) * row.goals.length)] as number;
    out.push({ kind: row.kind, goal, reward: Math.round(goal * row.rate) });
  }
  return out;
}

/** Сброс прогресса заданий при смене суток. Возвращает true, если сбросил. */
export function rotateMissions(p: ProgressData, day: number): boolean {
  if (p.missionDay === day) return false;
  p.missionDay = day;
  p.missionProgress = [0, 0, 0];
  p.missionClaimed = [];
  return true;
}

/** Вклад забега в прогресс заданий дня. */
export function applyRunToMissions(p: ProgressData, run: RunStats): void {
  const missions = missionsForDay(p.missionDay);
  missions.forEach((m, i) => {
    const prev = p.missionProgress[i] ?? 0;
    let value = prev;
    switch (m.kind) {
      // «Этажей за забег» и «серия» — это РЕКОРД за день, а не сумма:
      // складывать их бессмысленно, задание «построй 30 этажей» должно
      // проверять один забег, иначе оно выполняется само собой.
      case 'floors': value = Math.max(prev, run.floors); break;
      case 'streak': value = Math.max(prev, run.bestStreak); break;
      // Остальные накапливаются за день.
      case 'coins': value = prev + run.coins; break;
      case 'perfects': value = prev + run.perfects; break;
      case 'runs': value = prev + 1; break;
    }
    p.missionProgress[i] = value;
  });
}

export function isMissionDone(p: ProgressData, index: number): boolean {
  const m = missionsForDay(p.missionDay)[index];
  if (!m) return false;
  return (p.missionProgress[index] ?? 0) >= m.goal;
}

export function isMissionClaimed(p: ProgressData, index: number): boolean {
  return p.missionClaimed.includes(index);
}

/** Забрать награду за задание. Возвращает сумму или 0, если брать нечего. */
export function claimMission(p: ProgressData, index: number): number {
  if (!isMissionDone(p, index) || isMissionClaimed(p, index)) return 0;
  const m = missionsForDay(p.missionDay)[index];
  if (!m) return 0;
  p.missionClaimed.push(index);
  p.coins += m.reward;
  return m.reward;
}

// ------------------------------------------------------------ ежедневный бонус

/** Бонус растёт с числом забегов, но упирается в потолок — не фарм. */
export function dailyBonusAmount(p: ProgressData): number {
  return Math.min(120, 40 + Math.floor(p.totalRuns / 10) * 10);
}

export function canClaimDailyBonus(p: ProgressData, day: number): boolean {
  return p.bonusDay !== day;
}

export function claimDailyBonus(p: ProgressData, day: number): number {
  if (!canClaimDailyBonus(p, day)) return 0;
  p.bonusDay = day;
  const amount = dailyBonusAmount(p);
  p.coins += amount;
  return amount;
}

// -------------------------------------------------------------- разблокировки

/** Шторм открывается результатом в классике — режим не должен быть первым. */
export const STORM_UNLOCK_FLOORS = 20;

export function isStormUnlocked(p: ProgressData): boolean {
  return p.best >= STORM_UNLOCK_FLOORS;
}

// -------------------------------------------------------------------- итог

/**
 * Записать забег в прогресс. Единственная точка, где меняется статистика, —
 * иначе счётчики разъезжаются между режимами и экранами.
 */
export function applyRun(p: ProgressData, run: RunStats): void {
  p.totalRuns += 1;
  p.totalFloors += run.floors;
  p.totalPerfects += run.perfects;
  p.coins += run.coins;
  if (run.bestStreak > p.bestStreak) p.bestStreak = run.bestStreak;
  if (run.mode === 'storm') {
    if (run.floors > p.bestStorm) p.bestStorm = run.floors;
  } else if (run.floors > p.best) {
    p.best = run.floors;
  }
  applyRunToMissions(p, run);
}
