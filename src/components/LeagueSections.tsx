"use client";

import { useState } from "react";
import { GROUP_COLORS, tint } from "@/lib/colors";
import { dayLong, dayOfMonth, dayShortWeekday, periodLabel } from "@/lib/dates";
import {
  challengeProgress,
  challengeTitle,
  matchupRecords,
  metricInfo,
  pillarLeaders,
  totalsFor,
  weekDays,
  weekMatchups,
  weekOf,
  weeklyAwards,
  type Challenge,
  type FeedItem,
  type Reaction,
  type ScoredMember,
} from "@/lib/league";
import { fmt } from "./DailyLog";
import { StackedChart, segmentsOf, type ChartBar } from "./StackedChart";

export type Mode = "day" | "week" | "season";

const EMOJIS = ["🔥", "👏", "💪", "🙌", "😮"];
const round1 = (n: number) => Math.round(n * 10) / 10;
const ordinal = (n: number) => ["1st", "2nd", "3rd"][n - 1] ?? `${n}th`;

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

interface StandingsProps {
  members: ScoredMember[];
  reactions: Reaction[];
  today: string;
  weekStart: string;
  mode: Mode;
  onMode: (mode: Mode) => void;
  dayIdx: number;
  onDay: (index: number) => void;
  onReact: (targetId: string, day: string, emoji: string) => void;
  userId: string;
  loaded: boolean;
}

export function StandingsSection({ members, reactions, today, weekStart, mode, onMode, dayIdx, onDay, onReact, userId, loaded }: StandingsProps) {
  const [tray, setTray] = useState<string | null>(null);
  const days = weekDays(weekStart);
  const day = days[dayIdx];

  const picked =
    mode === "week" ? days : mode === "day" ? [day] : Array.from(new Set(members.flatMap((m) => Object.keys(m.scores)))).sort();
  const rows = members
    .map((m) => ({ m, t: totalsFor(m, picked) }))
    .sort((a, b) => b.t.total - a.t.total || Number(b.m.you) - Number(a.m.you));
  const leader = Math.max(1, rows[0].t.total);
  const youIndex = rows.findIndex((r) => r.m.you);
  const anyone = rows.some((r) => r.t.shared > 0);
  const others = members.length - 1;
  const when = mode === "season" ? "overall" : mode === "week" ? (weekStart === weekOf(today) ? "this week" : "that week") : day === today ? "today" : `on ${dayLong(day)}`;

  let summary: string;
  if (others === 0) summary = loaded ? "You're the only member so far. Use Invite friends above to bring in friends." : "Loading standings...";
  else if (!anyone) summary = `Nobody has shared a day with this league ${when} yet.`;
  else if (youIndex === 0) summary = `You're in 1st place ${when}, ${fmt(round1(rows[0].t.total - rows[1].t.total))} points ahead of ${rows[1].m.name}.`;
  else summary = `You're in ${ordinal(youIndex + 1)} place ${when}, ${fmt(round1(rows[youIndex - 1].t.total - rows[youIndex].t.total))} points behind ${rows[youIndex - 1].m.name}.`;

  const bars: ChartBar[] = rows.map(({ m, t }) => ({
    key: m.id,
    label: m.you ? "You" : m.name.split(" ")[0].slice(0, 7),
    title: m.name,
    sub: mode === "day" ? dayLong(day) : `${mode === "season" ? "Season" : "Week"}: ${t.shared} ${t.shared === 1 ? "day" : "days"} shared`,
    segments: segmentsOf(t),
    hasData: t.shared > 0,
    marked: m.you,
  }));

  const leaders = pillarLeaders(members, picked);
  const awards = mode === "week" ? weeklyAwards(members, weekStart) : [];
  const dayReactions = (targetId: string) => reactions.filter((r) => r.target_user_id === targetId && r.day === day);

  return (
    <>
      <div className="seg" role="group" aria-label="Time range">
        {(["day", "week", "season"] as Mode[]).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>
            {m === "day" ? "Day" : m === "week" ? "Week" : "Season"}
          </button>
        ))}
      </div>

      {mode === "day" && (
        <div className="day-picker" role="group" aria-label="Choose a day this week">
          {days.map((d, i) => {
            const hasData = members.some((m) => m.scores[d]);
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

      <div className="callout">{summary}</div>

      <StackedChart
        bars={bars}
        emptyText="Nothing shared"
        ariaLabel={`Points by member ${mode === "season" ? "for the season" : mode === "week" ? "for the week" : `for ${dayLong(day)}`}, split by category`}
      />

      {mode !== "week" && leaders.length > 0 && (
        <div className="leaders" aria-label="Pillar leaders">
          {leaders.map((l) => (
            <div className="leader" key={l.key} style={{ background: tint(GROUP_COLORS[l.key]), color: GROUP_COLORS[l.key] }}>
              <span>{l.key[0].toUpperCase() + l.key.slice(1)}</span>
              <strong>{nameOf(members, l.memberId)}</strong>
              <span>{fmt(round1(l.points))}</span>
            </div>
          ))}
        </div>
      )}

      {mode === "week" && (
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
                  <strong>{nameOf(members, a.memberId)}</strong>
                  <span className="award-detail">{a.detail}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="standings-list">
        {rows.map(({ m, t }, index) => {
          const mine = dayReactions(m.id);
          const grouped = EMOJIS.map((emoji) => ({
            emoji,
            count: mine.filter((r) => r.emoji === emoji).length,
            byYou: mine.some((r) => r.emoji === emoji && r.reactor_id === userId),
          })).filter((g) => g.count > 0);
          const canReact = mode === "day" && !m.you && t.shared > 0;
          return (
            <div className={`player ${m.you ? "you" : ""}`} key={m.id}>
              <span className="rank">{index + 1}</span>
              <span className="avatar">{m.name.charAt(0).toUpperCase()}</span>
              <div className="player-body">
                <div className="player-name">
                  {m.name}
                  {m.you && <span className="you-tag">You</span>}
                </div>
                <div className="bar">
                  <div style={{ width: `${Math.max(4, Math.min(100, (t.total / leader) * 100))}%` }} />
                </div>
                {mode === "day" && (grouped.length > 0 || canReact) && (
                  <div className="react-row">
                    {grouped.map((g) => (
                      <button
                        key={g.emoji}
                        className="emoji-chip"
                        aria-pressed={g.byYou}
                        disabled={m.you}
                        aria-label={`${g.emoji} ${g.count}${g.byYou ? ", including you" : ""}`}
                        onClick={() => onReact(m.id, day, g.emoji)}
                      >
                        {g.emoji} {g.count}
                      </button>
                    ))}
                    {canReact && (
                      <button className="emoji-chip add" aria-expanded={tray === m.id} aria-label={`React to ${m.name}'s day`} onClick={() => setTray(tray === m.id ? null : m.id)}>
                        +
                      </button>
                    )}
                    {canReact && tray === m.id &&
                      EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          className="emoji-chip pick"
                          aria-label={`Send ${emoji} to ${m.name}`}
                          onClick={() => {
                            onReact(m.id, day, emoji);
                            setTray(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <span className="player-pts">{fmt(round1(t.total))}</span>
            </div>
          );
        })}
      </div>

      <p className="demo-note">
        Standings only count days shared with this league, scored with this league&apos;s rules. The streak bonus
        isn&apos;t included yet.
      </p>
    </>
  );
}

export function MatchupsSection({ members, weekStart, today }: { members: ScoredMember[]; weekStart: string; today: string }) {
  const currentWeek = weekOf(today);
  const live = weekStart >= currentWeek;
  const matchups = weekMatchups(members, weekStart).sort((x, y) => Number(y.a.you || !!y.b?.you) - Number(x.a.you || !!x.b?.you));
  const records = matchupRecords(members, currentWeek);
  const table = [...members].sort((a, b) => records[b.id].wins - records[a.id].wins || records[a.id].losses - records[b.id].losses);

  if (members.length < 2) return <p className="callout">Matchups start when a second person joins the league.</p>;

  return (
    <>
      <section aria-label="Matchups">
        <div className="group-head">
          <span className="name">{live ? "This week's matchups" : "Matchups"}</span>
        </div>
        {matchups.map((m) => {
          const aLead = m.aPoints > m.bPoints;
          const tie = m.aPoints === m.bPoints;
          return (
            <div className="match-card" key={m.a.id}>
              {m.b ? (
                <>
                  <div className={`side ${!live && aLead ? "win" : ""}`}>
                    <span className="side-name">{m.a.name}</span>
                    <strong>{fmt(round1(m.aPoints))}</strong>
                  </div>
                  <span className="vs">vs</span>
                  <div className={`side ${!live && !aLead && !tie ? "win" : ""}`}>
                    <span className="side-name">{m.b.name}</span>
                    <strong>{fmt(round1(m.bPoints))}</strong>
                  </div>
                  <div className="match-status">
                    {live ? (tie ? "Tied so far" : `${aLead ? m.a.name : m.b.name} leads by ${fmt(round1(Math.abs(m.aPoints - m.bPoints)))}`) : tie ? "Tie" : `${aLead ? m.a.name : m.b.name} won`}
                  </div>
                </>
              ) : (
                <div className="match-bye">{m.a.name} has a rest week</div>
              )}
            </div>
          );
        })}
        <p className="demo-note">Everyone plays everyone once, then the cycle repeats. Points come from days shared with this league.</p>
      </section>

      <section aria-label="Records">
        <div className="group-head">
          <span className="name">Season record</span>
          <span className="sum">completed weeks</span>
        </div>
        <div className="breakdown">
          {table.map((m) => (
            <div className="bd-row record" key={m.id}>
              <span className="bd-label">
                {m.name}
              </span>
              <span />
              <span className="bd-value">
                {records[m.id].wins}-{records[m.id].losses}
                {records[m.id].ties > 0 ? `-${records[m.id].ties}` : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
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
  return (
    <>
      <ul className="feed">
        {shown.map((item) => (
          <li key={item.key}>{item.text}</li>
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
