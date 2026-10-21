"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_COLORS } from "@/lib/colors";
import { periodLabel, periodStart, weekdayIndex, axisLabel, type Period } from "@/lib/dates";
import type { EntryMap } from "@/lib/history";
import { METRICS, WEEKDAY_LETTERS, allTime, formatMetric, rangeTitle, tickText, trendSeries, type MetricId } from "@/lib/trends";

const PERIODS: { id: Period; label: string; count: number; slot: number; noun: string }[] = [
  { id: "day", label: "Daily", count: 120, slot: 30, noun: "day" },
  { id: "week", label: "Weekly", count: 52, slot: 48, noun: "week" },
  { id: "month", label: "Monthly", count: 36, slot: 46, noun: "month" },
  { id: "year", label: "Yearly", count: 10, slot: 66, noun: "year" },
];

type Mode = "total" | "average";

/** Rounds an axis maximum up to 1, 2, 2.5, 5 or 10 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((m) => m * pow >= value) ?? 10) * pow;
}

const H = 214;
const TOP = 10;
const BOTTOM = 38;
const AXIS_W = 38;

/** Exercise, steps, sleep and work over time: daily, weekly, monthly or yearly, as totals or averages. Scroll sideways for older data. */
export function MetricTrends({ entries, today }: { entries: EntryMap; today: string }) {
  const [metric, setMetric] = useState<MetricId>("exercise");
  const [period, setPeriod] = useState<Period>("week");
  const [mode, setMode] = useState<Mode>("total");
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState({ left: 0, width: 320 });
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const config = PERIODS.find((p) => p.id === period)!;
  const info = METRICS.find((m) => m.id === metric)!;
  const color = CATEGORY_COLORS[metric];
  const effective: Mode = period === "day" ? "total" : mode;

  const anchor = periodStart(today, period);
  const series = useMemo(() => trendSeries(entries, metric, period, anchor, config.count), [entries, metric, period, anchor, config.count]);
  const everything = useMemo(() => allTime(entries, metric), [entries, metric]);
  const valueOf = (p: (typeof series)[number]) => (effective === "total" ? p.total : p.average);

  const n = series.length;
  const slot = config.slot;
  const latest = series[n - 1];
  const earlier = series[n - 2];
  const bestIdx = series.reduce((top, p, i) => (valueOf(p) > valueOf(series[top]) ? i : top), 0);
  const hasAny = series.some((p) => p.days > 0);
  const delta = earlier && earlier.days > 0 && latest.days > 0 ? valueOf(latest) - valueOf(earlier) : null;

  // Scale to everything that can be scrolled to, so bars keep their size while you scroll.
  const max = niceMax(Math.max(0, ...series.map(valueOf)));
  const plotH = H - TOP - BOTTOM;
  const y = (v: number) => TOP + ((max - v) / max) * plotH;
  const barW = Math.min(22, slot * 0.62);
  const innerW = n * slot;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setView((v) => (v.left === el.scrollLeft && v.width === el.clientWidth ? v : { left: el.scrollLeft, width: el.clientWidth }));
  }, []);

  const onScroll = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      measure();
    });
  };

  // Start at the newest data whenever the time period changes.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setActive(null);
    measure();
  }, [period, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const firstVisible = Math.max(0, Math.min(n - 1, Math.floor(view.left / slot)));
  const lastVisible = Math.max(firstVisible, Math.min(n - 1, Math.ceil((view.left + view.width) / slot) - 1));
  const title = rangeTitle(period, series[firstVisible].start, series[lastVisible].start);

  const tip = active === null ? null : series[active];
  const tipCenter = active === null ? 0 : active * slot + slot / 2 - view.left;
  const tipLeft = AXIS_W + Math.min(Math.max(tipCenter, 108), Math.max(108, view.width - 108));

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
          <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>
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

      <div className="trend">
        <div className="trend-month" aria-live="polite">
          {title || " "}
        </div>
        <div className="trend-body">
          <svg className="trend-axis" width={AXIS_W} height={H} aria-hidden="true">
            {[0, max / 2, max].map((t) => (
              <text key={t} className="chart-tick" x={AXIS_W - 6} y={y(t) + 3.5} textAnchor="end">
                {tickText(metric, t)}
              </text>
            ))}
          </svg>
          <div
            className="trend-scroll"
            ref={scroller}
            onScroll={onScroll}
            onMouseLeave={() => setActive(null)}
            tabIndex={0}
            role="region"
            aria-label={`${info.label} chart. Scroll sideways for earlier ${config.noun}s.`}
          >
            <svg className="trend-svg" width={innerW} height={H} role="group" aria-label={`${word} ${info.label.toLowerCase()} by ${config.noun}`}>
              {[0, max / 2, max].map((t) => (
                <line key={t} className={t === 0 ? "chart-axis" : "chart-grid"} x1={0} x2={innerW} y1={y(t)} y2={y(t)} />
              ))}
              {series.map((p, i) => {
                const cx = i * slot + slot / 2;
                const v = valueOf(p);
                const h = p.days > 0 ? Math.max(2, (v / max) * plotH) : 0;
                const isNow = i === n - 1;
                const labelClass = `chart-label ${isNow ? "selected" : ""}`;
                return (
                  <g key={p.start} opacity={active !== null && active !== i ? 0.45 : 1}>
                    {p.days > 0 ? (
                      <rect className="chart-seg" x={cx - barW / 2} y={y(0) - h} width={barW} height={h} rx={3} fill={color} />
                    ) : (
                      <rect className="chart-empty" x={cx - barW / 2} y={y(0) - 1} width={barW} height={2} />
                    )}
                    {period === "day" ? (
                      <>
                        <text className={labelClass} x={cx} y={H - 22} textAnchor="middle">
                          {WEEKDAY_LETTERS[weekdayIndex(p.start)]}
                        </text>
                        <text className={labelClass} x={cx} y={H - 8} textAnchor="middle">
                          {Number(p.start.slice(8, 10))}
                        </text>
                      </>
                    ) : (
                      <text className={labelClass} x={cx} y={H - 14} textAnchor="middle">
                        {axisLabel(p.start, period)}
                      </text>
                    )}
                    <rect
                      className="chart-hit"
                      x={i * slot}
                      y={TOP}
                      width={slot}
                      height={H - TOP}
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
          </div>
          {tip && (
            <div className="chart-tip trend-tip" role="status" style={{ left: tipLeft }}>
              <div className="tip-head">
                <span>{periodLabel(tip.start, period)}</span>
                {tip.days > 0 && <strong>{formatMetric(metric, valueOf(tip))}</strong>}
              </div>
              {tip.days === 0 ? (
                <div className="tip-empty">Nothing logged</div>
              ) : period === "day" ? null : (
                <>
                  <div className="tip-row">
                    <span />
                    <span>Total</span>
                    <b>{formatMetric(metric, tip.total)}</b>
                  </div>
                  <div className="tip-row">
                    <span />
                    <span>Average per day</span>
                    <b>{formatMetric(metric, tip.average)}</b>
                  </div>
                  <div className="tip-sub">
                    {tip.days} {tip.days === 1 ? "day" : "days"} logged
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <p className="trend-hint">Swipe or scroll sideways to look further back.</p>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">{period === "day" ? "Today" : `This ${config.noun}`}</div>
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
      {!hasAny && <p className="demo-note">Nothing logged for {info.label.toLowerCase()} yet.</p>}
      {effective === "average" && <p className="demo-note">Averages only count days where you logged {info.label.toLowerCase()}.</p>}
    </section>
  );
}
