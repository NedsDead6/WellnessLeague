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
import { StackedChart, segmentsOf, type ChartBar } from "./StackedChart";

const PERIODS: { id: Period; label: string; count: number; title: string }[] = [
  { id: "day", label: "Daily", count: 14, title: "Points per day" },
  { id: "week", label: "Weekly", count: 12, title: "Weekly average" },
  { id: "month", label: "Monthly", count: 12, title: "Monthly average" },
  { id: "year", label: "Yearly", count: 5, title: "Yearly average" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function Personal({ entries, today, rules }: { entries: EntryMap; today: string; rules: ScoringRules }) {
  const history = useMemo(() => scoreHistory(entries, rules), [entries, rules]);
  const [period, setPeriod] = useState<Period>("day");
  const [offset, setOffset] = useState(0);

  const config = PERIODS.find((p) => p.id === period) ?? PERIODS[0];
  const currentStart = periodStart(today, period);
  const anchor = shiftPeriod(currentStart, period, offset);
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

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    setOffset(0);
  };

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

      <div className="period-nav">
        <button className="square" aria-label={`Previous ${period}`} onClick={() => setOffset(offset - 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="period-label" aria-live="polite">
          {periodLabel(anchor, period)}
          {offset === 0 && <span className="period-now">{period === "day" ? "Today" : `This ${period}`}</span>}
        </div>
        <button className="square" aria-label={`Next ${period}`} disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <Summary
        period={period}
        now={now}
        before={before}
        best={best}
        length={diffDays(anchorEnd, anchor) + 1}
        previousLabel={periodLabel(previous, period)}
        partial={offset === 0 && period !== "day"}
      />

      <section aria-label="Trend">
        <div className="group-head">
          <span className="name">{config.title}</span>
          {period !== "day" && <span className="sum">per logged day</span>}
        </div>
        <TrendChart series={series} period={period} selectedStart={anchor} title={config.title} />
      </section>

      <section aria-label="Where your points come from">
        <div className="group-head">
          <span className="name">Where the points come from</span>
          <span className="sum">{period === "day" ? "that day" : "per logged day"}</span>
        </div>
        <Breakdown totals={averageOf(now)} />
      </section>

      <Calendar history={history} today={today} />

      <Streaks entries={entries} history={history} today={today} />
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
}: {
  series: SeriesPoint[];
  period: Period;
  selectedStart: string;
  title: string;
}) {
  const n = series.length;
  const bars: ChartBar[] = series.map((p) => ({
    key: p.start,
    label: axisLabel(p.start, period),
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
        labelEvery={n > 8 ? 2 : 1}
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
            {[...series].reverse().map((p) => (
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

function Breakdown({ totals }: { totals: Totals }) {
  const pillars = [
    { label: "Physical", value: totals.physical, color: GROUP_COLORS.physical },
    { label: "Mental", value: totals.mental, color: GROUP_COLORS.mental },
    { label: "Spiritual", value: totals.spiritual, color: GROUP_COLORS.spiritual },
    { label: "Penalties", value: totals.penalties, color: GROUP_COLORS.penalty },
    { label: "Bonuses", value: totals.bonuses, color: BONUS_COLOR },
  ];
  const categories = CATEGORIES.map((c) => ({
    label: c.label,
    value: totals.categories[c.key],
    color: CATEGORY_COLORS[c.key as CategoryKey],
  }))
    .filter((c) => Math.abs(c.value) > 0.0005)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (totals.loggedDays === 0) {
    return <p className="callout">Nothing logged in this period yet.</p>;
  }

  const maxPillar = Math.max(1, ...pillars.map((p) => Math.abs(p.value)));
  const maxCategory = Math.max(1, ...categories.map((c) => Math.abs(c.value)));

  return (
    <div className="breakdown">
      {pillars.map((p) => (
        <div className="bd-row" key={p.label}>
          <span className="bd-label">{p.label}</span>
          <span className="bd-track">
            <span className="bd-fill" style={{ width: `${(Math.abs(p.value) / maxPillar) * 100}%`, background: p.color }} />
          </span>
          <span className="bd-value">{fmtSigned(round1(p.value))}</span>
        </div>
      ))}
      <div className="bd-divider" role="presentation" />
      {categories.map((c) => (
        <div className="bd-row small" key={c.label}>
          <span className="bd-label">{c.label}</span>
          <span className="bd-track">
            <span className="bd-fill" style={{ width: `${(Math.abs(c.value) / maxCategory) * 100}%`, background: c.color }} />
          </span>
          <span className="bd-value">{fmtSigned(round1(c.value))}</span>
        </div>
      ))}
    </div>
  );
}

function Calendar({ history, today }: { history: ScoredDay[]; today: string }) {
  const thisMonth = periodStart(today, "month");
  const [month, setMonth] = useState(thisMonth);

  const byDay = useMemo(() => new Map(history.map((d) => [d.day, d])), [history]);
  const best = useMemo(() => Math.max(1, ...history.map((d) => d.score.total)), [history]);

  const blanks = weekdayIndex(month);
  const cells = Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i));

  return (
    <section aria-label="Calendar">
      <div className="group-head">
        <span className="name">Calendar</span>
      </div>
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

      <div className="cal" role="group" aria-label={`Daily points for ${monthTitle(month)}`}>
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
          let level = "";
          if (scored) level = scored.score.total <= 0 ? "l0" : `l${Math.min(4, Math.ceil((4 * scored.score.total) / best))}`;
          const label = scored
            ? `${dayLong(day)}: ${fmt(round1(scored.score.total))} points`
            : `${dayLong(day)}: ${future ? "upcoming" : "not logged"}`;
          return (
            <div key={day} className={`cal-cell ${level} ${future ? "future" : ""}`} role="img" aria-label={label} title={label}>
              <span className="n">{dayOfMonth(day)}</span>
              {scored && <span className="p">{fmt(round1(scored.score.total))}</span>}
            </div>
          );
        })}
      </div>
      <div className="cal-legend" aria-hidden="true">
        <span>Less</span>
        <i className="cal-cell l1" />
        <i className="cal-cell l2" />
        <i className="cal-cell l3" />
        <i className="cal-cell l4" />
        <span>More</span>
      </div>
    </section>
  );
}

function Streaks({ entries, history, today }: { entries: EntryMap; history: ScoredDay[]; today: string }) {
  return (
    <section aria-label="Streaks">
      <div className="group-head">
        <span className="name">Streaks</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Current streak</div>
          <div className="stat-value">{currentStreak(entries, today)}</div>
          <div className="stat-delta flat">days in a row</div>
        </div>
        <div className="stat">
          <div className="stat-label">Best streak</div>
          <div className="stat-value">{bestStreak(history)}</div>
          <div className="stat-delta flat">days in a row</div>
        </div>
        <div className="stat">
          <div className="stat-label">Days logged</div>
          <div className="stat-value">{history.length}</div>
          <div className="stat-delta flat">all time</div>
        </div>
      </div>
    </section>
  );
}
