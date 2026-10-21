"use client";

import { useState } from "react";
import { GROUP_COLORS } from "@/lib/colors";
import { dayLong, dayOfMonth, dayShortWeekday, periodLabel } from "@/lib/dates";
import {
  challengeProgress,
  challengeTitle,
  formatWhen,
  matchupRecords,
  metricInfo,
  seasonStats,
  totalsFor,
  weekDays,
  weekMatchups,
  weekOf,
  weeklyAwards,
  type Challenge,
  type FeedItem,
  type MemberTotals,
  type Reaction,
  type ScoredMember,
} from "@/lib/league";
import { CATEGORIES, type CategoryKey } from "@/lib/scoring";
import { fmt } from "./DailyLog";
import { StackedChart, segmentsOf, type ChartBar } from "./StackedChart";

export type Mode = "day" | "week";

const EMOJIS = ["🔥", "👏", "💪", "🙌", "😮"];
const round1 = (n: number) => Math.round(n * 10) / 10;

function nameOf(members: ScoredMember[], id: string) {
  return members.find((m) => m.id === id)?.name ?? "Someone";
}

export function WeekNav({
  weekStart,
  isCurrent,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  weekStart: string;
  isCurrent: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const arrow = (d: string) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  return (
    <div className="period-nav">
      <button className="square" aria-label="Previous week" disabled={!canPrev} onClick={onPrev}>
        {arrow("M15 5l-7 7 7 7")}
      </button>
      <div className="period-label" aria-live="polite">
        {periodLabel(weekStart, "week")}
        {isCurrent && <span className="period-now">This week</span>}
      </div>
      <button className="square" aria-label="Next week" disabled={!canNext} onClick={onNext}>
        {arrow("M9 5l7 7-7 7")}
      </button>
    </div>
  );
}

// Short names so the head-to-head table fits two columns on a phone.
const SHORT: Record<CategoryKey, string> = {
  exercise: "Exercise",
  steps: "Steps",
  meals: "Meals",
  sleep: "Sleep",
  water: "Water",
  meditation: "Meditation",
  work: "Work",
  social: "Social",
  reading: "Reading",
  journal: "Journaling",
  worship: "Worship",
  service: "Service",
  screen: "Screen time",
  drinks: "Drinks",
  weed: "Weed",
  cigarettes: "Cigarettes",
};

const sign = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "-"}${fmt(round1(Math.abs(n)))}`);

// ---------------------------------------------------------------- Standings

export function StandingsSection({
  members,
  today,
  weekStart,
  onOpenMatchup,
}: {
  members: ScoredMember[];
  today: string;
  weekStart: string;
  onOpenMatchup: (aId: string) => void;
}) {
  const currentWeek = weekOf(today);
  const records = matchupRecords(members, currentWeek);
  const table = [...members].sort(
    (a, b) =>
      records[b.id].wins - records[a.id].wins ||
      records[a.id].losses - records[b.id].losses ||
      records[b.id].pointsFor - records[a.id].pointsFor,
  );
  const played = table.some((m) => records[m.id].wins + records[m.id].losses + records[m.id].ties > 0);
  const live = weekStart >= currentWeek;
  const matchups = weekMatchups(members, weekStart).sort((x, y) => Number(y.a.you || !!y.b?.you) - Number(x.a.you || !!x.b?.you));
  const awards = weeklyAwards(members, weekStart);
  const stats = seasonStats(members);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone";

  const seasonDays = Array.from(new Set(members.flatMap((m) => Object.keys(m.scores)))).sort();
  const seasonRows = members
    .map((m) => ({ m, t: totalsFor(m, seasonDays) }))
    .sort((a, b) => b.t.total - a.t.total);
  const bars: ChartBar[] = seasonRows.map(({ m, t }) => ({
    key: m.id,
    label: m.you ? "You" : m.name.split(" ")[0].slice(0, 7),
    title: m.name,
    sub: `Season: ${t.shared} ${t.shared === 1 ? "day" : "days"} shared`,
    segments: segmentsOf(t),
    hasData: t.shared > 0,
    marked: m.you,
  }));

  return (
    <>
      <section aria-label="League table">
        <div className="group-head">
          <span className="name">League table</span>
          <span className="sum">completed weeks</span>
        </div>
        <div className="table">
          <div className="table-row head">
            <span />
            <span>Team</span>
            <span>W-L</span>
            <span>PF</span>
            <span>PA</span>
          </div>
          {table.map((m, i) => {
            const r = records[m.id];
            return (
              <div className={`table-row ${m.you ? "you" : ""}`} key={m.id}>
                <span className="rank">{i + 1}</span>
                <span className="table-name">{m.name}</span>
                <span className="table-rec">
                  {r.wins}-{r.losses}
                  {r.ties > 0 ? `-${r.ties}` : ""}
                </span>
                <span>{fmt(round1(r.pointsFor))}</span>
                <span>{fmt(round1(r.pointsAgainst))}</span>
              </div>
            );
          })}
        </div>
        <p className="demo-note">
          {played
            ? "Ranked by wins, then points for (PF). PA is points against."
            : "Records start once the first full week has been played. PF is points for, PA is points against."}
        </p>
      </section>

      <section aria-label="Matchup scores">
        <div className="group-head">
          <span className="name">{live ? "This week's matchups" : "Matchups that week"}</span>
        </div>
        {matchups.length === 0 ? (
          <p className="callout">Matchups start when a second person joins the league.</p>
        ) : (
          matchups.map((m) => {
            const aLead = m.aPoints > m.bPoints;
            const tie = m.aPoints === m.bPoints;
            return m.b ? (
              <button className="score-row" key={m.a.id} onClick={() => onOpenMatchup(m.a.id)} aria-label={`Open ${m.a.name} versus ${m.b.name}`}>
                <span className={`score-name ${aLead ? "lead" : ""}`}>{m.a.name}</span>
                <strong className={aLead ? "lead" : ""}>{fmt(round1(m.aPoints))}</strong>
                <span className="score-sep">{live ? "live" : "final"}</span>
                <strong className={!aLead && !tie ? "lead" : ""}>{fmt(round1(m.bPoints))}</strong>
                <span className={`score-name right ${!aLead && !tie ? "lead" : ""}`}>{m.b.name}</span>
              </button>
            ) : (
              <div className="score-row bye" key={m.a.id}>
                <span className="score-name">{m.a.name}</span>
                <span className="score-sep wide">rest week</span>
              </div>
            );
          })
        )}
      </section>

      <section aria-label="Weekly recap">
        <div className="group-head">
          <span className="name">Weekly recap</span>
        </div>
        {awards.length === 0 ? (
          <p className="callout">No awards yet. They appear once members share days this week.</p>
        ) : (
          <div className="awards">
            {awards.map((a) => (
              <div className="award" key={a.key}>
                <span className="award-title">{a.title}</span>
                <strong>{nameOf(a.memberId)}</strong>
                <span className="award-detail">{a.detail}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Season stats">
        <div className="group-head">
          <span className="name">Season stats</span>
          <span className="sum">since the league started</span>
        </div>
        <div className="season-grid">
          <SeasonCard label="Best week" who={stats.bestWeek && nameOf(stats.bestWeek.memberId)} detail={stats.bestWeek && `${fmt(round1(stats.bestWeek.points))} pts, ${periodLabel(stats.bestWeek.weekStart, "week")}`} />
          <SeasonCard label="Best day" who={stats.bestDay && nameOf(stats.bestDay.memberId)} detail={stats.bestDay && `${fmt(round1(stats.bestDay.points))} pts, ${dayLong(stats.bestDay.day).split(",")[1]?.trim() ?? ""}`} />
          <SeasonCard label="Top daily average" who={stats.topAverage && nameOf(stats.topAverage.memberId)} detail={stats.topAverage && `${fmt(round1(stats.topAverage.average))} pts over ${stats.topAverage.days} days`} />
          <SeasonCard label="Longest streak" who={stats.longestStreak && nameOf(stats.longestStreak.memberId)} detail={stats.longestStreak && `${stats.longestStreak.days} ${stats.longestStreak.days === 1 ? "day" : "days"} in a row`} />
          <SeasonCard label="Most days shared" who={stats.mostConsistent && nameOf(stats.mostConsistent.memberId)} detail={stats.mostConsistent && `${stats.mostConsistent.days} days`} />
          <SeasonCard label="League totals" who={stats.totalPoints > 0 ? `${Math.round(stats.totalPoints).toLocaleString("en-US")} pts` : null} detail={stats.totalSteps > 0 ? `${stats.totalSteps.toLocaleString("en-US")} steps walked` : null} />
        </div>
        <div className="group-head sub">
          <span className="name">Season points by member</span>
        </div>
        <StackedChart bars={bars} emptyText="Nothing shared" ariaLabel="Season points by member, split by category" />
      </section>
    </>
  );
}

function SeasonCard({ label, who, detail }: { label: string; who: string | null | undefined; detail: string | null | undefined }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value small">{who || "-"}</div>
      <div className="stat-delta flat">{detail || "Not enough data yet"}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Matchups

function ReactionBar({
  targetId,
  name,
  day,
  reactions,
  userId,
  onReact,
}: {
  targetId: string;
  name: string;
  day: string;
  reactions: Reaction[];
  userId: string;
  onReact: (targetId: string, day: string, emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const mine = targetId === userId;
  const here = reactions.filter((r) => r.target_user_id === targetId && r.day === day);
  const grouped = EMOJIS.map((emoji) => ({
    emoji,
    count: here.filter((r) => r.emoji === emoji).length,
    byYou: here.some((r) => r.emoji === emoji && r.reactor_id === userId),
  })).filter((g) => g.count > 0);
  if (mine && grouped.length === 0) return null;
  return (
    <div className="react-row">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          className="emoji-chip"
          aria-pressed={g.byYou}
          disabled={mine}
          aria-label={`${g.emoji} ${g.count}${g.byYou ? ", including you" : ""}`}
          onClick={() => onReact(targetId, day, g.emoji)}
        >
          {g.emoji} {g.count}
        </button>
      ))}
      {!mine && (
        <button className="emoji-chip add" aria-expanded={open} aria-label={`React to ${name}'s day`} onClick={() => setOpen(!open)}>
          +
        </button>
      )}
      {!mine &&
        open &&
        EMOJIS.map((emoji) => (
          <button
            key={emoji}
            className="emoji-chip pick"
            aria-label={`Send ${emoji} to ${name}`}
            onClick={() => {
              onReact(targetId, day, emoji);
              setOpen(false);
            }}
          >
            {emoji}
          </button>
        ))}
    </div>
  );
}

interface MatchupsProps {
  members: ScoredMember[];
  reactions: Reaction[];
  today: string;
  weekStart: string;
  mode: Mode;
  onMode: (mode: Mode) => void;
  dayIdx: number;
  onDay: (index: number) => void;
  pairId: string | null;
  onPair: (aId: string) => void;
  onReact: (targetId: string, day: string, emoji: string) => void;
  userId: string;
}

export function MatchupsSection({ members, reactions, today, weekStart, mode, onMode, dayIdx, onDay, pairId, onPair, onReact, userId }: MatchupsProps) {
  if (members.length < 2) return <p className="callout">Matchups start when a second person joins the league.</p>;

  const days = weekDays(weekStart);
  const day = days[dayIdx];
  const picked = mode === "week" ? days : [day];
  const currentWeek = weekOf(today);
  const records = matchupRecords(members, currentWeek);
  const matchups = weekMatchups(members, weekStart).sort((x, y) => Number(y.a.you || !!y.b?.you) - Number(x.a.you || !!x.b?.you));
  const sel = matchups.find((m) => m.a.id === pairId) ?? matchups[0];
  const first = (name: string) => name.split(" ")[0];

  const left = sel.a;
  const right = sel.b;
  const lt = totalsFor(left, picked);
  const rt = right ? totalsFor(right, picked) : null;
  const recordText = (id: string) => {
    const r = records[id];
    return `${r.wins}-${r.losses}${r.ties > 0 ? `-${r.ties}` : ""}`;
  };

  return (
    <>
      <div className="seg" role="group" aria-label="Matchup view">
        <button aria-pressed={mode === "day"} onClick={() => onMode("day")}>
          Day
        </button>
        <button aria-pressed={mode === "week"} onClick={() => onMode("week")}>
          Week
        </button>
      </div>

      {mode === "day" && (
        <div className="day-picker" role="group" aria-label="Choose a day this week">
          {days.map((d, i) => {
            const hasData = Boolean(left.scores[d] || right?.scores[d]);
            return (
              <button
                key={d}
                className="day-chip"
                disabled={d > today}
                aria-pressed={i === dayIdx}
                aria-label={`${dayLong(d)}${hasData ? ", points shared" : ""}`}
                onClick={() => onDay(i)}
              >
                <span className="dow">{d === today ? "Today" : dayShortWeekday(d)}</span>
                <strong>{dayOfMonth(d)}</strong>
                <span className={`mark ${hasData ? "on" : ""}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {matchups.length > 1 && (
        <div className="league-tabs" role="group" aria-label="Matchups this week">
          {matchups.map((m) => (
            <button key={m.a.id} aria-pressed={m.a.id === sel.a.id} onClick={() => onPair(m.a.id)}>
              {first(m.a.name)} vs {m.b ? first(m.b.name) : "rest"}
            </button>
          ))}
        </div>
      )}

      {!right || !rt ? (
        <p className="callout">{left.name} has a rest week. Matchups rotate, so everyone plays everyone.</p>
      ) : (
        <>
          <div className="duel-board" aria-label="Scoreboard">
            {([
              [left, lt],
              [right, rt],
            ] as [ScoredMember, MemberTotals][]).map(([m, t], i) => {
              const other = i === 0 ? rt : lt;
              return (
                <div className={`duel-side ${t.total > other.total ? "lead" : ""}`} key={m.id}>
                  <span className="avatar">{m.name.charAt(0).toUpperCase()}</span>
                  <span className="duel-name">{m.name}</span>
                  <span className="duel-rec">Record {recordText(m.id)}</span>
                  <strong className="duel-score">{fmt(round1(t.total))}</strong>
                  <span className="duel-days">
                    {t.shared} {t.shared === 1 ? "day" : "days"} shared
                  </span>
                  {mode === "day" && <ReactionBar targetId={m.id} name={m.name} day={day} reactions={reactions} userId={userId} onReact={onReact} />}
                </div>
              );
            })}
          </div>

          <StackedChart
            bars={[left, right].map((m, i) => {
              const t = i === 0 ? lt : rt;
              return {
                key: m.id,
                label: m.name.split(" ")[0].slice(0, 9),
                title: m.name,
                sub: mode === "day" ? dayLong(day) : `${periodLabel(weekStart, "week")}, ${t.shared} ${t.shared === 1 ? "day" : "days"} shared`,
                segments: segmentsOf(t),
                hasData: t.shared > 0,
                marked: m.you,
              };
            })}
            emptyText="Nothing shared"
            ariaLabel={`${left.name} versus ${right.name}, points by category`}
          />

          <section aria-label="Head to head breakdown" className="duel-table">
            <div className="duel-row names">
              <span>{first(left.name)}</span>
              <span />
              <span>{first(right.name)}</span>
            </div>
            {(["physical", "mental", "spiritual", "penalty"] as const).map((group) => {
              const cats = CATEGORIES.filter((c) => c.group === group && (Math.abs(lt.categories[c.key]) > 0.0005 || Math.abs(rt.categories[c.key]) > 0.0005));
              const gl = group === "penalty" ? lt.penalties : lt[group];
              const gr = group === "penalty" ? rt.penalties : rt[group];
              if (cats.length === 0) return null;
              return (
                <div key={group}>
                  <div className="duel-row group" style={{ color: GROUP_COLORS[group] }}>
                    <span className={gl > gr ? "win" : ""}>{sign(gl)}</span>
                    <span>{group === "penalty" ? "Penalties" : group[0].toUpperCase() + group.slice(1)}</span>
                    <span className={gr > gl ? "win" : ""}>{sign(gr)}</span>
                  </div>
                  {cats.map((c) => {
                    const a = lt.categories[c.key];
                    const b = rt.categories[c.key];
                    return (
                      <div className="duel-row" key={c.key}>
                        <span className={a > b ? "win" : ""}>{sign(a)}</span>
                        <span>{SHORT[c.key]}</span>
                        <span className={b > a ? "win" : ""}>{sign(b)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {(lt.bonuses !== 0 || rt.bonuses !== 0) && (
              <div className="duel-row">
                <span className={lt.bonuses > rt.bonuses ? "win" : ""}>{sign(lt.bonuses)}</span>
                <span>Bonuses</span>
                <span className={rt.bonuses > lt.bonuses ? "win" : ""}>{sign(rt.bonuses)}</span>
              </div>
            )}
            <div className="duel-row total">
              <span className={lt.total > rt.total ? "win" : ""}>{fmt(round1(lt.total))}</span>
              <span>Total</span>
              <span className={rt.total > lt.total ? "win" : ""}>{fmt(round1(rt.total))}</span>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function GoalsSection({ challenges, members, weekStart }: { challenges: Challenge[]; members: ScoredMember[]; weekStart: string }) {
  const list = challenges.filter((c) => c.week_start === weekStart);
  if (list.length === 0) {
    return <p className="callout">No team goal for this week. The league owner can add one under League settings.</p>;
  }
  return (
    <>
      {list.map((c) => {
        const p = challengeProgress(c, members);
        const pct = Math.min(100, (p.total / c.target) * 100);
        const unit = metricInfo(c.metric).unit;
        return (
          <section className="goal-card" key={c.id} aria-label="Team goal">
            <div className="goal-head">
              <strong>{challengeTitle(c)}</strong>
              {p.done && <span className="goal-done">Done!</span>}
            </div>
            <div className="bar goal-bar" role="img" aria-label={`${Math.round(pct)} percent complete`}>
              <div style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
            <div className="goal-count">
              {Math.round(p.total).toLocaleString("en-US")} of {c.target.toLocaleString("en-US")} {unit}
            </div>
            {p.byMember.length > 0 && (
              <ul className="goal-members">
                {p.byMember.map((r) => (
                  <li key={r.member.id}>
                    <span>{r.member.name}</span>
                    <b>{Math.round(r.value).toLocaleString("en-US")}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}

export function FeedSection({ items }: { items: FeedItem[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return <p className="callout">Nothing yet. Highlights and reactions from the last two weeks show up here.</p>;
  const shown = all ? items : items.slice(0, 12);
  const now = new Date();
  return (
    <>
      <ul className="feed">
        {shown.map((item) => (
          <li key={item.key}>
            <span>{item.text}</span>
            {item.exact && (
              <time className="feed-time" dateTime={item.at}>
                {formatWhen(item.at, now)}
              </time>
            )}
          </li>
        ))}
      </ul>
      {items.length > 12 && !all && (
        <button className="text-button" onClick={() => setAll(true)}>
          Show {items.length - 12} more
        </button>
      )}
    </>
  );
}
