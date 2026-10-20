import {
  addDays,
  diffDays,
  periodEnd,
  shiftPeriod,
  type Period,
} from "./dates";
import {
  EMPTY_DAY,
  emptyCategoryPoints,
  scoreDay,
  type CategoryKey,
  type CategoryPoints,
  type DayEntry,
  type DayScore,
} from "./scoring";

/** Saved entries keyed by day (YYYY-MM-DD). */
export type EntryMap = Record<string, DayEntry>;

/** A day counts as logged once anything on it differs from an empty day. */
export function isLogged(entry: DayEntry | undefined): boolean {
  if (!entry) return false;
  return (
    entry.exerciseMin !== 0 ||
    entry.steps !== 0 ||
    entry.meals.some((m) => m !== 0) ||
    entry.sleepHours !== 0 ||
    entry.water ||
    entry.meditationMin !== 0 ||
    entry.workHours !== 0 ||
    entry.socialHours !== 0 ||
    entry.readingMin !== 0 ||
    entry.journalEntries !== 0 ||
    entry.worshipMin !== 0 ||
    entry.serviceHours !== 0 ||
    entry.screenHours !== 0 ||
    entry.drinks !== 0 ||
    entry.weed !== 0 ||
    entry.cigarettes !== 0
  );
}

/** Fills in anything missing from a stored entry so old rows keep working. */
export function normalizeEntry(raw: unknown): DayEntry {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<DayEntry>;
  const meals = Array.isArray(source.meals) ? source.meals : EMPTY_DAY.meals;
  return {
    ...EMPTY_DAY,
    ...source,
    meals: [Number(meals[0]) || 0, Number(meals[1]) || 0, Number(meals[2]) || 0],
    water: Boolean(source.water),
  };
}

/** Consecutive logged days ending on `day` (0 when `day` itself isn't logged). */
export function streakAt(entries: EntryMap, day: string): number {
  if (!isLogged(entries[day])) return 0;
  let count = 1;
  while (isLogged(entries[addDays(day, -count)])) count += 1;
  return count;
}

/** The streak that's still alive today: ending today, or yesterday if today isn't logged yet. */
export function currentStreak(entries: EntryMap, today: string): number {
  return isLogged(entries[today]) ? streakAt(entries, today) : streakAt(entries, addDays(today, -1));
}

export interface ScoredDay {
  day: string;
  entry: DayEntry;
  score: DayScore;
  streak: number;
}

/** Every logged day, oldest first, scored with its streak. */
export function scoreHistory(entries: EntryMap): ScoredDay[] {
  const days = Object.keys(entries)
    .filter((day) => isLogged(entries[day]))
    .sort();
  let previous: string | null = null;
  let streak = 0;
  return days.map((day) => {
    streak = previous !== null && diffDays(day, previous) === 1 ? streak + 1 : 1;
    previous = day;
    return { day, entry: entries[day], score: scoreDay(entries[day], streak), streak };
  });
}

export function bestStreak(history: ScoredDay[]): number {
  return history.reduce((best, d) => Math.max(best, d.streak), 0);
}

export interface Totals {
  total: number;
  physical: number;
  mental: number;
  spiritual: number;
  penalties: number;
  bonuses: number;
  loggedDays: number;
  categories: CategoryPoints;
}

export function sumDays(days: ScoredDay[]): Totals {
  const totals: Totals = {
    total: 0,
    physical: 0,
    mental: 0,
    spiritual: 0,
    penalties: 0,
    bonuses: 0,
    loggedDays: days.length,
    categories: emptyCategoryPoints(),
  };
  for (const { score } of days) {
    totals.total += score.total;
    totals.physical += score.physical;
    totals.mental += score.mental;
    totals.spiritual += score.spiritual;
    totals.penalties += score.penalties;
    totals.bonuses += score.balanceBonus + score.streakBonus;
    for (const key of Object.keys(score.categories) as (keyof CategoryPoints)[]) {
      totals.categories[key] += score.categories[key];
    }
  }
  return totals;
}

/** Totals for the logged days from `start` to `end`, both inclusive. */
export function totalsBetween(history: ScoredDay[], start: string, end: string): Totals {
  return sumDays(history.filter((d) => d.day >= start && d.day <= end));
}

/** The same totals, scaled to an average per logged day. */
export function averageOf(t: Totals): Totals {
  const n = t.loggedDays;
  if (n === 0) return t;
  const categories = emptyCategoryPoints();
  for (const key of Object.keys(t.categories) as CategoryKey[]) categories[key] = t.categories[key] / n;
  return {
    total: t.total / n,
    physical: t.physical / n,
    mental: t.mental / n,
    spiritual: t.spiritual / n,
    penalties: t.penalties / n,
    bonuses: t.bonuses / n,
    loggedDays: n,
    categories,
  };
}

export interface SeriesPoint {
  start: string;
  loggedDays: number;
  /** Average points per logged day in this period, split by category. */
  average: Totals;
}

/**
 * Average points per logged day for `count` periods in a row, ending with the
 * period that starts at `anchor`. For a "day" period that is just that day.
 */
export function averageSeries(history: ScoredDay[], period: Period, anchor: string, count: number): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = shiftPeriod(anchor, period, -i);
    const totals = totalsBetween(history, start, periodEnd(start, period));
    points.push({ start, loggedDays: totals.loggedDays, average: averageOf(totals) });
  }
  return points;
}
