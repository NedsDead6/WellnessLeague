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
  /** Days this person shared with the league, by day. */
  entries: Record<string, DayEntry>;
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
}

/** Win-loss-tie record for every member over the completed weeks before `before`. */
export function matchupRecords(members: ScoredMember[], before: string): Record<string, Record3> {
  const records: Record<string, Record3> = Object.fromEntries(members.map((m) => [m.id, { wins: 0, losses: 0, ties: 0 }]));
  const start = firstWeek(members);
  if (start === null) return records;
  for (const week of weeksFrom(start, addDays(before, -7))) {
    for (const m of weekMatchups(members, week)) {
      if (!m.b) continue;
      // A week where neither person shared anything isn't a result.
      if (totalsFor(m.a, weekDays(week)).shared + totalsFor(m.b, weekDays(week)).shared === 0) continue;
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
    return { m, now, before, balancedDays, weakestPillar };
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

  for (const [key, title] of [
    ["physical", "Physical king"],
    ["mental", "Mental king"],
    ["spiritual", "Spiritual king"],
  ] as const) {
    const king = best(rows.filter((r) => r.now[key] > 0), (r) => r.now[key]);
    if (king) awards.push({ key, title, memberId: king.m.id, detail: pts(king.now[key]) });
  }
  return awards;
}

/** Who leads each pillar over some days. */
export function pillarLeaders(members: ScoredMember[], days: string[]) {
  const rows = members.map((m) => ({ m, t: totalsFor(m, days) }));
  return (["physical", "mental", "spiritual"] as const).flatMap((key) => {
    const top = rows.reduce<(typeof rows)[number] | null>((t, r) => (t === null || r.t[key] > t.t[key] ? r : t), null);
    return top && top.t[key] > 0 ? [{ key, memberId: top.m.id, points: top.t[key] }] : [];
  });
}

// ---- Team challenges ----

export const CHALLENGE_METRICS = [
  { id: "steps", label: "Steps", unit: "steps", suggested: 500000 },
  { id: "exerciseMin", label: "Exercise", unit: "min", suggested: 600 },
  { id: "meditationMin", label: "Meditation", unit: "min", suggested: 300 },
  { id: "readingMin", label: "Reading", unit: "min", suggested: 300 },
  { id: "worshipMin", label: "Worship and prayer", unit: "min", suggested: 300 },
  { id: "serviceHours", label: "Service", unit: "hours", suggested: 10 },
  { id: "points", label: "Points", unit: "points", suggested: 500 },
] as const;

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
  return `${c.target.toLocaleString("en-US")} ${info.unit === "points" ? "points" : info.label.toLowerCase() === "steps" ? "steps" : `${info.unit} of ${info.label.toLowerCase()}`} together`;
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
  /** ISO-ish string used only to sort newest first. */
  when: string;
  text: string;
}

/** Highlights from the last two weeks of shared days, plus reactions and joins. */
export function feedItems(
  members: ScoredMember[],
  reactions: Reaction[],
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
      if (entry.exerciseMin >= 60) found.push(`exercised for ${entry.exerciseMin} min`);
      if (entry.readingMin >= 60) found.push(`read for ${entry.readingMin} min`);
      if (entry.meditationMin >= 30) found.push(`meditated for ${entry.meditationMin} min`);
      for (const what of found.slice(0, 2)) {
        items.push({ key: `${m.id}-${day}-${what}`, when: `${day}T12`, text: `${label(m.id)} ${what} (${day === today ? "today" : dayLong(day)})` });
      }
    }
  }

  for (const r of reactions) {
    if (r.day < oldest) continue;
    items.push({
      key: `r-${r.reactor_id}-${r.target_user_id}-${r.day}-${r.emoji}`,
      when: r.created_at ?? `${r.day}T13`,
      text: `${label(r.reactor_id)} ${r.emoji} ${r.target_user_id === r.reactor_id ? verb(r.reactor_id, "your own", "their own") : `${label(r.target_user_id)}${nameOf(r.target_user_id)?.you ? "r" : "'s"}`} ${dayLong(r.day).split(",")[0]}`,
    });
  }

  for (const j of joins) {
    if (j.joinedAt.slice(0, 10) < oldest) continue;
    items.push({ key: `j-${j.userId}`, when: j.joinedAt, text: `${label(j.userId)} ${verb(j.userId, "joined", "joined")} the league` });
  }

  return items.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
}
