import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayKey,
  daysInMonth,
  diffDays,
  periodEnd,
  periodLabel,
  periodStart,
  shiftPeriod,
  weekdayIndex,
} from "./dates";
import {
  bestStreak,
  currentStreak,
  isLogged,
  normalizeEntry,
  averageSeries,
  scoreHistory,
  streakAt,
  totalsBetween,
  type EntryMap,
} from "./history";
import { EMPTY_DAY, categoryPoints, scoreDay } from "./scoring";

describe("dates", () => {
  it("builds a local day key", () => {
    expect(dayKey(new Date(2026, 9, 19, 23, 59))).toBe("2026-10-19");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("is not thrown off by daylight saving", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(diffDays("2026-11-02", "2026-11-01")).toBe(1);
  });

  it("finds weekdays with Monday first", () => {
    expect(weekdayIndex("2026-10-19")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-25")).toBe(6); // Sunday
  });

  it("finds period starts and ends", () => {
    expect(periodStart("2026-10-21", "week")).toBe("2026-10-19");
    expect(periodEnd("2026-10-19", "week")).toBe("2026-10-25");
    expect(periodStart("2026-10-21", "month")).toBe("2026-10-01");
    expect(periodEnd("2026-10-01", "month")).toBe("2026-10-31");
    expect(periodStart("2026-10-21", "year")).toBe("2026-01-01");
    expect(periodEnd("2026-01-01", "year")).toBe("2026-12-31");
    expect(periodEnd("2026-10-21", "day")).toBe("2026-10-21");
  });

  it("shifts periods", () => {
    expect(shiftPeriod("2026-10-19", "week", -1)).toBe("2026-10-12");
    expect(shiftPeriod("2026-01-01", "month", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2026-10-01", "month", 3)).toBe("2027-01-01");
    expect(shiftPeriod("2026-01-01", "year", -2)).toBe("2024-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("counts days in a month", () => {
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(daysInMonth("2024-02-10")).toBe(29);
    expect(daysInMonth("2026-10-01")).toBe(31);
  });

  it("labels periods", () => {
    expect(periodLabel("2026-10-19", "week")).toBe("Oct 19 - 25");
    expect(periodLabel("2026-10-26", "week")).toBe("Oct 26 - Nov 1");
    expect(periodLabel("2026-10-01", "month")).toBe("October 2026");
    expect(periodLabel("2026-01-01", "year")).toBe("2026");
  });
});

// A day worth `n / 1000` points of steps (1 point = 4,000 steps).
const walked = (n: number) => ({ ...EMPTY_DAY, steps: n * 4 });

describe("history", () => {
  it("treats an all-empty day as not logged", () => {
    expect(isLogged(EMPTY_DAY)).toBe(false);
    expect(isLogged(undefined)).toBe(false);
    expect(isLogged(walked(1000))).toBe(true);
    expect(isLogged({ ...EMPTY_DAY, water: true })).toBe(true);
  });

  it("fills in missing fields on stored entries", () => {
    const entry = normalizeEntry({ steps: 5000, meals: [2] });
    expect(entry.steps).toBe(5000);
    expect(normalizeEntry({ journalEntries: 2 }).journalMin).toBe(30);
    expect(normalizeEntry({ journalMin: 45, journalEntries: 2 }).journalMin).toBe(45);
    expect(entry.meals).toEqual([2, 0, 0]);
    expect(entry.workHours).toBe(0);
    expect(normalizeEntry(null)).toEqual(EMPTY_DAY);
  });

  it("counts streaks through gaps correctly", () => {
    const entries: EntryMap = {
      "2026-10-10": walked(1000),
      "2026-10-11": walked(1000),
      "2026-10-13": walked(1000),
      "2026-10-14": walked(1000),
      "2026-10-15": walked(1000),
      "2026-10-16": EMPTY_DAY,
    };
    expect(streakAt(entries, "2026-10-11")).toBe(2);
    expect(streakAt(entries, "2026-10-15")).toBe(3);
    expect(streakAt(entries, "2026-10-16")).toBe(0);
    expect(currentStreak(entries, "2026-10-16")).toBe(3);
    expect(currentStreak(entries, "2026-10-20")).toBe(0);
    expect(bestStreak(scoreHistory(entries))).toBe(3);
  });

  it("awards the streak bonus on the 7th consecutive day only", () => {
    const entries: EntryMap = {};
    for (let i = 0; i < 8; i += 1) entries[addDays("2026-10-01", i)] = walked(1000);
    const history = scoreHistory(entries);
    expect(history.map((d) => d.score.streakBonus)).toEqual([0, 0, 0, 0, 0, 0, 2, 0]);
    expect(history[6].score.total).toBe(1 + 2);
  });

  it("sums a period and splits it by category", () => {
    const entries: EntryMap = {
      "2026-10-19": { ...EMPTY_DAY, steps: 20000, exerciseMin: 30 },
      "2026-10-20": { ...EMPTY_DAY, steps: 8000, drinks: 2 },
      "2026-10-27": walked(9000),
    };
    const history = scoreHistory(entries);
    const week = totalsBetween(history, "2026-10-19", "2026-10-25");
    expect(week.loggedDays).toBe(2);
    expect(week.categories.steps).toBe(7);
    expect(week.categories.exercise).toBe(2);
    expect(week.categories.drinks).toBe(-1);
    expect(week.total).toBe(7 + 2 - 1);
    expect(week.total).toBe(week.physical + week.mental + week.spiritual + week.penalties + week.bonuses);
  });

  it("builds a series of per-logged-day averages ending at the anchor", () => {
    const entries: EntryMap = {
      "2026-10-12": walked(4000),
      "2026-10-20": walked(6000),
      "2026-10-21": walked(2000),
    };
    const series = averageSeries(scoreHistory(entries), "week", "2026-10-19", 3);
    expect(series.map((p) => p.start)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(series.map((p) => p.average.total)).toEqual([0, 4, 4]);
    expect(series.map((p) => p.loggedDays)).toEqual([0, 1, 2]);
    expect(series[2].average.categories.steps).toBe(4);
  });

  it("uses each day's own points for a daily series", () => {
    const entries: EntryMap = { "2026-10-19": walked(3000), "2026-10-20": walked(5000) };
    const series = averageSeries(scoreHistory(entries), "day", "2026-10-20", 3);
    expect(series.map((p) => p.average.total)).toEqual([0, 3, 5]);
  });

  it("keeps category points consistent with the day score", () => {
    const day = { ...EMPTY_DAY, steps: 6000, workHours: 6, worshipMin: 30, screenHours: 2, meals: [2, 1, 0] as [number, number, number] };
    const score = scoreDay(day, 1);
    const sum = Object.values(categoryPoints(day)).reduce((a, b) => a + b, 0);
    expect(score.total - score.balanceBonus - score.streakBonus).toBe(sum);
  });
});
