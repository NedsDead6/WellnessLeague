import { describe, expect, it } from "vitest";
import { allTime, formatMetric, rangeTitle, tickText, trendSeries } from "./trends";
import { EMPTY_DAY, type DayEntry } from "./scoring";

const day = (patch: Partial<DayEntry>): DayEntry => ({ ...EMPTY_DAY, ...patch });

const entries = {
  "2026-10-19": day({ exerciseMin: 60, steps: 10000, sleepHours: 8, workHours: 8 }), // Monday
  "2026-10-20": day({ exerciseMin: 30, steps: 6000, sleepHours: 6, workHours: 0 }),
  "2026-10-21": day({ steps: 2000 }),
  "2026-10-12": day({ exerciseMin: 90, steps: 8000, sleepHours: 7, workHours: 9 }),
  "2026-09-30": day({ exerciseMin: 45 }),
};

describe("trends", () => {
  it("totals and averages by day", () => {
    const s = trendSeries(entries, "steps", "day", "2026-10-21", 3);
    expect(s.map((p) => p.total)).toEqual([10000, 6000, 2000]);
    expect(s.map((p) => p.average)).toEqual([10000, 6000, 2000]);
  });

  it("totals a week and averages over days that have the measure logged", () => {
    const [prev, now] = trendSeries(entries, "exercise", "week", "2026-10-19", 2);
    expect(prev).toMatchObject({ start: "2026-10-12", total: 90, days: 1, average: 90 });
    expect(now).toMatchObject({ start: "2026-10-19", total: 90, days: 2, average: 45 });
  });

  it("ignores days where the measure is zero when averaging", () => {
    const [now] = trendSeries(entries, "work", "week", "2026-10-19", 1);
    expect(now).toMatchObject({ total: 8, days: 1, average: 8 });
    const [sleep] = trendSeries(entries, "sleep", "week", "2026-10-19", 1);
    expect(sleep.average).toBe(7);
  });

  it("handles months and years", () => {
    const [oct] = trendSeries(entries, "steps", "month", "2026-10-01", 1);
    expect(oct.total).toBe(26000);
    expect(oct.days).toBe(4);
    const [yr] = trendSeries(entries, "exercise", "year", "2026-01-01", 1);
    expect(yr).toMatchObject({ total: 225, days: 4 });
  });

  it("gives empty periods zeros", () => {
    expect(trendSeries({}, "sleep", "week", "2026-10-19", 2).every((p) => p.total === 0 && p.average === 0 && p.days === 0)).toBe(true);
  });

  it("sums all time", () => {
    expect(allTime(entries, "exercise")).toMatchObject({ total: 225, days: 4 });
  });

  it("formats values in their own units", () => {
    expect(formatMetric("exercise", 45)).toBe("45 min");
    expect(formatMetric("exercise", 90)).toBe("1.5 hrs");
    expect(formatMetric("exercise", 60)).toBe("1 hr");
    expect(formatMetric("steps", 12400)).toBe("12,400");
    expect(formatMetric("sleep", 7.5)).toBe("7.5 hrs");
    expect(formatMetric("work", 1)).toBe("1 hr");
  });

  it("labels the chart's value axis with units", () => {
    expect(tickText("sleep", 4)).toBe("4h");
    expect(tickText("work", 7.5)).toBe("7.5h");
    expect(tickText("exercise", 30)).toBe("30m");
    expect(tickText("exercise", 120)).toBe("2h");
    expect(tickText("steps", 12500)).toBe("12.5k");
    expect(tickText("sleep", 0)).toBe("0");
  });

  it("titles the visible range by month or year", () => {
    expect(rangeTitle("day", "2026-10-05", "2026-10-21")).toBe("October 2026");
    expect(rangeTitle("day", "2026-09-28", "2026-10-11")).toBe("Sep - Oct 2026");
    expect(rangeTitle("week", "2025-12-15", "2026-02-02")).toBe("Dec 2025 - Feb 2026");
    expect(rangeTitle("month", "2025-03-01", "2026-02-01")).toBe("2025 - 2026");
    expect(rangeTitle("year", "2022-01-01", "2026-01-01")).toBe("");
  });
});
