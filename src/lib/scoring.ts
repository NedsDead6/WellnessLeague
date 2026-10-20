// Scoring rules for Wellness League. Pure functions only, so the same code can
// score entries in the browser now and on the server later.
// Every rule below comes from the plan's scoring table. Change numbers here,
// and the whole app follows.

export type Pillar = "physical" | "mental" | "spiritual";
export type Group = Pillar | "penalty";

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

export type CategoryKey =
  | "exercise"
  | "steps"
  | "meals"
  | "sleep"
  | "water"
  | "meditation"
  | "work"
  | "social"
  | "reading"
  | "journal"
  | "worship"
  | "service"
  | "screen"
  | "drinks"
  | "weed"
  | "cigarettes";

export const CATEGORIES: { key: CategoryKey; label: string; group: Group }[] = [
  { key: "exercise", label: "Exercise", group: "physical" },
  { key: "steps", label: "Steps", group: "physical" },
  { key: "meals", label: "Healthy meals", group: "physical" },
  { key: "sleep", label: "Sleep", group: "physical" },
  { key: "water", label: "Water", group: "physical" },
  { key: "meditation", label: "Meditation", group: "mental" },
  { key: "work", label: "Work", group: "mental" },
  { key: "social", label: "Social time", group: "mental" },
  { key: "reading", label: "Reading", group: "mental" },
  { key: "journal", label: "Journaling or gratitude", group: "mental" },
  { key: "worship", label: "Worship and prayer", group: "spiritual" },
  { key: "service", label: "Service or volunteering", group: "spiritual" },
  { key: "screen", label: "Screen time (non-work)", group: "penalty" },
  { key: "drinks", label: "Alcoholic drinks", group: "penalty" },
  { key: "weed", label: "Weed", group: "penalty" },
  { key: "cigarettes", label: "Cigarettes", group: "penalty" },
];

export type CategoryPoints = Record<CategoryKey, number>;

export const emptyCategoryPoints = (): CategoryPoints =>
  Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as CategoryPoints;

const capped = (value: number, perUnit: number, pointsPerUnit: number, maxPoints: number) =>
  Math.min(maxPoints, Math.floor(Math.max(0, value) / perUnit) * pointsPerUnit);

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * 1 point per hour slept, up to 8 hours, plus a bonus for a full night:
 * +1 at 7 hours (8 points total) and +2 at 8 hours or more (10 points).
 */
export function sleepPoints(hours: number): number {
  const h = Math.max(0, hours);
  const bonus = h >= 8 ? 2 : h >= 7 ? 1 : 0;
  return round3(Math.min(h, 8) + bonus);
}

/** Points each category earned (or lost) for one day, before any bonuses. */
export function categoryPoints(e: DayEntry): CategoryPoints {
  return {
    exercise: capped(e.exerciseMin, 15, 1, 12), // +1 per 15 min, max 12 (3 hours)
    steps: Math.min(20, round3(Math.max(0, e.steps) / 1000)), // 1/1000 of a point per step, max 20
    meals: e.meals.reduce((sum, grade) => sum + Math.min(2, Math.max(0, grade)), 0),
    sleep: sleepPoints(e.sleepHours),
    water: e.water ? 1 : 0,
    meditation: capped(e.meditationMin, 15, 1, 8),
    work: capped(e.workHours, 1, 1, 14),
    social: capped(e.socialHours, 1, 1, 6),
    reading: capped(e.readingMin, 30, 1, 4),
    journal: Math.min(3, Math.max(0, e.journalEntries)),
    worship: capped(e.worshipMin, 15, 1, 8),
    service: capped(e.serviceHours, 1, 1, 4),
    screen: -Math.floor(Math.max(0, e.screenHours)),
    drinks: -0.5 * Math.max(0, e.drinks),
    weed: -5 * Math.max(0, e.weed),
    cigarettes: -0.5 * Math.max(0, e.cigarettes),
  };
}

export interface DayScore {
  physical: number;
  mental: number;
  spiritual: number;
  penalties: number;
  balanceBonus: number;
  streakBonus: number;
  total: number;
  categories: CategoryPoints;
}

/**
 * @param streakDays Consecutive days logged, counting this one. The streak
 *   bonus (+2) lands on every 7th consecutive day.
 */
export function scoreDay(e: DayEntry, streakDays: number): DayScore {
  const categories = categoryPoints(e);
  const sumOf = (group: Group) =>
    CATEGORIES.filter((c) => c.group === group).reduce((sum, c) => sum + categories[c.key], 0);

  const physical = round3(sumOf("physical"));
  const mental = round3(sumOf("mental"));
  const spiritual = round3(sumOf("spiritual"));
  const penalties = round3(sumOf("penalty"));

  const balanceBonus = physical > 0 && mental > 0 && spiritual > 0 ? 2 : 0;
  const streakBonus = streakDays > 0 && streakDays % 7 === 0 ? 2 : 0;
  const total = round3(physical + mental + spiritual + penalties + balanceBonus + streakBonus);

  return { physical, mental, spiritual, penalties, balanceBonus, streakBonus, total, categories };
}
