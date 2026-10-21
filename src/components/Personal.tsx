"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  axisLabel,
  dayLong,
  dayOfMonth,
  daysInMonth,
  diffDays,
  monthTitle,
  periodEnd,
  periodLabel,
  periodStart,
  shiftPeriod,
  weekdayIndex,
  addMonths,
  type Period,
} from "@/lib/dates";
import {
  averageOf,
  averageSeries,
  bestStreak,
  currentStreak,
  scoreHistory,
  totalsBetween,
  type EntryMap,
  type ScoredDay,
  type SeriesPoint,
  type Totals,
} from "@/lib/history";
import { BONUS_COLOR, CATEGORY_COLORS, GROUP_COLORS } from "@/lib/colors";
import { CATEGORIES, type CategoryKey, type ScoringRules } from "@/lib/scoring";
import { fmt, fmtSigned } from "./DailyLog";
import { WEEKDAY_LETTERS, formatMetric, rangeTitle, tickText } from "@/lib/trends";
import { MetricTrends } from "./MetricTrends";
import { StackedChart, segmentsOf, type ChartBar } from "./StackedChart";

// How far back the chart reaches (scroll sideways) and how wide each bar is.
const PERIODS: { id: Period; label: string; count: number; slot: number; title: string }[] = [
  { id: "day", label: "Daily", count: 120, slot: 30, title: "Points per day" },
  { id: "week", label: "Weekly", count: 52, slot: 48, title: "Weekly average" },
  { id: "month", label: "Monthly", count: 36, slot: 46, title: "Monthly average" },
  { id: "year", label: "Yearly", count: 10, slot: 66, title: "Yearly average" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function Personal({ entries, today, rules }: { entries: EntryMap; today: string; rules: ScoringRules }) {
  const history = useMemo(() => scoreHistory(entries, rules), [entries, rules]);
  const [period, setPeriod] = useState<Period>("day");

  const config = PERIODS.find((p) => p.id === period) ?? PERIODS[0];
  const currentStart = periodStart(today, period);
  const anchor = currentStart;
  const anchorEnd = periodEnd(anchor, period);
  const previous = shiftPeriod(anchor, period, -1);

  const now = useMemo(() => totalsBetween(history, anchor, anchorEnd), [history, anchor, anchorEnd]);
  const before = useMemo(
    () => totalsBetween(history, previous, periodEnd(previous, period)),
    [history, previous, period],
  );
  const best = useMemo(
    () => history.filter((d) => d.day >= anchor && d.day <= anchorEnd).reduce<ScoredDay | null>((top, d) => (top === null || d.score.total > top.score.total ? d : top), null),
    [history, anchor, anchorEnd],
  );
  const series = useMemo(
    () => averageSeries(history, period, anchor, config.count),
    [history, period, anchor, config.count],
  );

  const choosePeriod = (next: Period) => setPeriod(next);

  if (history.length === 0) {
    return (
      <p className="callout">
        Nothing logged yet. Log a day on the Daily log tab and your trends, comparisons and streaks will show up here.
      </p>
    );
  }

  return (
    <>
      <div className="seg" role="group" aria-label="Trend by">
        {PERIODS.map((p) => (
          <button key={p.id} aria-pressed={period === p.id} onClick={() => choosePeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <Summary
        period={period}
        now={now}
        before={before}
        best={best}
        length={diffDays(anchorEnd, anchor) + 1}
        previousLabel={periodLabel(previous, period)}
        partial={period !== "day"}
      />

      <section aria-label="Trend">
        <div className="group-head">
          <span className="name">{config.title}</span>
          {period !== "day" && <span className="sum">per logged day</span>}
        </div>
        <TrendChart series={series} period={period} selectedStart={anchor} title={config.title} slot={config.slot} />
      </section>

      <Calendar history={history} today={today} />

      <MetricTrends entries={entries} today={today} />
    </>
  );
}

function Stat({
  label,
  value,
  note,
  delta,
  neutral = false,
}: {
  label: string;
  value: string;
  /** Replaces the comparison line, e.g. which day was the best. */
  note?: string;
  delta?: number | null;
  /** Shown without good/bad colors, for comparisons that aren't like for like. */
  neutral?: boolean;
}) {
  const sign = neutral || !delta ? "flat" : delta > 0 ? "up" : "down";
  const line = note ?? (delta === null || delta === undefined ? "No earlier data" : `${fmtSigned(round1(delta))} vs previous`);
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${sign}`}>{line}</div>
    </div>
  );
}

function Summary({
  period,
  now,
  before,
  best,
  length,
  previousLabel,
  partial,
}: {
  period: Period;
  now: Totals;
  before: Totals;
  best: ScoredDay | null;
  length: number;
  previousLabel: string;
  partial: boolean;
}) {
  const avgNow = now.loggedDays ? now.total / now.loggedDays : 0;
  const avgBefore = before.loggedDays ? before.total / before.loggedDays : 0;
  const hasBefore = before.loggedDays > 0;
  return (
    <section aria-label="Summary">
      <div className="stat-grid">
        <Stat
          label={period === "day" ? "Points" : "Average per logged day"}
          value={fmt(round1(avgNow))}
          delta={hasBefore && now.loggedDays ? avgNow - avgBefore : null}
        />
        <Stat
          label="Best day"
          value={best ? fmt(round1(best.score.total)) : "-"}
          note={best ? dayLong(best.day).replace(/^\w+, /, "") : "Nothing logged"}
        />
        <Stat
          label="Days logged"
          value={`${now.loggedDays} of ${length}`}
          delta={hasBefore ? now.loggedDays - before.loggedDays : null}
          neutral={partial}
        />
      </div>
      <p className="demo-note">
        {hasBefore
          ? `Previous: ${previousLabel}, ${fmt(round1(avgBefore))} on average over ${before.loggedDays} logged ${before.loggedDays === 1 ? "day" : "days"}.`
          : `Nothing was logged in ${previousLabel}.`}
      </p>
    </section>
  );
}

function TrendChart({
  series,
  period,
  selectedStart,
  title,
  slot,
}: {
  series: SeriesPoint[];
  period: Period;
  selectedStart: string;
  title: string;
  slot: number;
}) {
  const n = series.length;
  const bars: ChartBar[] = series.map((p) => ({
    key: p.start,
    label: period === "day" ? WEEKDAY_LETTERS[weekdayIndex(p.start)] : axisLabel(p.start, period),
    label2: period === "day" ? String(dayOfMonth(p.start)) : undefined,
    title: periodLabel(p.start, period),
    sub:
      period === "day"
        ? undefined
        : `avg over ${p.loggedDays} logged ${p.loggedDays === 1 ? "day" : "days"}`,
    segments: segmentsOf(p.average),
    hasData: p.loggedDays > 0,
    marked: p.start === selectedStart,
  }));

  return (
    <>
      <StackedChart
        bars={bars}
        scrollSlot={slot}
        scrollKey={period}
        titleFor={(first, last) => rangeTitle(period, series[first].start, series[last].start)}
        ariaLabel={`${title} for the last ${n} ${period === "day" ? "days" : `${period}s`}`}
      />

      <details className="data-table">
        <summary>Show the numbers</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{period === "day" ? "Day" : `${period[0].toUpperCase()}${period.slice(1)}`}</th>
              <th scope="col">{period === "day" ? "Points" : "Avg per day"}</th>
              <th scope="col">Days logged</th>
            </tr>
          </thead>
          <tbody>
            {[...series].slice(-30).reverse().map((p) => (
              <tr key={p.start}>
                <th scope="row">{periodLabel(p.start, period)}</th>
                <td>{p.loggedDays ? fmt(round1(p.average.total)) : "-"}</td>
                <td>{p.loggedDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

const CAL_METRICS = [
  { id: "points", label: "Points" },
  { id: "exercise", label: "Exercise time" },
  { id: "steps", label: "Steps" },
  { id: "sleep", label: "Sleep time" },
  { id: "work", label: "Hours worked" },
] as const;

type CalMetric = (typeof CAL_METRICS)[number]["id"];

function calValue(day: ScoredDay, metric: CalMetric): number {
  switch (metric) {
    case "points":
      return day.score.total;
    case "exercise":
      return day.entry.exerciseMin;
    case "steps":
      return day.entry.steps;
    case "sleep":
      return day.entry.sleepHours;
    case "work":
      return day.entry.workHours;
  }
}

/** Red for the lowest, through orange and yellow, to green for the highest. */
const heat = (t: number) => `hsl(${Math.round(Math.max(0, Math.min(1, t)) * 120)} 88% 52%)`;

function Calendar({ history, today }: { history: ScoredDay[]; today: string }) {
  const thisMonth = periodStart(today, "month");
  const [month, setMonth] = useState(thisMonth);
  const [metric, setMetric] = useState<CalMetric>("points");

  const byDay = useMemo(() => new Map(history.map((d) => [d.day, d])), [history]);
  const best = useMemo(() => Math.max(0.0001, ...history.map((d) => calValue(d, metric))), [history, metric]);
  const label = CAL_METRICS.find((m) => m.id === metric)!.label;
  const show = (v: number) => (metric === "points" ? fmt(round1(v)) : tickText(metric, v));
  const long = (v: number) => (metric === "points" ? `${fmt(round1(v))} points` : formatMetric(metric, v));

  const blanks = weekdayIndex(month);
  const cells = Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i));

  return (
    <section aria-label="Calendar">
      <div className="group-head">
        <span className="name">Calendar</span>
      </div>

      <label className="cal-pick">
        <span>Show</span>
        <select className="select" value={metric} onChange={(e) => setMetric(e.target.value as CalMetric)} aria-label="Calendar shows">
          {CAL_METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="period-nav">
        <button className="square" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="period-label" aria-live="polite">
          {monthTitle(month)}
        </div>
        <button className="square" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(addMonths(month, 1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="cal" role="group" aria-label={`${label} for ${monthTitle(month)}`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span className="cal-dow" key={i} aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {cells.map((day) => {
          const scored = byDay.get(day);
          const future = day > today;
          const value = scored ? calValue(scored, metric) : 0;
          const text = scored
            ? `${dayLong(day)}: ${long(value)}`
            : `${dayLong(day)}: ${future ? "upcoming" : "not logged"}`;
          return (
            <div
              key={day}
              className={`cal-cell ${scored ? "heat" : ""} ${future ? "future" : ""}`}
              style={scored ? { background: heat(value / best) } : undefined}
              role="img"
              aria-label={text}
              title={text}
            >
              <span className="n">{dayOfMonth(day)}</span>
              {scored && <span className="p">{show(value)}</span>}
            </div>
          );
        })}
      </div>
      <div className="cal-legend" aria-hidden="true">
        <span>Low</span>
        <i className="cal-gradient" />
        <span>High ({show(best)})</span>
      </div>
    </section>
  );
}
