// Calendar-day helpers. A "day key" is a plain YYYY-MM-DD string in the
// person's own time zone, so a late-night log still counts for that evening.
// All arithmetic runs in UTC so daylight saving never shifts a day.

export type Period = "day" | "week" | "month" | "year";

export const pad = (n: number) => String(n).padStart(2, "0");

/** Today's (or any Date's) day key in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUTC(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(key: string, n: number): string {
  const date = toUTC(key);
  date.setUTCDate(date.getUTCDate() + n);
  return fromUTC(date);
}

/** First day of the month that is `n` months from the month of `key`. */
export function addMonths(key: string, n: number): string {
  const date = toUTC(key);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + n);
  return fromUTC(date);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** Monday is 0 and Sunday is 6. */
export function weekdayIndex(key: string): number {
  return (toUTC(key).getUTCDay() + 6) % 7;
}

export function daysInMonth(key: string): number {
  const date = toUTC(key);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export const yearOf = (key: string) => Number(key.slice(0, 4));

/** The first day of the period that contains `key`. Weeks start on Monday. */
export function periodStart(key: string, period: Period): string {
  switch (period) {
    case "day":
      return key;
    case "week":
      return addDays(key, -weekdayIndex(key));
    case "month":
      return `${key.slice(0, 7)}-01`;
    case "year":
      return `${key.slice(0, 4)}-01-01`;
  }
}

/** The start of the period `n` periods away from the period starting at `start`. */
export function shiftPeriod(start: string, period: Period, n: number): string {
  switch (period) {
    case "day":
      return addDays(start, n);
    case "week":
      return addDays(start, 7 * n);
    case "month":
      return addMonths(start, n);
    case "year":
      return `${yearOf(start) + n}-01-01`;
  }
}

/** The last day (inclusive) of the period starting at `start`. */
export function periodEnd(start: string, period: Period): string {
  return addDays(shiftPeriod(start, period, 1), -1);
}

const fmt = (key: string, options: Intl.DateTimeFormatOptions) =>
  toUTC(key).toLocaleDateString("en-US", { timeZone: "UTC", ...options });

/** Full label for the period starting at `start`, such as "Oct 19 - 25". */
export function periodLabel(start: string, period: Period): string {
  switch (period) {
    case "day":
      return fmt(start, { weekday: "short", month: "short", day: "numeric" });
    case "week": {
      const end = periodEnd(start, "week");
      const sameMonth = start.slice(0, 7) === end.slice(0, 7);
      return sameMonth
        ? `${fmt(start, { month: "short", day: "numeric" })} - ${fmt(end, { day: "numeric" })}`
        : `${fmt(start, { month: "short", day: "numeric" })} - ${fmt(end, { month: "short", day: "numeric" })}`;
    }
    case "month":
      return fmt(start, { month: "long", year: "numeric" });
    case "year":
      return String(yearOf(start));
  }
}

/** Short label for a chart axis. */
export function axisLabel(start: string, period: Period): string {
  switch (period) {
    case "day":
      return fmt(start, { day: "numeric" });
    case "week":
      return fmt(start, { month: "short", day: "numeric" });
    case "month":
      return fmt(start, { month: "short" });
    case "year":
      return String(yearOf(start));
  }
}

export const dayLong = (key: string) => fmt(key, { weekday: "long", month: "long", day: "numeric" });
export const dayShortWeekday = (key: string) => fmt(key, { weekday: "short" });
export const dayOfMonth = (key: string) => Number(key.slice(8, 10));
export const monthTitle = (key: string) => fmt(key, { month: "long", year: "numeric" });
