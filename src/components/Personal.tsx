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
  bestStreak,
  currentStreak,
  periodSeries,
  scoreHistory,
  totalsBetween,
  type EntryMap,
  type ScoredDay,
  type SeriesPoint,
  type Totals,
} from "@/lib/history";
import { CATEGORIES } from "@/lib/scoring";
import { fmt, fmtSigned } from "./DailyLog";

const PERIODS: { id: Period; label: string; count: number }[] = [
  { id: "day", label: "Day", count: 14 },
  { id: "week", label: "Week", count: 12 },
  { id: "month", label: "Month", count: 12 },
  { id: "year", label: "Year", count: 5 },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function Personal({ entries, today }: { entries: EntryMap; today: string }) {
  const history = useMemo(() => scoreHistory(entries), [entries]);
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);

  const config = PERIODS.find((p) => p.id === period) ?? PERIODS[1];
  const currentStart = periodStart(today, period);
  const anchor = shiftPeriod(currentStart, period, offset);
  const anchorEnd = periodEnd(anchor, period);
  const previous = shiftPeriod(anchor, period, -1);

  const now = useMemo(() => totalsBetween(history, anchor, anchorEnd), [history, anchor, anchorEnd]);
  const before = useMemo(
    () => totalsBetween(history, previous, periodEnd(previous, period)),
    [history, previous, period],
  );
  const series = useMemo(
    () => periodSeries(history, period, anchor, config.count),
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
      <div className="seg" role="group" aria-label="Time period">
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
        now={now}
        before={before}
        length={diffDays(anchorEnd, anchor) + 1}
        previousLabel={periodLabel(previous, period)}
        partial={offset === 0 && period !== "day"}
      />

      <section aria-label="Trend">
        <div className="group-head">
          <span className="name">Points per {period}</span>
        </div>
        <TrendChart series={series} period={period} selectedStart={anchor} />
      </section>

      <section aria-label="Where your points come from">
        <div className="group-head">
          <span className="name">Where the points come from</span>
        </div>
        <Breakdown totals={now} />
      </section>

      <Calendar history={history} today={today} />

      <Streaks entries={entries} history={history} today={today} />
    </>
  );
}

function Stat({
  label,
  value,
  delta,
  neutral = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  /** Shown without good/bad colors, for comparisons that aren't like for like. */
  neutral?: boolean;
}) {
  const sign = neutral || delta === null || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className={`stat-delta ${sign}`}>{delta === null ? "No earlier data" : `${fmtSigned(round1(delta))} vs previous`}</div>
    </div>
  );
}

function Summary({
  now,
  before,
  length,
  previousLabel,
  partial,
}: {
  now: Totals;
  before: Totals;
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
          label="Points"
          value={fmt(round1(now.total))}
          delta={hasBefore ? now.total - before.total : null}
          neutral={partial}
        />
        <Stat
          label="Average per logged day"
          value={fmt(round1(avgNow))}
          delta={hasBefore && now.loggedDays ? avgNow - avgBefore : null}
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
          ? `Previous: ${previousLabel}, ${fmt(round1(before.total))} points over ${before.loggedDays} logged ${before.loggedDays === 1 ? "day" : "days"}.`
          : `Nothing was logged in ${previousLabel}.`}
        {partial && " This period isn't over yet, so the average per logged day is the fairer comparison."}
      </p>
    </section>
  );
}

function TrendChart({
  series,
  period,
  selectedStart,
}: {
  series: SeriesPoint[];
  period: Period;
  selectedStart: string;
}) {
  const W = 360;
  const H = 190;
  const left = 12;
  const right = 12;
  const top = 24;
  const bottom = 30;
  const n = series.length;
  const values = series.map((p) => p.total);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / span) * plotH;
  const y0 = y(0);
  const slot = (W - left - right) / n;
  const barW = Math.min(28, slot * 0.64);
  const labelEvery = n > 8 ? 2 : 1;

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Points per ${period} for the last ${n} ${period}s`}>
        <line className="chart-axis" x1={left} x2={W - right} y1={y0} y2={y0} />
        {series.map((p, i) => {
          const cx = left + slot * (i + 0.5);
          const selected = p.start === selectedStart;
          const logged = p.loggedDays > 0;
          const h = logged ? Math.max(2, Math.abs(y(p.total) - y0)) : 0;
          const barY = p.total >= 0 ? y0 - h : y0;
          return (
            <g key={p.start}>
              {logged ? (
                <rect
                  className={`chart-bar ${selected ? "selected" : ""} ${p.total < 0 ? "negative" : ""}`}
                  x={cx - barW / 2}
                  y={barY}
                  width={barW}
                  height={h}
                  rx={3}
                />
              ) : (
                <rect className="chart-empty" x={cx - barW / 2} y={y0 - 1} width={barW} height={2} />
              )}
              {selected && logged && (
                <text className="chart-value" x={cx} y={p.total >= 0 ? barY - 6 : barY + h + 14} textAnchor="middle">
                  {fmt(round1(p.total))}
                </text>
              )}
              {(n - 1 - i) % labelEvery === 0 && (
                <text className={`chart-label ${selected ? "selected" : ""}`} x={cx} y={H - 10} textAnchor="middle">
                  {axisLabel(p.start, period)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="data-table">
        <summary>Show the numbers</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{period === "day" ? "Day" : `${period[0].toUpperCase()}${period.slice(1)} starting`}</th>
              <th scope="col">Points</th>
              <th scope="col">Days logged</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.start}>
                <th scope="row">{periodLabel(p.start, period)}</th>
                <td>{fmt(round1(p.total))}</td>
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
    { label: "Physical", value: totals.physical, tone: "physical" },
    { label: "Mental", value: totals.mental, tone: "mental" },
    { label: "Spiritual", value: totals.spiritual, tone: "spiritual" },
    { label: "Penalties", value: totals.penalties, tone: "penalty" },
    { label: "Bonuses", value: totals.bonuses, tone: "bonus" },
  ];
  const categories = CATEGORIES.map((c) => ({ label: c.label, value: totals.categories[c.key], tone: c.group }))
    .filter((c) => c.value !== 0)
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
            <span className={`bd-fill ${p.tone}`} style={{ width: `${(Math.abs(p.value) / maxPillar) * 100}%` }} />
          </span>
          <span className="bd-value">{fmtSigned(round1(p.value))}</span>
        </div>
      ))}
      <div className="bd-divider" role="presentation" />
      {categories.map((c) => (
        <div className="bd-row small" key={c.label}>
          <span className="bd-label">{c.label}</span>
          <span className="bd-track">
            <span className={`bd-fill ${c.tone}`} style={{ width: `${(Math.abs(c.value) / maxCategory) * 100}%` }} />
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
