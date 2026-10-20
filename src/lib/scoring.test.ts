import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, EMPTY_DAY, isDefaultRules, normalizeRules, pillarMax, scoreDay, sleepPoints } from "./scoring";

describe("scoreDay", () => {
  it("scores an empty day as zero", () => {
    expect(scoreDay(EMPTY_DAY, 0).total).toBe(0);
  });

  it("gives +1 per 15 minutes of exercise, capped at 12", () => {
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 14 }, 0).physical).toBe(0);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 15 }, 0).physical).toBe(1);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 60 }, 0).physical).toBe(4);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 600 }, 0).physical).toBe(12);
  });

  it("gives 0.00025 points per step, capped at 20", () => {
    expect(scoreDay({ ...EMPTY_DAY, steps: 4000 }, 0).categories.steps).toBe(1);
    expect(scoreDay({ ...EMPTY_DAY, steps: 16972 }, 0).categories.steps).toBe(4.243);
    expect(scoreDay({ ...EMPTY_DAY, steps: 200000 }, 0).categories.steps).toBe(20);
  });

  it("gives +1 per 15 minutes of journaling, capped at 3", () => {
    expect(scoreDay({ ...EMPTY_DAY, journalMin: 14 }, 0).categories.journal).toBe(0);
    expect(scoreDay({ ...EMPTY_DAY, journalMin: 30 }, 0).categories.journal).toBe(2);
    expect(scoreDay({ ...EMPTY_DAY, journalMin: 120 }, 0).categories.journal).toBe(3);
  });

  it("scores sleep 1 per hour, with +1 at 7 hours and +2 at 8", () => {
    expect(sleepPoints(0)).toBe(0);
    expect(sleepPoints(5.5)).toBe(5.5);
    expect(sleepPoints(6)).toBe(6);
    expect(sleepPoints(7)).toBe(8);
    expect(sleepPoints(8)).toBe(10);
    expect(sleepPoints(11)).toBe(10);
  });

  it("scores meals 0 to 2 each", () => {
    expect(scoreDay({ ...EMPTY_DAY, meals: [2, 1, 0] }, 0).physical).toBe(3);
  });

  it("applies penalties", () => {
    const day = { ...EMPTY_DAY, screenHours: 2, drinks: 2, weed: 1, cigarettes: 4 };
    expect(scoreDay(day, 0).penalties).toBe(-2 - 1 - 5 - 2);
  });

  it("adds the balance bonus only with points in all three pillars", () => {
    const two = { ...EMPTY_DAY, steps: 12000, workHours: 2 };
    expect(scoreDay(two, 0).balanceBonus).toBe(0);
    expect(scoreDay({ ...two, worshipMin: 15 }, 0).balanceBonus).toBe(2);
  });

  it("adds the streak bonus on every 7th consecutive day", () => {
    expect(scoreDay(EMPTY_DAY, 6).streakBonus).toBe(0);
    expect(scoreDay(EMPTY_DAY, 7).streakBonus).toBe(2);
    expect(scoreDay(EMPTY_DAY, 14).streakBonus).toBe(2);
  });
});

describe("custom scoring rules", () => {
  it("defaults to the standard rules and leaves them untouched", () => {
    expect(normalizeRules(undefined)).toEqual(DEFAULT_RULES);
    expect(normalizeRules({})).toEqual(DEFAULT_RULES);
    expect(isDefaultRules(DEFAULT_RULES)).toBe(true);
  });

  it("applies custom points, units and caps", () => {
    const rules = normalizeRules({ rules: { exercise: { points: 2, per: 10, max: 8 } }, sleep: { perHour: 2, bonus7: 0, bonus8: 0 } });
    expect(isDefaultRules(rules)).toBe(false);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 45 }, 0, rules).categories.exercise).toBe(8);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 30 }, 0, rules).categories.exercise).toBe(6);
    expect(sleepPoints(8, rules)).toBe(16);
    // The standard scoring is unchanged by someone else's custom copy.
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 30 }, 0).categories.exercise).toBe(2);
  });

  it("keeps penalties negative and allows no cap", () => {
    const rules = normalizeRules({ rules: { weed: { points: 3, per: 1, max: null }, drinks: { points: -2, per: 2, max: 3 } } });
    expect(rules.rules.weed.points).toBe(-3);
    expect(scoreDay({ ...EMPTY_DAY, weed: 2 }, 0, rules).penalties).toBe(-6);
    expect(scoreDay({ ...EMPTY_DAY, drinks: 10 }, 0, rules).penalties).toBe(-3);
  });

  it("ignores bad stored values", () => {
    const rules = normalizeRules({ rules: { exercise: { points: "lots", per: 0, max: -4 } }, water: -1, meals: null });
    expect(rules).toEqual(DEFAULT_RULES);
  });

  it("scales bonuses and pillar maximums with the rules", () => {
    const rules = normalizeRules({ balanceBonus: 5, streakBonus: 4 });
    const day = { ...EMPTY_DAY, steps: 8000, workHours: 2, worshipMin: 15 };
    expect(scoreDay(day, 7, rules).balanceBonus).toBe(5);
    expect(scoreDay(day, 7, rules).streakBonus).toBe(4);
    expect(pillarMax(DEFAULT_RULES)).toEqual({ physical: 49, mental: 35, spiritual: 12 });
  });
});
