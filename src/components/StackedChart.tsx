"use client";

import { useState } from "react";
import { BONUS_COLOR, CATEGORY_COLORS } from "@/lib/colors";
import type { Totals } from "@/lib/history";
import { CATEGORIES, type CategoryKey } from "@/lib/scoring";
import { fmt, fmtSigned } from "./DailyLog";

const round1 = (n: number) => Math.round(n * 10) / 10;

export type Segment = { key: string; label: string; color: string; value: number };

/** The colored slices that make up one bar: every category, plus bonuses. */
export function segmentsOf(t: Totals): Segment[] {
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

export interface ChartBar {
  key: string;
  /** Short text under the bar. */
  label: string;
  /** Heading of the hover breakdown. */
  title: string;
  /** Smaller line under the heading, e.g. what the number is an average of. */
  sub?: string;
  segments: Segment[];
  /** False draws a flat stub and says nothing was logged. */
  hasData: boolean;
  /** Underlines the bar, e.g. the one being looked at or "you". */
  marked?: boolean;
}

/**
 * Columns stacked by category. Hover, focus or tap a column for the full
 * breakdown. Penalties stack downward from the zero line.
 */
export function StackedChart({
  bars,
  ariaLabel,
  labelEvery = 1,
  emptyText = "Nothing logged",
}: {
  bars: ChartBar[];
  ariaLabel: string;
  labelEvery?: number;
  emptyText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const W = 360;
  const H = 220;
  const left = 30;
  const right = 8;
  const top = 14;
  const bottom = 28;
  const n = bars.length;

  const stacks = bars.map((b) => b.segments);
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
  const ticks = [0, max / 2, max];

  const legend = CATEGORIES.filter((c) => stacks.some((segs) => segs.some((seg) => seg.key === c.key)));
  const hasBonus = stacks.some((segs) => segs.some((seg) => seg.key === "bonus"));

  const tip = active === null ? null : bars[active];
  const tipSegments = active === null ? [] : [...stacks[active]].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const tipTotal = tipSegments.reduce((sum, seg) => sum + seg.value, 0);
  const tipX = active === null ? 0 : left + slot * (active + 0.5);

  return (
    <>
      <div className="chart-wrap" onMouseLeave={() => setActive(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? "chart-axis" : "chart-grid"} x1={left} x2={W - right} y1={y(t)} y2={y(t)} />
              <text className="chart-tick" x={left - 6} y={y(t) + 3.5} textAnchor="end">
                {fmt(round1(t))}
              </text>
            </g>
          ))}
          {bars.map((bar, i) => {
            const cx = left + slot * (i + 0.5);
            let up = y0;
            let down = y0;
            const dim = active !== null && active !== i;
            const total = bar.segments.reduce((sum, seg) => sum + seg.value, 0);
            return (
              <g key={bar.key} opacity={dim ? 0.4 : 1}>
                {bar.hasData ? (
                  bar.segments.map((seg) => {
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
                  <text className={`chart-label ${bar.marked ? "selected" : ""}`} x={cx} y={H - 9} textAnchor="middle">
                    {bar.label}
                  </text>
                )}
                {bar.marked && <rect className="chart-mark" x={cx - barW / 2} y={H - 4} width={barW} height={2} rx={1} />}
                <rect
                  className="chart-hit"
                  x={cx - slot / 2}
                  y={top}
                  width={slot}
                  height={H - top}
                  tabIndex={0}
                  role="button"
                  aria-label={`${bar.title}: ${bar.hasData ? `${fmt(round1(total))} points` : emptyText.toLowerCase()}. Show breakdown.`}
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
              <span>{tip.title}</span>
              {tip.hasData && <strong>{fmt(round1(tipTotal))}</strong>}
            </div>
            {!tip.hasData ? (
              <div className="tip-empty">{emptyText}</div>
            ) : (
              <>
                {tip.sub && <div className="tip-sub">{tip.sub}</div>}
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
    </>
  );
}
