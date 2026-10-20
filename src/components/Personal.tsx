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
import { CATEGORIES, type CategoryKey } from "@/lib/scoring";
import { fmt, fmtSigned } from "./DailyLog";

const PERIODS: { id: Period; label: string; count: number; title: string }[] = [
  { id: "day", label: "Daily", count: 14, title: "Points per day" },
  { id: "week", label: "Weekly", count: 12, title: "Weekly average" },
  { id: "month", label: "Monthly", count: 12, title: "Monthly average" },
  { id: "year", label: "Yearly", count: 5, title: "Yearly average" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function Personal({ entries, today }: { entries: EntryMap; today: string }) {
  const history = useMemo(() => scoreHistory(entries), [entries]);
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

type Segment = { key: string; label: string; color: string; value: number };

/** The colored slices that make up one bar: every category, plus bonuses. */
function segmentsOf(t: Totals): Segment[] {
  const list: Segment[] = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    color: CATEGORY_COLORS[c.key as CategoryKey],
    value: t.categories[c.key],
  }));
  list.push({ key: "bonus", label: "Bonuses", color: BONUS_COLOR, value: t.bonuses });
  return list.filter((seg) => Math.abs(seg.value) > 0.0005);
}

/** Rounds an axis maximum up to 1, 2, 2.5, 5 or 10 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
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
  const [active, setActive] = useState<number | null>(null);

  const W = 360;
  const H = 220;
  const left = 30;
  const right = 8;
  const top = 14;
  const bottom = 28;
  const n = series.length;

  const stacks = series.map((p) => segmentsOf(p.average));
  const posSum = stacks.map((segs) => segs.reduce((sum, seg) => sum + Math.max(0, seg.value), 0));
  const negSum = stacks.map((segs) => segs.reduce((sum, seg) => sum + Math.min(0, seg.value), 0));
  const max = niceMax(Math.max(0, ...posSum));
  const min = Math.min(0, ...negSum);
  const floor = min === 0 ? 0 : -niceMax(-min);
  const span = max - floor;
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / span) * plotH;
  const y0 = y(0);
  const slot = (W - left - right) / n;
  const barW = Math.min(30, slot * 0.7);
  const labelEvery = n > 8 ? 2 : 1;
  const ticks = [0, max / 2, max];

  const legend = CATEGORIES.filter((c) => stacks.some((segs) => segs.some((seg) => seg.key === c.key)));
  const hasBonus = stacks.some((segs) => segs.some((seg) => seg.key === "bonus"));

  const tip = active === null ? null : series[active];
  const tipSegments = active === null ? [] : [...stacks[active]].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const tipX = active === null ? 0 : left + slot * (active + 0.5);

  return (
    <>
      <div className="chart-wrap" onMouseLeave={() => setActive(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${title} for the last ${n} ${period === "day" ? "days" : `${period}s`}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? "chart-axis" : "chart-grid"} x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
              <text className="chart-tick" x={left - 6} y={y(t) + 3.5} textAnchor="end">
                {fmt(round1(t))}
              </text>
            </g>
          ))}
          {series.map((p, i) => {
            const cx = left + slot * (i + 0.5);
            const selected = p.start === selectedStart;
            const logged = p.loggedDays > 0;
            let up = y0;
            let down = y0;
            const dim = active !== null && active !== i;
            return (
              <g key={p.start} opacity={dim ? 0.4 : 1}>
                {logged ? (
                  stacks[i].map((seg) => {
                    const h = Math.max(1.5, (Math.abs(seg.value) / span) * plotH);
                    let rectY: number;
                    if (seg.value >= 0) {
                      up -= h;
                      rectY = up;
                    } else {
                      rectY = down;
                      down += h;
                    }
                    return <rect key={seg.key} className="chart-seg" x={cx - barW / 2} y={rectY} width={barW} height={h} fill={seg.color} />;
                  })
                ) : (
                  <rect className="chart-empty" x={cx - barW / 2} y={y0 - 1} width={barW} height={2} />
                )}
                {(n - 1 - i) % labelEvery === 0 && (
                  <text className={`chart-label ${selected ? "selected" : ""}`} x={cx} y={H - 9} textAnchor="middle">
                    {axisLabel(p.start, period)}
                  </text>
                )}
                {selected && <rect className="chart-mark" x={cx - barW / 2} y={H - 4} width={barW} height={2} rx={1} />}
                <rect
                  className="chart-hit"
                  x={cx - slot / 2}
                  y={top}
                  width={slot}
                  height={H - top}
                  tabIndex={0}
                  role="button"
                  aria-label={`${periodLabel(p.start, period)}: ${logged ? `${fmt(round1(p.average.total))} points` : "nothing logged"}. Show breakdown.`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setActive(null);
                  }}
                />
              </g>
            );
          })}
        </svg>
        {tip && (
          <div
            className="chart-tip"
            role="status"
            style={{ left: `${Math.min(76, Math.max(24, (tipX / W) * 100))}%` }}
          >
            <div className="tip-head">
              <span>{periodLabel(tip.start, period)}</span>
              {tip.loggedDays > 0 && <strong>{fmt(round1(tip.average.total))}</strong>}
            </div>
            {tip.loggedDays === 0 ? (
              <div className="tip-empty">Nothing logged</div>
            ) : (
              <>
                {period !== "day" && (
                  <div className="tip-sub">
                    avg over {tip.loggedDays} logged {tip.loggedDays === 1 ? "day" : "days"}
                  </div>
                )}
                {tipSegments.map((seg) => (
                  <div className="tip-row" key={seg.key}>
                    <i style={{ background: seg.color }} />
                    <span>{seg.label}</span>
                    <b>{fmtSigned(round1(seg.value))}</b>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <ul className="legend" aria-label="Chart colors">
        {legend.map((c) => (
          <li key={c.key}>
            <i style={{ background: CATEGORY_COLORS[c.key as CategoryKey] }} />
            {c.label}
          </li>
        ))}
        {hasBonus && (
          <li>
            <i style={{ background: BONUS_COLOR }} />
            Bonuses
          </li>
        )}
      </ul>

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
