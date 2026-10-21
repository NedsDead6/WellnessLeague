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

export const WEEKDAY_LETTERS = ["M", "T", "W", "Th", "F", "S", "S"];

/** Short value labels for the chart's left edge: "8h", "45m", "12k". */
export function tickText(metric: MetricId, v: number): string {
  if (v === 0) return "0";
  if (metric === "steps") return v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));
  if (metric === "exercise") return v < 60 ? `${Math.round(v)}m` : `${Number((v / 60).toFixed(1))}h`;
  return `${Number(v.toFixed(1))}h`;
}

/**
 * The heading above the chart for what is on screen: "October 2026", "Sep - Oct 2026",
 * "2026" for months, nothing for years. `first` and `last` are the first and last visible period starts.
 */
export function rangeTitle(period: Period, first: string, last: string): string {
  const month = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
  const longMonth = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long" });
  const yearOf = (key: string) => key.slice(0, 4);
  if (period === "year") return "";
  if (period === "month") return yearOf(first) === yearOf(last) ? yearOf(first) : `${yearOf(first)} - ${yearOf(last)}`;
  if (first.slice(0, 7) === last.slice(0, 7)) return `${longMonth(first)} ${yearOf(first)}`;
  if (yearOf(first) === yearOf(last)) return `${month(first)} - ${month(last)} ${yearOf(first)}`;
  return `${month(first)} ${yearOf(first)} - ${month(last)} ${yearOf(last)}`;
}
