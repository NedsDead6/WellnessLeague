// League logic as pure functions: scoring members, weekly head-to-head
// pairings and records, awards, the activity feed and team challenges.
// Everything is computed from the raw shared days, so changing a league's
// scoring rules re-scores the whole history.

import { addDays, dayLong, diffDays, periodStart } from "./dates";
import { sumDays, type Totals } from "./history";
import { scoreDay, type DayEntry, type DayScore, type ScoringRules } from "./scoring";

export interface LeagueMember {
  id: string;
  name: string;
  you: boolean;
  avatarUrl?: string | null;
  /** Days this person shared with the league, by day. */
  entries: Record<string, DayEntry>;
  /** When each of those days was last saved (ISO time), where known. */
  updatedAt?: Record<string, string>;
}

export interface ScoredMember extends LeagueMember {
  scores: Record<string, DayScore>;
}

/** Scores a member's shared days. League standings leave out the streak bonus. */
export function scoreMember(member: LeagueMember, rules: ScoringRules): ScoredMember {
  const scores: Record<string, DayScore> = {};
  for (const [day, entry] of Object.entries(member.entries)) scores[day] = scoreDay(entry, 0, rules);
  return { ...member, scores };
}

export const weekOf = (day: string) => periodStart(day, "week");

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export interface MemberTotals extends Totals {
  /** How many of the days in range this person shared. */
  shared: number;
}

export function totalsFor(member: ScoredMember, days: string[]): MemberTotals {
  const scored = days.filter((d) => member.scores[d]).map((d) => ({ score: member.scores[d] }));
  return { ...sumDays(scored), shared: scored.length };
}

/** Monday of the earliest week anyone shared a day, or null when nothing is shared. */
export function firstWeek(members: ScoredMember[]): string | null {
  let first: string | null = null;
  for (const m of members) for (const day of Object.keys(m.scores)) if (first === null || day < first) first = day;
  return first === null ? null : weekOf(first);
}

/** Every Monday from `from` up to and including `to`. */
export function weeksFrom(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let w = from; w <= to; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

// 2024-01-01 is a Monday, so week numbers count up from there.
const weekNumber = (weekStart: string) => Math.round(diffDays(weekStart, "2024-01-01") / 7);

export interface Pairing {
  a: string;
  /** null means a is resting this week (odd number of members). */
  b: string | null;
}

/**
 * Round-robin schedule: everyone plays everyone once before pairings repeat,
 * and with an odd number of members one person rests each week. The same
 * members always produce the same pairings, so every device agrees.
 */
export function pairings(memberIds: string[], weekStart: string): Pairing[] {
  const ids = [...memberIds].sort();
  if (ids.length < 2) return [];
  const list: (string | null)[] = ids.length % 2 === 1 ? [...ids, null] : ids;
  const n = list.length;
  const rounds = n - 1;
  const r = ((weekNumber(weekStart) % rounds) + rounds) % rounds;
  const rest = list.slice(1);
  const arranged = [list[0], ...rest.map((_, i) => rest[(i + r) % rest.length])];
  const result: Pairing[] = [];
  for (let i = 0; i < n / 2; i += 1) {
    const x = arranged[i];
    const y = arranged[n - 1 - i];
    if (x === null && y !== null) result.push({ a: y, b: null });
    else if (x !== null) result.push({ a: x, b: y });
  }
  return result;
}

export interface Matchup {
  a: ScoredMember;
  b: ScoredMember | null;
  aPoints: number;
  bPoints: number;
}

export function weekMatchups(members: ScoredMember[], weekStart: string): Matchup[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const days = weekDays(weekStart);
  return pairings(
    members.map((m) => m.id),
    weekStart,
  ).map((p) => {
    const a = byId.get(p.a)!;
    const b = p.b ? byId.get(p.b)! : null;
    return {
      a,
      b,
      aPoints: totalsFor(a, days).total,
      bPoints: b ? totalsFor(b, days).total : 0,
    };
  });
}

export interface Record3 {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

/** Win-loss-tie record for every member over the completed weeks before `before`. */
export function matchupRecords(members: ScoredMember[], before: string): Record<string, Record3> {
  const records: Record<string, Record3> = Object.fromEntries(members.map((m) => [m.id, { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }]));
  const start = firstWeek(members);
  if (start === null) return records;
  for (const week of weeksFrom(start, addDays(before, -7))) {
    for (const m of weekMatchups(members, week)) {
      // A rest week is no win or loss, but the points still count for the season.
      if (!m.b) {
        records[m.a.id].pointsFor += m.aPoints;
        continue;
      }
      // A week where neither person shared anything isn't a result.
      if (totalsFor(m.a, weekDays(week)).shared + totalsFor(m.b, weekDays(week)).shared === 0) continue;
      records[m.a.id].pointsFor += m.aPoints;
      records[m.a.id].pointsAgainst += m.bPoints;
      records[m.b.id].pointsFor += m.bPoints;
      records[m.b.id].pointsAgainst += m.aPoints;
      if (m.aPoints > m.bPoints) {
        records[m.a.id].wins += 1;
        records[m.b.id].losses += 1;
      } else if (m.aPoints < m.bPoints) {
        records[m.b.id].wins += 1;
        records[m.a.id].losses += 1;
      } else {
        records[m.a.id].ties += 1;
        records[m.b.id].ties += 1;
      }
    }
  }
  for (const r of Object.values(records)) {
    r.pointsFor = Math.round(r.pointsFor * 100) / 100;
    r.pointsAgainst = Math.round(r.pointsAgainst * 100) / 100;
  }
  return records;
}

export interface Award {
  key: string;
  title: string;
  memberId: string;
  detail: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pts = (n: number) => `${round1(n)} pts`;

/** The weekly recap: MVP, most improved, most balanced and a king for each pillar. */
export function weeklyAwards(members: ScoredMember[], weekStart: string): Award[] {
  const days = weekDays(weekStart);
  const previous = weekDays(addDays(weekStart, -7));
  const rows = members.map((m) => {
    const now = totalsFor(m, days);
    const before = totalsFor(m, previous);
    const balancedDays = days.filter((d) => (m.scores[d]?.balanceBonus ?? 0) > 0).length;
    const weakestPillar = Math.min(now.physical, now.mental, now.spiritual);
    const sum = (pick: (e: DayEntry) => number) => days.reduce((n, d) => n + (m.entries[d] ? pick(m.entries[d]) : 0), 0);
    return {
      m,
      now,
      before,
      balancedDays,
      weakestPillar,
      work: sum((e) => e.workHours),
      social: sum((e) => e.socialHours),
      steps: sum((e) => e.steps),
      exercise: sum((e) => e.exerciseMin),
    };
  });
  const awards: Award[] = [];
  const best = <T,>(list: T[], score: (row: T) => number, tiebreak: (row: T) => number = () => 0): T | null =>
    list.reduce<T | null>((top, row) => (top === null || score(row) > score(top) || (score(row) === score(top) && tiebreak(row) > tiebreak(top)) ? row : top), null);

  const mvp = best(rows.filter((r) => r.now.shared > 0 && r.now.total > 0), (r) => r.now.total);
  if (mvp) awards.push({ key: "mvp", title: "MVP", memberId: mvp.m.id, detail: `${pts(mvp.now.total)} for the week` });

  const improved = best(
    rows.filter((r) => r.now.shared > 0 && r.before.shared > 0 && r.now.total > r.before.total),
    (r) => r.now.total - r.before.total,
  );
  if (improved)
    awards.push({ key: "improved", title: "Most improved", memberId: improved.m.id, detail: `up ${pts(improved.now.total - improved.before.total)} on last week` });

  const balanced = best(
    rows.filter((r) => r.balancedDays > 0),
    (r) => r.balancedDays,
    (r) => r.weakestPillar,
  );
  if (balanced)
    awards.push({
      key: "balanced",
      title: "Most balanced",
      memberId: balanced.m.id,
      detail: `${balanced.balancedDays} ${balanced.balancedDays === 1 ? "day" : "days"} with all three pillars`,
    });

  const hours = (n: number) => `${round1(n)} ${round1(n) === 1 ? "hr" : "hrs"}`;

  // Physical king is about time spent exercising, not points.
  const physicalKing = best(rows.filter((r) => r.exercise > 0), (r) => r.exercise);
  if (physicalKing) awards.push({ key: "physical", title: "Physical king", memberId: physicalKing.m.id, detail: `${hours(physicalKing.exercise / 60)} exercised` });

  for (const [key, title] of [
    ["mental", "Mental king"],
    ["spiritual", "Spiritual king"],
  ] as const) {
    const king = best(rows.filter((r) => r.now[key] > 0), (r) => r.now[key]);
    if (king) awards.push({ key, title, memberId: king.m.id, detail: pts(king.now[key]) });
  }

  const grinder = best(rows.filter((r) => r.work > 0), (r) => r.work);
  if (grinder) awards.push({ key: "grinder", title: "The Grinder", memberId: grinder.m.id, detail: `${hours(grinder.work)} worked` });

  const miles = best(rows.filter((r) => r.steps > 0), (r) => r.steps);
  if (miles) awards.push({ key: "steps", title: "Mileage Machine", memberId: miles.m.id, detail: `${miles.steps.toLocaleString("en-US")} steps` });

  const sweat = best(rows.filter((r) => r.exercise > 0), (r) => r.exercise);
  if (sweat) awards.push({ key: "exercise", title: "Sweat Equity", memberId: sweat.m.id, detail: `${hours(sweat.exercise / 60)} of exercise` });

  const active = rows.filter((r) => r.now.shared > 0);
  const clean = best(active, (r) => r.now.penalties, (r) => r.now.total);
  if (clean && active.length > 1 && active.some((r) => r.now.penalties !== clean.now.penalties))
    awards.push({
      key: "clean",
      title: "Halo Award",
      memberId: clean.m.id,
      detail: clean.now.penalties === 0 ? "no penalty points" : `only ${pts(-clean.now.penalties)} in penalties`,
    });

  const eater = best(rows.filter((r) => r.now.categories.meals > 0), (r) => r.now.categories.meals);
  if (eater) awards.push({ key: "eater", title: "Golden Fork", memberId: eater.m.id, detail: `${pts(eater.now.categories.meals)} from meals` });

  const butterfly = best(rows.filter((r) => r.social > 0), (r) => r.social);
  if (butterfly) awards.push({ key: "social", title: "Social Butterfly", memberId: butterfly.m.id, detail: `${hours(butterfly.social)} with people` });
  return awards;
}

/** Every award, in the order they appear in the league table. */
export const AWARD_KEYS: { key: string; title: string }[] = [
  { key: "mvp", title: "MVP" },
  { key: "improved", title: "Most improved" },
  { key: "balanced", title: "Most balanced" },
  { key: "physical", title: "Physical king" },
  { key: "mental", title: "Mental king" },
  { key: "spiritual", title: "Spiritual king" },
  { key: "grinder", title: "The Grinder" },
  { key: "steps", title: "Mileage Machine" },
  { key: "exercise", title: "Sweat Equity" },
  { key: "clean", title: "Halo Award" },
  { key: "eater", title: "Golden Fork" },
  { key: "social", title: "Social Butterfly" },
];

/**
 * How many of each award every member has won over the completed weeks before `before`.
 * A week's awards are settled once it ends.
 */
export function awardCounts(members: ScoredMember[], before: string): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = Object.fromEntries(members.map((m) => [m.id, {}]));
  const start = firstWeek(members);
  if (start === null) return counts;
  for (const week of weeksFrom(start, addDays(before, -7))) {
    for (const a of weeklyAwards(members, week)) {
      const mine = counts[a.memberId];
      if (mine) mine[a.key] = (mine[a.key] ?? 0) + 1;
    }
  }
  return counts;
}

/** Who leads each pillar over some days. */
export function pillarLeaders(members: ScoredMember[], days: string[]) {
  const rows = members.map((m) => ({ m, t: totalsFor(m, days) }));
  return (["physical", "mental", "spiritual"] as const).flatMap((key) => {
    const top = rows.reduce<(typeof rows)[number] | null>((t, r) => (t === null || r.t[key] > t.t[key] ? r : t), null);
    return top && top.t[key] > 0 ? [{ key, memberId: top.m.id, points: top.t[key] }] : [];
  });
}

// ---- Season-wide stats ----

export interface SeasonStats {
  bestWeek: { memberId: string; points: number; weekStart: string } | null;
  bestDay: { memberId: string; points: number; day: string } | null;
  topAverage: { memberId: string; average: number; days: number } | null;
  longestStreak: { memberId: string; days: number } | null;
  mostConsistent: { memberId: string; days: number } | null;
  totalPoints: number;
  totalSteps: number;
}

/** Longest run of back-to-back shared days. */
function longestRun(days: string[]): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    run = i > 0 && diffDays(day, sorted[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function seasonStats(members: ScoredMember[]): SeasonStats {
  const stats: SeasonStats = { bestWeek: null, bestDay: null, topAverage: null, longestStreak: null, mostConsistent: null, totalPoints: 0, totalSteps: 0 };
  for (const m of members) {
    const days = Object.keys(m.scores);
    const byWeek = new Map<string, number>();
    let total = 0;
    for (const day of days) {
      const points = m.scores[day].total;
      total += points;
      stats.totalSteps += m.entries[day].steps;
      byWeek.set(weekOf(day), (byWeek.get(weekOf(day)) ?? 0) + points);
      if (!stats.bestDay || points > stats.bestDay.points) stats.bestDay = { memberId: m.id, points, day };
    }
    stats.totalPoints += total;
    for (const [weekStart, points] of byWeek) {
      if (!stats.bestWeek || points > stats.bestWeek.points) stats.bestWeek = { memberId: m.id, points, weekStart };
    }
    if (days.length >= 3) {
      const average = total / days.length;
      if (!stats.topAverage || average > stats.topAverage.average) stats.topAverage = { memberId: m.id, average, days: days.length };
    }
    const run = longestRun(days);
    if (run > 0 && (!stats.longestStreak || run > stats.longestStreak.days)) stats.longestStreak = { memberId: m.id, days: run };
    if (days.length > 0 && (!stats.mostConsistent || days.length > stats.mostConsistent.days)) stats.mostConsistent = { memberId: m.id, days: days.length };
  }
  stats.totalPoints = Math.round(stats.totalPoints * 10) / 10;
  return stats;
}

// ---- Team challenges ----

export const CHALLENGE_METRICS = [
  { id: "steps", label: "Steps", unit: "steps", suggested: 500000 },
  { id: "exerciseMin", label: "Exercise", unit: "hours", suggested: 10 },
  { id: "meditationMin", label: "Meditation", unit: "hours", suggested: 5 },
  { id: "readingMin", label: "Reading", unit: "hours", suggested: 5 },
  { id: "worshipMin", label: "Worship and prayer", unit: "hours", suggested: 5 },
  { id: "serviceHours", label: "Service", unit: "hours", suggested: 10 },
  { id: "points", label: "Points", unit: "points", suggested: 500 },
] as const;

/** Time goals are saved in minutes but shown and typed in hours. */
const MINUTE_METRICS: string[] = ["exerciseMin", "meditationMin", "readingMin", "worshipMin"];
export const toDisplay = (metric: string, value: number) => (MINUTE_METRICS.includes(metric) ? Math.round((value / 60) * 10) / 10 : value);
export const toStored = (metric: string, value: number) => (MINUTE_METRICS.includes(metric) ? Math.round(value * 60) : value);

export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number]["id"];

export interface Challenge {
  id: string;
  metric: ChallengeMetric;
  target: number;
  week_start: string;
}

export function metricInfo(metric: string) {
  return CHALLENGE_METRICS.find((m) => m.id === metric) ?? CHALLENGE_METRICS[0];
}

export function challengeTitle(c: Challenge) {
  const info = metricInfo(c.metric);
  return `${toDisplay(c.metric, c.target).toLocaleString("en-US")} ${info.unit === "points" ? "points" : info.label.toLowerCase() === "steps" ? "steps" : `${info.unit} of ${info.label.toLowerCase()}`} together`;
}

export function challengeProgress(c: Challenge, members: ScoredMember[]) {
  const days = weekDays(c.week_start);
  const byMember = members.map((m) => {
    let value = 0;
    for (const d of days) {
      if (!m.entries[d]) continue;
      value += c.metric === "points" ? m.scores[d].total : (m.entries[d][c.metric] as number);
    }
    return { member: m, value: Math.round(value * 100) / 100 };
  });
  const total = byMember.reduce((sum, r) => sum + r.value, 0);
  return { total, byMember: byMember.filter((r) => r.value > 0).sort((a, b) => b.value - a.value), done: total >= c.target };
}

// ---- Activity feed ----

/** A message a member posted to the league feed. */
export interface Post {
  id: string;
  league_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

/** An emoji on a feed item, identified by the item's key. */
export interface FeedReaction {
  id?: string;
  league_id: string;
  item_key: string;
  reactor_id: string;
  emoji: string;
}

export interface Reaction {
  id?: string;
  league_id: string;
  target_user_id: string;
  day: string;
  reactor_id: string;
  emoji: string;
  created_at?: string;
}

export interface FeedItem {
  key: string;
  /** When it happened (ISO time), used to sort newest first. */
  at: string;
  /** False when only the day is known, so no clock time is shown. */
  exact: boolean;
  text: string;
  /** Set for messages members wrote, so the feed can show them as posts. */
  post?: { id: string; authorId: string; name: string; body: string; mine: boolean; avatarUrl?: string | null };
}

/** A friendly time for the feed: "12 min ago", "Today, 8:05 PM", "Tue, 8:05 PM" or "Oct 12, 8:05 PM". */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins >= 0 && mins < 1) return "Just now";
  if (mins >= 0 && mins < 60) return `${mins} min ago`;
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** Highlights from the last two weeks of shared days, plus member posts and joins. Reactions are not part of the feed. */
export function feedItems(
  members: ScoredMember[],
  posts: Post[],
  joins: { userId: string; joinedAt: string }[],
  today: string,
): FeedItem[] {
  const nameOf = (id: string) => members.find((m) => m.id === id);
  const label = (id: string) => (nameOf(id)?.you ? "You" : (nameOf(id)?.name ?? "Someone"));
  const verb = (id: string, you: string, other: string) => (nameOf(id)?.you ? you : other);
  const oldest = addDays(today, -14);
  const items: FeedItem[] = [];

  for (const m of members) {
    for (const [day, entry] of Object.entries(m.entries)) {
      if (day < oldest || day > today) continue;
      const total = m.scores[day].total;
      const found: string[] = [];
      if (total >= 30) found.push(`had a ${round1(total)}-point day`);
      if (entry.steps >= 10000) found.push(`walked ${entry.steps.toLocaleString("en-US")} steps`);
      if (entry.exerciseMin >= 60) found.push(`exercised for ${entry.exerciseMin} min${entry.exerciseNote ? `: ${entry.exerciseNote}` : ""}`);
      if (entry.readingMin >= 60) found.push(`read for ${entry.readingMin} min`);
      if (entry.meditationMin >= 30) found.push(`meditated for ${entry.meditationMin} min`);
      for (const what of found.slice(0, 2)) {
        const saved = m.updatedAt?.[day];
        items.push({
          key: `${m.id}-${day}-${what}`,
          at: saved ?? `${day}T12:00:00`,
          exact: Boolean(saved),
          text: `${label(m.id)} ${what} (${day === today ? "today" : dayLong(day)})`,
        });
      }
    }
  }

  for (const p of posts) {
    if (p.created_at.slice(0, 10) < oldest) continue;
    const author = nameOf(p.user_id);
    items.push({
      key: `p-${p.id}`,
      at: p.created_at,
      exact: true,
      text: `${label(p.user_id)}: ${p.body}`,
      post: { id: p.id, authorId: p.user_id, name: label(p.user_id), body: p.body, mine: Boolean(author?.you), avatarUrl: author?.avatarUrl },
    });
  }

  for (const j of joins) {
    if (j.joinedAt.slice(0, 10) < oldest) continue;
    items.push({ key: `j-${j.userId}`, at: j.joinedAt, exact: true, text: `${label(j.userId)} ${verb(j.userId, "joined", "joined")} the league` });
  }

  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
