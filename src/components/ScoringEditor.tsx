"use client";

import type { ReactNode } from "react";
import { GROUP_COLORS, tint } from "@/lib/colors";
import { fmtNum, ruleText } from "@/lib/ruleText";
import {
  isDefaultRules,
  type Group,
  type Rule,
  type RuleKey,
  type ScoringRules,
} from "@/lib/scoring";
import type { SaveStatus } from "@/lib/types";
import { NumberField } from "./NumberField";

interface RuleRow {
  key: RuleKey;
  label: string;
  /** What the "per" box counts, shown on its label and inside the box. */
  unit: string;
}

const SECTIONS: { id: Group; title: string; rows: RuleRow[] }[] = [
  {
    id: "physical",
    title: "Physical",
    rows: [
      { key: "exercise", label: "Exercise", unit: "min" },
      { key: "steps", label: "Steps", unit: "steps" },
    ],
  },
  {
    id: "mental",
    title: "Mental",
    rows: [
      { key: "meditation", label: "Meditation", unit: "min" },
      { key: "work", label: "Work", unit: "hrs" },
      { key: "social", label: "Social time", unit: "hrs" },
      { key: "reading", label: "Reading", unit: "min" },
      { key: "journal", label: "Journaling or gratitude", unit: "min" },
    ],
  },
  {
    id: "spiritual",
    title: "Spiritual",
    rows: [
      { key: "worship", label: "Worship and prayer", unit: "min" },
      { key: "service", label: "Service or volunteering", unit: "hrs" },
    ],
  },
  {
    id: "penalty",
    title: "Penalties",
    rows: [
      { key: "screen", label: "Screen time (non-work)", unit: "hrs" },
      { key: "drinks", label: "Alcoholic drinks", unit: "drinks" },
      { key: "weed", label: "Weed", unit: "times" },
      { key: "cigarettes", label: "Cigarettes", unit: "cigs" },
    ],
  },
];

const STATUS_TEXT: Record<SaveStatus, string> = { idle: "", saving: "Saving...", saved: "Saved", error: "Couldn't save" };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rule-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

interface Props {
  rules: ScoringRules;
  onChange: (next: ScoringRules) => void;
  onReset: () => void;
  onBack: () => void;
  status: SaveStatus;
  error: string | null;
}

export function ScoringEditor({ rules, onChange, onReset, onBack, status, error }: Props) {
  const setRule = (key: RuleKey, patch: Partial<Rule>) =>
    onChange({ ...rules, rules: { ...rules.rules, [key]: { ...rules.rules[key], ...patch } } });

  const number = (label: string, value: number, set: (n: number) => void, opts: { unit?: string; max?: number; places?: number; min?: number } = {}) => (
    <NumberField
      className="fill"
      label={label}
      value={value}
      max={opts.max ?? 1000}
      decimals
      places={opts.places ?? 3}
      min={opts.min ?? 0}
      unit={opts.unit ?? ""}
      onCommit={set}
    />
  );

  return (
    <>
      <button className="text-button back" type="button" onClick={onBack}>
        &larr; Back to daily log
      </button>

      <p className="callout">
        Set your own point values. They change your Personal stats only. Leagues always use the standard scoring, so
        there is nothing to adjust when you log for a league.
      </p>

      <div className="save-row">
        <div className="save-line" aria-live="polite">
          {error ? <span className="save-error">{error}</span> : STATUS_TEXT[status]}
        </div>
        <button className="text-button" type="button" disabled={isDefaultRules(rules)} onClick={onReset}>
          Reset to standard scoring
        </button>
      </div>

      {SECTIONS.map((section) => {
        const color = GROUP_COLORS[section.id];
        const penalty = section.id === "penalty";
        return (
          <section key={section.id} aria-label={section.title}>
            <div className="group-head">
              <span className="name">
                <span className="dot" style={{ background: color }} />
                {section.title}
              </span>
            </div>
            {section.rows.map((row) => {
              const rule = rules.rules[row.key];
              return (
                <div className="row" key={row.key}>
                  <div className="row-top">
                    <span className="row-label">{row.label}</span>
                    <span className="pill" style={{ background: tint(color), color }}>
                      {ruleText(row.key, rule)}
                    </span>
                  </div>
                  <div className={`rule-grid ${penalty ? "two" : ""}`}>
                    <Field label={penalty ? "Points lost" : "Points"}>
                      {number(`${row.label} points`, Math.abs(rule.points), (n) => setRule(row.key, { points: penalty ? -n : n }))}
                    </Field>
                    <Field label={`For every (${row.unit})`}>
                      {number(`${row.label}: for every`, rule.per, (n) => setRule(row.key, { per: n }), { unit: row.unit, max: 100000, places: 2, min: 0.01 })}
                    </Field>
                    {!penalty && (
                      <Field label="Max points">
                        {number(`${row.label} max points`, rule.max ?? 0, (n) => setRule(row.key, { max: n }))}
                      </Field>
                    )}
                  </div>
                </div>
              );
            })}

            {section.id === "physical" && (
              <>
                <div className="row">
                  <div className="row-top">
                    <span className="row-label">Healthy meals</span>
                    <span className="pill" style={{ background: tint(color), color }}>
                      mixed +{fmtNum(rules.meals.mixed)}, healthy +{fmtNum(rules.meals.healthy)}
                    </span>
                  </div>
                  <div className="rule-grid two">
                    <Field label="Mixed meal points">
                      {number("Mixed meal points", rules.meals.mixed, (n) => onChange({ ...rules, meals: { ...rules.meals, mixed: n } }))}
                    </Field>
                    <Field label="Healthy meal points">
                      {number("Healthy meal points", rules.meals.healthy, (n) => onChange({ ...rules, meals: { ...rules.meals, healthy: n } }))}
                    </Field>
                  </div>
                </div>
                <div className="row">
                  <div className="row-top">
                    <span className="row-label">Sleep</span>
                    <span className="pill" style={{ background: tint(color), color }}>
                      +{fmtNum(rules.sleep.perHour)} per hr, up to 8
                    </span>
                  </div>
                  <div className="rule-grid">
                    <Field label="Per hour">
                      {number("Sleep points per hour", rules.sleep.perHour, (n) => onChange({ ...rules, sleep: { ...rules.sleep, perHour: n } }))}
                    </Field>
                    <Field label="Bonus at 7 hrs">
                      {number("Sleep bonus at 7 hours", rules.sleep.bonus7, (n) => onChange({ ...rules, sleep: { ...rules.sleep, bonus7: n } }))}
                    </Field>
                    <Field label="Bonus at 8 hrs">
                      {number("Sleep bonus at 8 hours", rules.sleep.bonus8, (n) => onChange({ ...rules, sleep: { ...rules.sleep, bonus8: n } }))}
                    </Field>
                  </div>
                </div>
                <div className="row">
                  <div className="row-top">
                    <span className="row-label">Water</span>
                    <span className="pill" style={{ background: tint(color), color }}>
                      +{fmtNum(rules.water)} for the daily glass target
                    </span>
                  </div>
                  <div className="rule-grid">
                    <Field label="Points">{number("Water points", rules.water, (n) => onChange({ ...rules, water: n }))}</Field>
                  </div>
                </div>
              </>
            )}
          </section>
        );
      })}

      <section aria-label="Bonuses">
        <div className="group-head">
          <span className="name">
            <span className="dot" style={{ background: "#e6eeff" }} />
            Bonuses
          </span>
        </div>
        <div className="row">
          <div className="rule-grid two">
            <Field label="Balance bonus">
              {number("Balance bonus points", rules.balanceBonus, (n) => onChange({ ...rules, balanceBonus: n }))}
            </Field>
            <Field label="Streak bonus">
              {number("Streak bonus points", rules.streakBonus, (n) => onChange({ ...rules, streakBonus: n }))}
            </Field>
          </div>
          <span className="row-sub">
            Balance: for a day with points in all three pillars. Streak: on every 7th day in a row.
          </span>
        </div>
      </section>
    </>
  );
}

