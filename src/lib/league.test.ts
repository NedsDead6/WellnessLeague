import { describe, expect, it } from "vitest";
import {
  challengeProgress,
  feedItems,
  matchupRecords,
  pairings,
  pillarLeaders,
  scoreMember,
  totalsFor,
  weekDays,
  weekMatchups,
  weeklyAwards,
  type LeagueMember,
} from "./league";
import { DEFAULT_RULES, EMPTY_DAY, normalizeRules, type DayEntry } from "./scoring";

const W1 = "2026-10-12"; // Mondays
const W2 = "2026-10-19";

const member = (id: string, entries: Record<string, Partial<DayEntry>>, you = false): LeagueMember => ({
  id,
  name: id.toUpperCase(),
  you,
  entries: Object.fromEntries(Object.entries(entries).map(([d, e]) => [d, { ...EMPTY_DAY, ...e }])),
});
const scored = (list: LeagueMember[], rules = DEFAULT_RULES) => list.map((m) => scoreMember(m, rules));

describe("pairings", () => {
  it("pairs everyone each week and plays everyone once per cycle (even count)", () => {
    const ids = ["a", "b", "c", "d"];
    const seen = new Set<string>();
    for (let week = 0; week < 3; week += 1) {
      const start = weekDays("2026-10-05")[0];
      const w = new Date(Date.UTC(2026, 9, 5 + week * 7)).toISOString().slice(0, 10);
      const pairs = pairings(ids, w);
      expect(pairs).toHaveLength(2);
      expect(new Set(pairs.flatMap((p) => [p.a, p.b])).size).toBe(4);
      for (const p of pairs) seen.add([p.a, p.b].sort().join("-"));
      expect(start).toBe("2026-10-05");
    }
    expect(seen.size).toBe(6);
  });

  it("gives one person a rest week with an odd number of members", () => {
    const pairs = pairings(["a", "b", "c"], W1);
    expect(pairs.filter((p) => p.b === null)).toHaveLength(1);
    expect(pairs).toHaveLength(2);
  });

  it("is the same whatever order the members arrive in", () => {
    expect(pairings(["c", "a", "b", "d"], W2)).toEqual(pairings(["a", "b", "c", "d"], W2));
    expect(pairings(["a"], W2)).toEqual([]);
  });
});

describe("matchups and records", () => {
  const members = scored([
    member("a", { [W1]: { steps: 40000 }, [W2]: { steps: 4000 } }),
    member("b", { [W1]: { steps: 8000 }, [W2]: { steps: 40000 } }),
  ]);

  it("compares weekly totals", () => {
    const m = weekMatchups(members, W1);
    expect(m).toHaveLength(1);
    const a = m[0].a.id === "a" ? m[0].aPoints : m[0].bPoints;
    expect(a).toBe(10);
  });

  it("keeps a win-loss record over completed weeks only", () => {
    const records = matchupRecords(members, W2);
    expect(records.a).toEqual({ wins: 1, losses: 0, ties: 0 });
    expect(records.b).toEqual({ wins: 0, losses: 1, ties: 0 });
    const later = matchupRecords(members, "2026-10-26");
    expect(later.a).toEqual({ wins: 1, losses: 1, ties: 0 });
  });
});

describe("weekly awards", () => {
  const members = scored([
    member("a", { [W1]: { steps: 8000 }, [W2]: { steps: 12000, workHours: 2 } }),
    member("b", { [W1]: { steps: 4000 }, [W2]: { steps: 40000, worshipMin: 15, workHours: 1 } }),
    member("c", { [W2]: { exerciseMin: 15 } }),
  ]);
  const byKey = Object.fromEntries(weeklyAwards(members, W2).map((a) => [a.key, a]));

  it("names an MVP and the most improved", () => {
    expect(byKey.mvp.memberId).toBe("b");
    expect(byKey.improved.memberId).toBe("b");
    expect(byKey.improved.detail).toContain("up");
  });

  it("names the most balanced and a king per pillar", () => {
    expect(byKey.balanced.memberId).toBe("b"); // only b has points in all three pillars
    expect(byKey.physical.memberId).toBe("b");
    expect(byKey.mental.memberId).toBe("a");
    expect(byKey.spiritual.memberId).toBe("b");
  });

  it("leaves awards out when nobody earned them", () => {
    expect(weeklyAwards(scored([member("a", {})]), W2)).toEqual([]);
  });

  it("finds pillar leaders for any range", () => {
    const leaders = pillarLeaders(members, weekDays(W2));
    expect(leaders.find((l) => l.key === "physical")?.memberId).toBe("b");
  });
});

describe("league scoring rules", () => {
  it("re-scores history with a league's own rules", () => {
    const m = member("a", { [W2]: { exerciseMin: 30 } });
    const custom = normalizeRules({ rules: { exercise: { points: 5, per: 15, max: 12 } } });
    expect(totalsFor(scoreMember(m, DEFAULT_RULES), [W2]).total).toBe(2);
    expect(totalsFor(scoreMember(m, custom), [W2]).total).toBe(10);
  });
});

describe("challenges", () => {
  const members = scored([
    member("a", { [W2]: { steps: 6000 }, "2026-10-20": { steps: 4000 } }),
    member("b", { [W2]: { steps: 12000 }, [W1]: { steps: 99999 } }),
  ]);

  it("adds up everyone's days within the challenge week", () => {
    const p = challengeProgress({ id: "x", metric: "steps", target: 20000, week_start: W2 }, members);
    expect(p.total).toBe(22000);
    expect(p.done).toBe(true);
    expect(p.byMember[0].member.id).toBe("b");
  });

  it("can track points", () => {
    const p = challengeProgress({ id: "x", metric: "points", target: 100, week_start: W2 }, members);
    expect(p.total).toBeCloseTo(1.5 + 1 + 3, 5);
    expect(p.done).toBe(false);
  });
});

describe("activity feed", () => {
  const members = scored([
    member("a", { "2026-10-20": { steps: 12000 } }, true),
    member("b", { "2026-10-21": { steps: 16000, exerciseMin: 90 } }),
  ]);

  it("lists highlights, reactions and joins, newest first", () => {
    const items = feedItems(
      members,
      [{ league_id: "L", target_user_id: "b", day: "2026-10-21", reactor_id: "a", emoji: "🔥", created_at: "2026-10-21T20:00:00Z" }],
      [{ userId: "b", joinedAt: "2026-10-19T09:00:00Z" }],
      "2026-10-21",
    );
    expect(items[0].text).toContain("You 🔥 B's Wednesday");
    expect(items.some((i) => i.text.includes("B walked 16,000 steps"))).toBe(true);
    expect(items.some((i) => i.text.includes("You walked 12,000 steps"))).toBe(true);
    expect(items.some((i) => i.text === "B joined the league")).toBe(true);
    const whens = items.map((i) => i.when);
    expect([...whens].sort().reverse()).toEqual(whens);
  });

  it("skips anything older than two weeks", () => {
    const old = scored([member("a", { "2026-09-01": { steps: 20000 } })]);
    expect(feedItems(old, [], [], "2026-10-21")).toEqual([]);
  });
});
