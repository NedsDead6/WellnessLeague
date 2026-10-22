import { describe, expect, it } from "vitest";
import {
  awardCounts,
  challengeProgress,
  feedItems,
  formatWhen,
  seasonStats,
  matchupRecords,
  pairings,
  pillarLeaders,
  scoreMember,
  totalsFor,
  weekDays,
  weekMatchups,
  toDisplay,
  toStored,
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
    expect(records.a).toEqual({ wins: 1, losses: 0, ties: 0, pointsFor: 10, pointsAgainst: 2 });
    expect(records.b).toEqual({ wins: 0, losses: 1, ties: 0, pointsFor: 2, pointsAgainst: 10 });
    const later = matchupRecords(members, "2026-10-26");
    expect(later.a).toEqual({ wins: 1, losses: 1, ties: 0, pointsFor: 11, pointsAgainst: 12 });
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
    expect(byKey.physical).toBeUndefined(); // exercise time is Sweat Equity now
    expect(byKey.exercise.memberId).toBe("c");
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

  it("lists highlights, posts and joins, newest first, without reactions", () => {
    const items = feedItems(
      members,
      [{ id: "p1", league_id: "L", user_id: "b", body: "Big day 💪", created_at: "2026-10-21T20:00:00Z" }],
      [{ userId: "b", joinedAt: "2026-10-19T09:00:00Z" }],
      "2026-10-21",
    );
    expect(items[0]).toMatchObject({ text: "B: Big day 💪", post: { id: "p1", name: "B", mine: false } });
    expect(items.some((i) => i.text.includes("B walked 16,000 steps"))).toBe(true);
    expect(items.some((i) => i.text.includes("You walked 12,000 steps"))).toBe(true);
    expect(items.some((i) => i.text === "B joined the league")).toBe(true);
    expect(items.some((i) => i.text.includes("🔥"))).toBe(false);
    const times = items.map((i) => Date.parse(i.at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it("shows what the exercise was in the highlight", () => {
    const m = scored([member("b", { "2026-10-21": { exerciseMin: 75, exerciseNote: "Trail run" } })]);
    expect(feedItems(m, [], [], "2026-10-21")[0].text).toContain("exercised for 75 min: Trail run");
  });

  it("skips anything older than two weeks", () => {
    const old = scored([member("a", { "2026-09-01": { steps: 20000 } })]);
    expect(feedItems(old, [], [], "2026-10-21")).toEqual([]);
  });
});

describe("season stats", () => {
  const members = scored([
    member("a", { "2026-10-12": { steps: 8000 }, "2026-10-13": { steps: 8000 }, "2026-10-14": { steps: 8000 }, "2026-10-19": { steps: 40000 } }),
    member("b", { "2026-10-12": { steps: 4000 }, "2026-10-20": { steps: 4000 } }),
  ]);

  it("finds the best week, day, average, streak and consistency", () => {
    const s = seasonStats(members);
    expect(s.bestWeek).toEqual({ memberId: "a", points: 10, weekStart: "2026-10-19" });
    expect(s.bestDay).toEqual({ memberId: "a", points: 10, day: "2026-10-19" });
    expect(s.topAverage?.memberId).toBe("a"); // b has fewer than 3 days
    expect(s.longestStreak).toEqual({ memberId: "a", days: 3 });
    expect(s.mostConsistent).toEqual({ memberId: "a", days: 4 });
    expect(s.totalSteps).toBe(8000 * 3 + 40000 + 8000);
    expect(s.totalPoints).toBe(2 * 3 + 10 + 2);
  });

  it("is empty with nothing shared", () => {
    expect(seasonStats(scored([member("a", {})])).bestDay).toBeNull();
  });
});

describe("feed times", () => {
  const now = new Date(2026, 9, 21, 20, 30);
  const at = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();
  it("describes recent and older times", () => {
    expect(formatWhen(at(21, 20, 30), now)).toBe("Just now");
    expect(formatWhen(at(21, 20, 5), now)).toBe("25 min ago");
    expect(formatWhen(at(21, 9, 5), now)).toBe("Today, 9:05 AM");
    expect(formatWhen(at(20, 21, 0), now)).toBe("Yesterday, 9:00 PM");
    expect(formatWhen(at(17, 8, 15), now)).toBe("Sat, 8:15 AM");
    expect(formatWhen(at(8, 8, 15), now)).toBe("Oct 8, 8:15 AM");
    expect(formatWhen("nonsense", now)).toBe("");
  });

  it("uses the time a day was saved and marks days without one as approximate", () => {
    const m = scoreMember({ ...member("a", { "2026-10-20": { steps: 12000 } }), updatedAt: { "2026-10-20": "2026-10-20T19:45:00Z" } }, DEFAULT_RULES);
    const n = scoreMember(member("b", { "2026-10-20": { steps: 12000 } }), DEFAULT_RULES);
    const items = feedItems([m, n], [], [], "2026-10-21");
    expect(items.find((i) => i.text.startsWith("A"))).toMatchObject({ at: "2026-10-20T19:45:00Z", exact: true });
    expect(items.find((i) => i.text.startsWith("B"))?.exact).toBe(false);
  });
});

describe("rest weeks", () => {
  it("counts rest-week points toward the season without a win or loss", () => {
    const members = scored([
      member("a", { "2026-10-12": { steps: 8000 }, "2026-10-19": { steps: 8000 } }, true),
      member("b", { "2026-10-12": { steps: 4000 }, "2026-10-19": { steps: 4000 } }),
      member("c", { "2026-10-12": { steps: 12000 }, "2026-10-19": { steps: 12000 } }),
    ]);
    const records = matchupRecords(members, "2026-10-26");
    const decisions = Object.values(records).reduce((n, r) => n + r.wins + r.losses + r.ties, 0);
    expect(decisions).toBe(4); // one real match per week, two players each
    // Everyone's points for the season include the week they rested.
    for (const m of members) {
      const both = totalsFor(m, [...weekDays("2026-10-12"), ...weekDays("2026-10-19")]).total;
      expect(records[m.id].pointsFor).toBeCloseTo(both, 1);
    }
  });
});

describe("more weekly awards", () => {
  const members = scored([
    member("a", { "2026-10-20": { workHours: 9, steps: 5000, socialHours: 1, exerciseMin: 30, meals: [3, 3, 3], drinks: 2 } }, true),
    member("b", { "2026-10-20": { workHours: 2, steps: 12000, socialHours: 4, exerciseMin: 90, meals: [1, 0, 0] } }),
  ]);
  const byKey = Object.fromEntries(weeklyAwards(members, W2).map((a) => [a.key, a]));

  it("names a winner for work, steps, exercise, meals, social and penalties", () => {
    expect(byKey.grinder).toMatchObject({ memberId: "a", title: "The Grinder" });
    expect(byKey.steps).toMatchObject({ memberId: "b", title: "Mileage Machine" });
    expect(byKey.exercise).toMatchObject({ memberId: "b", detail: "1.5 hrs of exercise" });
    expect(byKey.eater).toMatchObject({ memberId: "a", title: "Golden Fork" });
    expect(byKey.social).toMatchObject({ memberId: "b" });
    expect(byKey.clean).toMatchObject({ memberId: "b", detail: "no penalty points" });
  });

  it("gives no clean-living award when everyone is tied", () => {
    const tied = scored([member("a", { "2026-10-20": { steps: 5000 } }, true), member("b", { "2026-10-20": { steps: 6000 } })]);
    expect(weeklyAwards(tied, W2).some((a) => a.key === "clean")).toBe(false);
  });

  it("shows time goals in hours", () => {
    expect(toDisplay("exerciseMin", 600)).toBe(10);
    expect(toStored("readingMin", 2.5)).toBe(150);
    expect(toDisplay("steps", 1000)).toBe(1000);
  });
});

describe("award counts", () => {
  const members = scored([
    member("a", { [W1]: { steps: 8000 }, [W2]: { steps: 12000 } }),
    member("b", { [W1]: { steps: 4000 }, [W2]: { steps: 40000 } }),
  ]);

  it("only counts weeks that have ended", () => {
    const before = awardCounts(members, W2); // week of W2 is still going
    expect(before.a.mvp).toBe(1);
    expect(before.b?.mvp).toBeUndefined();
    const after = awardCounts(members, "2026-10-26");
    expect(after.a.mvp).toBe(1);
    expect(after.b.mvp).toBe(1);
    expect(after.b.steps).toBe(1);
  });
});

import { buildNotifications, unreadCount } from "./notifications";

describe("notifications", () => {
  const base = {
    userId: "me",
    today: "2026-10-21",
    leagues: [{ id: "L", name: "Friends", created_at: "2026-09-01T00:00:00Z" }],
    names: { me: "Me", sam: "Sam" },
    dayReactions: [],
    feedReactions: [],
    myPosts: [{ id: "9", body: "hello" }],
    posts: [],
  };

  it("covers reactions to your day, your post and your highlight, other people's posts, and the finished week", () => {
    const items = buildNotifications({
      ...base,
      dayReactions: [
        { league_id: "L", reactor_id: "sam", day: "2026-10-20", emoji: "🔥", created_at: "2026-10-20T20:00:00Z" },
        { league_id: "L", reactor_id: "me", day: "2026-10-20", emoji: "🔥", created_at: "2026-10-20T20:00:00Z" },
      ],
      feedReactions: [
        { league_id: "L", item_key: "p-9", reactor_id: "sam", emoji: "👏", created_at: "2026-10-21T10:00:00Z" },
        { league_id: "L", item_key: "me-2026-10-20-walked 12,000 steps", reactor_id: "sam", emoji: "💪", created_at: "2026-10-21T11:00:00Z" },
        { league_id: "L", item_key: "sam-2026-10-20-read for 60 min", reactor_id: "sam", emoji: "👍", created_at: "2026-10-21T12:00:00Z" },
      ],
      posts: [{ id: "5", league_id: "L", user_id: "sam", body: "Who is up for a run?", created_at: "2026-10-21T09:00:00Z" }],
    });
    const texts = items.map((n) => n.text);
    expect(items).toHaveLength(5); // own reaction and reactions to Sam's highlight are skipped
    expect(texts.some((t) => t.includes("your post"))).toBe(true);
    expect(texts.some((t) => t.includes("your highlight (walked 12,000 steps)"))).toBe(true);
    expect(texts.some((t) => t.includes("posted: Who is up"))).toBe(true);
    const week = items.find((n) => n.kind === "week")!;
    expect(week.target).toEqual({ section: "awards", weekStart: "2026-10-12" });
    expect(items.find((n) => n.text.includes("to your Tue"))!.target.day).toBe("2026-10-20");
  });

  it("counts only what is newer than the last look, and skips the week note for a brand new league", () => {
    const items = buildNotifications({
      ...base,
      leagues: [{ id: "L", name: "Friends", created_at: "2026-10-20T00:00:00Z" }],
      posts: [{ id: "5", league_id: "L", user_id: "sam", body: "hi", created_at: "2026-10-21T09:00:00Z" }],
    });
    expect(items.some((n) => n.kind === "week")).toBe(false);
    expect(unreadCount(items, "2026-10-21T08:00:00Z")).toBe(1);
    expect(unreadCount(items, "2026-10-21T10:00:00Z")).toBe(0);
  });
});

import { matchupResultText } from "./notifications";

describe("matchup result", () => {
  it("says who won, or nothing when nobody shared that week", () => {
    const day = "2026-10-14";
    const mk = (id: string, name: string, you: boolean, steps: number): ReturnType<typeof scoreMember> =>
      scoreMember({ id, name, you, avatarUrl: null, entries: steps ? { [day]: { ...EMPTY_DAY, steps } } : {}, updatedAt: {} }, DEFAULT_RULES);
    const win = matchupResultText([mk("a", "Sam Lee", false, 4000), mk("b", "Me", true, 9000)], "2026-10-12");
    expect(win).toMatch(/^You beat Sam /);
    const loss = matchupResultText([mk("a", "Sam Lee", false, 14000), mk("b", "Me", true, 1000)], "2026-10-12");
    expect(loss).toMatch(/^You lost to Sam /);
    expect(matchupResultText([mk("a", "Sam", false, 0), mk("b", "Me", true, 0)], "2026-10-12")).toBeNull();
  });
});

describe("joining mid-league", () => {
  const mk = (id: string, joinedAt?: string) =>
    scoreMember({ id, name: id, you: false, entries: {}, updatedAt: {}, joinedAt }, DEFAULT_RULES);
  const key = (ms: ReturnType<typeof mk>[], week: string) =>
    weekMatchups(ms, week).map((m) => `${m.a.id}-${m.b?.id ?? "rest"}`).sort().join(",");

  it("leaves every week that has started untouched and brings the newcomer in the next week", () => {
    const start = [mk("a", "2026-09-01T10:00:00Z"), mk("b", "2026-09-01T10:00:00Z"), mk("c", "2026-09-02T10:00:00Z"), mk("d", "2026-09-02T10:00:00Z")];
    const withNew = [...start, mk("e", "2026-10-14T10:00:00Z")]; // joins Wednesday of the week of Oct 12
    for (const week of ["2026-09-07", "2026-09-14", "2026-10-05", "2026-10-12"]) {
      expect(key(withNew, week).replace(/,?e-rest/, "")).toBe(key(start, week));
    }
    expect(key(withNew, "2026-10-12")).toContain("e-rest"); // waits out the week it joined
    expect(key(withNew, "2026-10-19")).toMatch(/e-|-e/); // plays from the following week
    expect(key(withNew, "2026-10-19")).not.toContain("e-rest");
  });

  it("starts a brand new league straight away", () => {
    const fresh = [mk("a", "2026-10-13T10:00:00Z"), mk("b", "2026-10-14T10:00:00Z")];
    expect(key(fresh, "2026-10-12")).toMatch(/a-b|b-a/);
  });
});
