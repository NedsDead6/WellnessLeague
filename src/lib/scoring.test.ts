import { describe, expect, it } from "vitest";
import { EMPTY_DAY, scoreDay, sleepPoints } from "./scoring";

describe("scoreDay", () => {
  it("scores an empty day as zero", () => {
    expect(scoreDay(EMPTY_DAY, 0).total).toBe(0);
  });

  it("gives +3 per 30 minutes of exercise, capped at 2 hours", () => {
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 29 }, 0).physical).toBe(0);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 30 }, 0).physical).toBe(3);
    expect(scoreDay({ ...EMPTY_DAY, exerciseMin: 600 }, 0).physical).toBe(12);
  });

  it("gives +1 per 1,000 steps", () => {
    expect(scoreDay({ ...EMPTY_DAY, steps: 999 }, 0).physical).toBe(0);
    expect(scoreDay({ ...EMPTY_DAY, steps: 10500 }, 0).physical).toBe(10);
  });

  it("grades sleep", () => {
    expect(sleepPoints(5.5)).toBe(0);
    expect(sleepPoints(6)).toBe(1);
    expect(sleepPoints(7)).toBe(2);
    expect(sleepPoints(8)).toBe(3);
  });

  it("scores meals 0 to 2 each", () => {
    expect(scoreDay({ ...EMPTY_DAY, meals: [2, 1, 0] }, 0).physical).toBe(3);
  });

  it("applies penalties", () => {
    const day = { ...EMPTY_DAY, screenHours: 2, drinks: 2, weed: 1, cigarettes: 4 };
    expect(scoreDay(day, 0).penalties).toBe(-2 - 1 - 5 - 2);
  });

  it("adds the balance bonus only with points in all three pillars", () => {
    const two = { ...EMPTY_DAY, steps: 3000, workHours: 2 };
    expect(scoreDay(two, 0).balanceBonus).toBe(0);
    expect(scoreDay({ ...two, worshipMin: 15 }, 0).balanceBonus).toBe(2);
  });

  it("adds the streak bonus on every 7th consecutive day", () => {
    expect(scoreDay(EMPTY_DAY, 6).streakBonus).toBe(0);
    expect(scoreDay(EMPTY_DAY, 7).streakBonus).toBe(2);
    expect(scoreDay(EMPTY_DAY, 14).streakBonus).toBe(2);
  });
});
