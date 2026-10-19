// Scoring rules for Wellness League. Pure functions only, so the same code can
// score entries in the browser now and on the server later.
// Every rule below comes from the plan's scoring table. Change numbers here,
// and the whole app follows.

export type Pillar = "physical" | "mental" | "spiritual";

/** One day of entries, in natural units. */
export interface DayEntry {
  exerciseMin: number;
  steps: number;
  /** Three meals, each graded 0 (skipped or junk), 1 (mixed), 2 (healthy). */
  meals: [number, number, number];
  sleepHours: number;
  water: boolean;
  meditationMin: number;
  workHours: number;
  socialHours: number;
  readingMin: number;
  journalEntries: number;
  worshipMin: number;
  serviceHours: number;
  screenHours: number; // non-work only
  drinks: number;
  weed: number;
  cigarettes: number;
}

export const EMPTY_DAY: DayEntry = {
  exerciseMin: 0,
  steps: 0,
  meals: [0, 0, 0],
  sleepHours: 0,
  water: false,
  meditationMin: 0,
  workHours: 0,
  socialHours: 0,
  readingMin: 0,
  journalEntries: 0,
  worshipMin: 0,
  serviceHours: 0,
  screenHours: 0,
  drinks: 0,
  weed: 0,
  cigarettes: 0,
};

const capped = (value: number, perUnit: number, pointsPerUnit: number, maxPoints: number) =>
  Math.min(maxPoints, Math.floor(Math.max(0, value) / perUnit) * pointsPerUnit);

export function sleepPoints(hours: number): number {
  if (hours >= 8) return 3;
  if (hours >= 7) return 2;
  if (hours >= 6) return 1;
  return 0;
}

export interface DayScore {
  physical: number;
  mental: number;
  spiritual: number;
  penalties: number;
  balanceBonus: number;
  streakBonus: number;
  total: number;
}

/**
 * @param streakDays Consecutive days logged, counting today. The streak bonus
 *   (+2) lands on every 7th consecutive day.
 */
export function scoreDay(e: DayEntry, streakDays: number): DayScore {
  const physical =
    capped(e.exerciseMin, 30, 3, 12) + // +3 per 30 min, max 2 hours
    capped(e.steps, 1000, 1, 20) + // +1 per 1,000 steps
    e.meals.reduce((sum, grade) => sum + Math.min(2, Math.max(0, grade)), 0) +
    sleepPoints(e.sleepHours) +
    (e.water ? 1 : 0);

  const mental =
    capped(e.meditationMin, 15, 1, 8) +
    capped(e.workHours, 1, 1, 14) +
    capped(e.socialHours, 1, 1, 6) +
    capped(e.readingMin, 30, 1, 4) +
    Math.min(3, Math.max(0, e.journalEntries));

  const spiritual = capped(e.worshipMin, 15, 1, 8) + capped(e.serviceHours, 1, 1, 4);

  const penalties =
    -Math.floor(Math.max(0, e.screenHours)) -
    0.5 * Math.max(0, e.drinks) -
    5 * Math.max(0, e.weed) -
    0.5 * Math.max(0, e.cigarettes);

  const balanceBonus = physical > 0 && mental > 0 && spiritual > 0 ? 2 : 0;
  const streakBonus = streakDays > 0 && streakDays % 7 === 0 ? 2 : 0;
  const total = physical + mental + spiritual + penalties + balanceBonus + streakBonus;

  return { physical, mental, spiritual, penalties, balanceBonus, streakBonus, total };
}
