"use client";

import { useMemo, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/colors";
import { axisLabel, periodLabel, periodStart, shiftPeriod, type Period } from "@/lib/dates";
import type { EntryMap } from "@/lib/history";
import { METRICS, allTime, formatMetric, trendSeries, type MetricId } from "@/lib/trends";

const PERIODS: { id: Period; label: string; count: number; noun: string }[] = [
  { id: "day", label: "Daily", count: 14, noun: "day" },
  { id: "week", label: "Weekly", count: 12, noun: "week" },
  { id: "month", label: "Monthly", count: 12, noun: "month" },
  { id: "year", label: "Yearly", count: 5, noun: "year" },
];

type Mode = "total" | "average";

/** Rounds an axis maximum up to 1, 2, 2.5, 5 or 10 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
}

function tickText(metric: MetricId, v: number): string {
  if (metric === "steps") return v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));
  if (metric === "exercise") return v === 0 ? "0" : v < 60 ? `${Math.round(v)}m` : `${Number((v / 60).toFixed(1))}h`;
  return String(Number(v.toFixed(1)));
}

/** Exercise, steps, sleep and work over time: daily, weekly, monthly or yearly, as totals or averages. */
export function MetricTrends({ entries, today }: { entries: EntryMap; today: string }) {
  const [metric, setMetric] = useState<MetricId>("exercise");
  const [period, setPeriod] = useState<Period>("week");
  const [mode, setMode] = useState<Mode>("total");
  const [offset, setOffset] = useState(0); // in whole chart windows
  const [active, setActive] = useState<number | null>(null);

  const config = PERIODS.find((p) => p.id === period)!;
  const info = METRICS.find((m) => m.id === metric)!;
  const color = CATEGORY_COLORS[metric === "exercise" ? "exercise" : metric === "steps" ? "steps" : metric === "sleep" ? "sleep" : "work"];
  const effective: Mode = period === "day" ? "total" : mode;

  const anchor = shiftPeriod(periodStart(today, period), period, offset * config.count);
  const series = useMemo(() => trendSeries(entries, metric, period, anchor, config.count), [entries, metric, period, anchor, config.count]);
  const everything = useMemo(() => allTime(entries, metric), [entries, metric]);
  const valueOf = (p: (typeof series)[number]) => (effective === "total" ? p.total : p.average);

  const latest = series[series.length - 1];
  const earlier = series[series.length - 2];
  const bestIdx = series.reduce((top, p, i) => (valueOf(p) > valueOf(series[top]) ? i : top), 0);
  const hasAny = series.some((p) => p.days > 0);
  const delta = latest && earlier && earlier.days > 0 && latest.days > 0 ? valueOf(latest) - valueOf(earlier) : null;

  // Chart geometry
  const W = 360;
  const H = 200;
  const left = 36;
  const right = 8;
  const top = 12;
  const bottom = 26;
  const n = series.length;
  const max = niceMax(Math.max(0, ...series.map(valueOf)));
  const plotH = H - top - bottom;
  const y = (v: number) => top + ((max - v) / max) * plotH;
  const slot = (W - left - right) / n;
  const barW = Math.min(26, slot * 0.7);
  const labelEvery = n > 12 ? 2 : 1;
  const tip = active === null ? null : series[active];
  const tipX = active === null ? 0 : left + slot * (active + 0.5);

  const word = effective === "total" ? "Total" : "Average";
  const allTimeValue = effective === "total" ? everything.total : everything.average;

  return (
    <section aria-label={`${info.label} over time`}>
      <div className="group-head">
        <span className="name">Trends</span>
        <span className="sum">{effective === "total" ? "added up" : "per day logged"}</span>
      </div>

      <div className="seg" role="group" aria-label="Measure">
        {METRICS.map((m) => (
          <button key={m.id} aria-pressed={metric === m.id} onClick={() => { setMetric(m.id); setActive(null); }}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="seg" role="group" aria-label="Trend by">
        {PERIODS.map((p) => (
          <button key={p.id} aria-pressed={period === p.id} onClick={() => { setPeriod(p.id); setOffset(0); setActive(null); }}>
            {p.label}
          </button>
        ))}
      </div>

      {period !== "day" && (
        <div className="seg" role="group" aria-label="Totals or averages">
          <button aria-pressed={mode === "total"} onClick={() => setMode("total")}>
            Totals
          </button>
          <button aria-pressed={mode === "average"} onClick={() => setMode("average")}>
            Averages
          </button>
        </div>
      )}

      <div className="period-nav">
        <button className="square" aria-label="Earlier" onClick={() => { setOffset(offset - 1); setActive(null); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="period-label" aria-live="polite">
          {periodLabel(series[0].start, period)} to {periodLabel(latest.start, period)}
        </div>
        <button className="square" aria-label="Later" disabled={offset >= 0} onClick={() => { setOffset(offset + 1); setActive(null); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">{offset === 0 ? (period === "day" ? "Today" : `This ${config.noun}`) : periodLabel(latest.start, period)}</div>
          <div className="stat-value small">{latest.days > 0 ? formatMetric(metric, valueOf(latest)) : "-"}</div>
          <div className="stat-delta flat">
            {delta === null ? "No earlier data" : `${delta >= 0 ? "+" : "-"}${formatMetric(metric, Math.abs(delta))} vs previous`}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Best {config.noun}</div>
          <div className="stat-value small">{hasAny ? formatMetric(metric, valueOf(series[bestIdx])) : "-"}</div>
          <div className="stat-delta flat">{hasAny ? periodLabel(series[bestIdx].start, period) : "Nothing logged"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">All time</div>
          <div className="stat-value small">{everything.days > 0 ? formatMetric(metric, allTimeValue) : "-"}</div>
          <div className="stat-delta flat">{everything.days > 0 ? `${word.toLowerCase()}, ${everything.days} ${everything.days === 1 ? "day" : "days"}` : "Nothing logged"}</div>
        </div>
      </div>

      <div className="chart-wrap" onMouseLeave={() => setActive(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${word} ${info.label.toLowerCase()} by ${config.noun}`}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line className={t === 0 ? "chart-axis" : "chart-grid"} x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
              <text className="chart-tick" x={left - 6} y={y(t) + 3.5} textAnchor="end">
                {tickText(metric, t)}
              </text>
            </g>
          ))}
          {series.map((p, i) => {
            const cx = left + slot * (i + 0.5);
            const v = valueOf(p);
            const h = p.days > 0 ? Math.max(2, (v / max) * plotH) : 0;
            return (
              <g key={p.start} opacity={active !== null && active !== i ? 0.45 : 1}>
                {p.days > 0 ? (
                  <rect className="chart-seg" x={cx - barW / 2} y={y(0) - h} width={barW} height={h} rx={3} fill={color} />
                ) : (
                  <rect className="chart-empty" x={cx - barW / 2} y={y(0) - 1} width={barW} height={2} />
                )}
                {(n - 1 - i) % labelEvery === 0 && (
                  <text className={`chart-label ${i === n - 1 && offset === 0 ? "selected" : ""}`} x={cx} y={H - 8} textAnchor="middle">
                    {axisLabel(p.start, period)}
                  </text>
                )}
                <rect
                  className="chart-hit"
                  x={cx - slot / 2}
                  y={top}
                  width={slot}
                  height={H - top}
                  tabIndex={0}
                  role="button"
                  aria-label={`${periodLabel(p.start, period)}: ${p.days > 0 ? formatMetric(metric, v) : "nothing logged"}`}
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
          <div className="chart-tip" role="status" style={{ left: `${Math.min(76, Math.max(24, (tipX / W) * 100))}%` }}>
            <div className="tip-head">
              <span>{periodLabel(tip.start, period)}</span>
              {tip.days > 0 && <strong>{formatMetric(metric, valueOf(tip))}</strong>}
            </div>
            {tip.days === 0 ? (
              <div className="tip-empty">Nothing logged</div>
            ) : period === "day" ? null : (
              <>
                <div className="tip-row">
                  <span>Total</span>
                  <b>{formatMetric(metric, tip.total)}</b>
                </div>
                <div className="tip-row">
                  <span>Average per day</span>
                  <b>{formatMetric(metric, tip.average)}</b>
                </div>
                <div className="tip-sub">{tip.days} {tip.days === 1 ? "day" : "days"} logged</div>
              </>
            )}
          </div>
        )}
      </div>
      {!hasAny && <p className="demo-note">Nothing logged for {info.label.toLowerCase()} in this stretch. Use the arrows to look further back.</p>}
      {effective === "average" && <p className="demo-note">Averages only count days where you logged {info.label.toLowerCase()}.</p>}
    </section>
  );
}
