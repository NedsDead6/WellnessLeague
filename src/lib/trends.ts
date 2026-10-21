import { periodEnd, shiftPeriod, type Period } from "./dates";
import type { EntryMap } from "./history";
import type { DayEntry } from "./scoring";

export type MetricId = "exercise" | "steps" | "sleep" | "work";

export const METRICS: { id: MetricId; label: string; get: (e: DayEntry) => number }[] = [
  { id: "exercise", label: "Exercise", get: (e) => e.exerciseMin },
  { id: "steps", label: "Steps", get: (e) => e.steps },
  { id: "sleep", label: "Sleep", get: (e) => e.sleepHours },
  { id: "work", label: "Work", get: (e) => e.workHours },
];

export interface TrendPoint {
  start: string;
  /** Everything added up over the period (minutes, steps or hours). */
  total: number;
  /** The total divided by the days that have something logged for this measure. */
  average: number;
  /** Days with something logged for this measure. */
  days: number;
}

function summarize(entries: EntryMap, get: (e: DayEntry) => number, from: string, to: string): Omit<TrendPoint, "start"> {
  let total = 0;
  let days = 0;
  for (const [day, entry] of Object.entries(entries)) {
    if (day < from || day > to) continue;
    const v = get(entry);
    if (v > 0) {
      total += v;
      days += 1;
    }
  }
  return { total, days, average: days ? total / days : 0 };
}

/** One point per period for `count` periods in a row, ending with the period that starts at `anchor`. */
export function trendSeries(entries: EntryMap, metric: MetricId, period: Period, anchor: string, count: number): TrendPoint[] {
  const get = METRICS.find((m) => m.id === metric)!.get;
  const points: TrendPoint[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = shiftPeriod(anchor, period, -i);
    points.push({ start, ...summarize(entries, get, start, periodEnd(start, period)) });
  }
  return points;
}

export function allTime(entries: EntryMap, metric: MetricId): Omit<TrendPoint, "start"> {
  return summarize(entries, METRICS.find((m) => m.id === metric)!.get, "0000-01-01", "9999-12-31");
}

/** A value in the measure's own words: "45 min", "1.5 hrs", "12,400" or "7.5 hrs". */
export function formatMetric(metric: MetricId, value: number): string {
  const r1 = (n: number) => Number(n.toFixed(1)).toLocaleString("en-US");
  if (metric === "steps") return Math.round(value).toLocaleString("en-US");
  const hrs = (n: number) => `${r1(n)} ${Number(n.toFixed(1)) === 1 ? "hr" : "hrs"}`;
  if (metric === "exercise") return value < 60 ? `${Math.round(value)} min` : hrs(value / 60);
  return hrs(value);
}
