"use client";

import { useState } from "react";
import { GROUP_COLORS, tint } from "@/lib/colors";
import { addDays, dayOfMonth, dayShortWeekday, dayLong } from "@/lib/dates";
import { isLogged, type EntryMap } from "@/lib/history";
import { fmtNum, ruleText } from "@/lib/ruleText";
import {
  EMPTY_DAY,
  mealPoints,
  pillarMax,
  type CategoryKey,
  type DayEntry,
  type DayScore,
  type Group,
  type RuleKey,
  type ScoringRules,
} from "@/lib/scoring";
import type { League, SaveStatus } from "@/lib/types";
import { NumberField } from "./NumberField";

type NumericField = Exclude<keyof DayEntry, "meals" | "exerciseNote">;

interface StepperRow {
  field: NumericField;
  category: CategoryKey;
  label: string;
  step: number;
  max: number;
  unit: string;
  decimals: boolean;
}

const GROUPS: { id: Group; title: string; color: string; fields: StepperRow[] }[] = [
  {
    id: "physical",
    title: "Physical",
    color: GROUP_COLORS.physical,
    fields: [
      { field: "exerciseMin", category: "exercise", label: "Exercise", step: 15, max: 600, unit: "min", decimals: false },
      { field: "steps", category: "steps", label: "Steps", step: 1000, max: 100000, unit: "steps", decimals: false },
      { field: "sleepHours", category: "sleep", label: "Sleep", step: 0.5, max: 24, unit: "hrs", decimals: true },
    ],
  },
  {
    id: "mental",
    title: "Mental",
    color: GROUP_COLORS.mental,
    fields: [
      { field: "workHours", category: "work", label: "Work", step: 1, max: 24, unit: "hrs", decimals: true },
      { field: "socialHours", category: "social", label: "Social time", step: 1, max: 24, unit: "hrs", decimals: true },
      { field: "calls", category: "calls", label: "Calls to family or friends", step: 1, max: 20, unit: "", decimals: false },
      { field: "readingMin", category: "reading", label: "Reading", step: 30, max: 1440, unit: "min", decimals: false },
      { field: "journalMin", category: "journal", label: "Journaling or gratitude", step: 15, max: 600, unit: "min", decimals: false },
    ],
  },
  {
    id: "spiritual",
    title: "Spiritual",
    color: GROUP_COLORS.spiritual,
    fields: [
      { field: "meditationMin", category: "meditation", label: "Meditation", step: 15, max: 600, unit: "min", decimals: false },
      { field: "worshipMin", category: "worship", label: "Worship and prayer", step: 15, max: 600, unit: "min", decimals: false },
      { field: "serviceHours", category: "service", label: "Service or volunteering", step: 1, max: 24, unit: "hrs", decimals: true },
    ],
  },
  {
    id: "penalty",
    title: "Penalties",
    color: GROUP_COLORS.penalty,
    fields: [
      { field: "screenHours", category: "screen", label: "Screen time (non-work)", step: 1, max: 24, unit: "hrs", decimals: true },
      { field: "drinks", category: "drinks", label: "Alcoholic drinks", step: 1, max: 50, unit: "", decimals: false },
      { field: "weed", category: "weed", label: "Weed", step: 1, max: 20, unit: "", decimals: false },
      { field: "cigarettes", category: "cigarettes", label: "Cigarettes", step: 1, max: 100, unit: "", decimals: false },
      { field: "masturbation", category: "masturbation", label: "Masturbation", step: 1, max: 20, unit: "", decimals: false },
    ],
  },
];

const MEALS = ["Breakfast", "Lunch", "Dinner"];

export const fmt = (n: number) => String(Number(n.toFixed(2)));
export const fmtSigned = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "-"}${fmt(Math.abs(n))}`);

/** Pill colors: the category's own neon when it has points, otherwise quiet. */
function pillStyle(color: string, points: number) {
  return points === 0 ? undefined : { background: tint(color), color };
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving...",
  saved: "Saved",
  error: "Couldn't save",
};

interface Props {
  day: string;
  today: string;
  entries: EntryMap;
  entry: DayEntry;
  score: DayScore;
  onChange: (next: DayEntry) => void;
  onPickDay: (day: string) => void;
  leagues: League[];
  selectedLeagueIds: string[];
  onLeaguesChange: (ids: string[]) => void;
  status: SaveStatus;
  error: string | null;
  rules: ScoringRules;
  customized: boolean;
  /** Says when a league scores this day differently from your own scoring. */
  leagueNote: string | null;
  onOpenScoring: () => void;
}

export function DailyLog({
  day,
  today,
  entries,
  entry,
  score,
  onChange,
  onPickDay,
  leagues,
  selectedLeagueIds,
  onLeaguesChange,
  status,
  error,
  rules,
  customized,
  leagueNote,
  onOpenScoring,
}: Props) {
  const maxes = pillarMax(rules);
  const groupTotal: Record<Group, number> = {
    physical: score.physical,
    mental: score.mental,
    spiritual: score.spiritual,
    penalty: score.penalties,
  };

  const bump = (row: StepperRow, direction: 1 | -1) => {
    const next = Math.min(row.max, Math.max(0, +(entry[row.field] + direction * row.step).toFixed(2)));
    onChange({ ...entry, [row.field]: next });
  };

  const set = (row: StepperRow, value: number) => onChange({ ...entry, [row.field]: value });

  const setMeal = (index: number, grade: number) => {
    const meals = [...entry.meals] as DayEntry["meals"];
    meals[index] = grade;
    onChange({ ...entry, meals });
  };

  const pillars: { name: string; pts: number; max: number; color: string }[] = [
    { name: "Physical", pts: score.physical, max: maxes.physical, color: GROUP_COLORS.physical },
    { name: "Mental", pts: score.mental, max: maxes.mental, color: GROUP_COLORS.mental },
    { name: "Spiritual", pts: score.spiritual, max: maxes.spiritual, color: GROUP_COLORS.spiritual },
  ];

  const heading = day === today ? "Today's points" : `Points for ${dayLong(day)}`;

  return (
    <>
      <Destination
        leagues={leagues}
        selected={selectedLeagueIds}
        onChange={onLeaguesChange}
        note={leagueNote}
      />

      <DayPicker today={today} selected={day} entries={entries} onPick={onPickDay} />

      <div className="save-row">
        <div className="save-line" aria-live="polite">
          {error ? <span className="save-error">{error}</span> : STATUS_TEXT[status]}
        </div>
        <ClearDay key={day} day={day} disabled={!isLogged(entry)} onClear={() => onChange(EMPTY_DAY)} />
      </div>

      <div className="scoring-line">
        <span>{customized ? "Using your custom scoring" : "Using standard scoring"}</span>
        <button className="text-button" type="button" onClick={onOpenScoring}>
          Customize points
        </button>
      </div>

      <section className="hero" aria-label={heading}>
        <div className="hero-label">{heading}</div>
        <div className="hero-total">{fmt(score.total)}</div>
        {pillars.map((p) => (
          <div className="pillar-row" key={p.name}>
            <span>{p.name}</span>
            <div className="track">
              <div style={{ width: `${Math.max(0, Math.min(100, (p.pts / p.max) * 100))}%`, background: p.color }} />
            </div>
            <span className="pts">{fmtSigned(p.pts)}</span>
          </div>
        ))}
        <div className="chips">
          <span className={`chip ${score.balanceBonus ? "on" : ""}`}>Balance bonus {fmtSigned(rules.balanceBonus)}</span>
          <span className={`chip ${score.streakBonus ? "on" : ""}`}>Streak bonus {fmtSigned(rules.streakBonus)}</span>
          <span className={`chip ${score.penalties < 0 ? "neg" : ""}`}>Penalties {fmtSigned(score.penalties)}</span>
        </div>
      </section>

      {GROUPS.map((group) => (
        <section key={group.id} aria-label={group.title}>
          <div className="group-head">
            <span className="name">
              <span className="dot" style={{ background: group.color }} />
              {group.title}
            </span>
            <span className="sum">{fmtSigned(groupTotal[group.id])}</span>
          </div>

          {group.id === "physical" && (
            <>
              <Stepper row={GROUPS[0].fields[0]} group={group.id} entry={entry} score={score} rules={rules} bump={bump} set={set} />
              <div className="row note-row">
                <label className="row-sub" htmlFor="exercise-note">
                  What did you do? League mates can see this.
                </label>
                <input
                  id="exercise-note"
                  className="note-input"
                  value={entry.exerciseNote}
                  maxLength={120}
                  placeholder="Run, lifting, yoga..."
                  onChange={(e) => onChange({ ...entry, exerciseNote: e.target.value })}
                />
              </div>
              <Stepper row={GROUPS[0].fields[1]} group={group.id} entry={entry} score={score} rules={rules} bump={bump} set={set} />
              {MEALS.map((name, index) => {
                const points = mealPoints(entry.meals[index], rules);
                return (
                  <div className="row" key={name}>
                    <div className="row-top">
                      <span className="row-label">{name}</span>
                      <span className="pill" style={pillStyle(GROUP_COLORS.physical, points)}>{fmtSigned(points)}</span>
                    </div>
                    <div className="row-bottom">
                      <span className="row-sub">0 junk, 1 mixed, 2 healthy, 3 great</span>
                      <div className="grades">
                        {[0, 1, 2, 3].map((grade) => (
                          <button
                            key={grade}
                            className="square"
                            aria-label={`${name} score ${grade}`}
                            aria-pressed={entry.meals[index] === grade}
                            onClick={() => setMeal(index, grade)}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <Stepper row={GROUPS[0].fields[2]} group={group.id} entry={entry} score={score} rules={rules} bump={bump} set={set} />
            </>
          )}

          {group.id !== "physical" &&
            group.fields.map((row) => (
              <Stepper key={row.field} row={row} group={group.id} entry={entry} score={score} rules={rules} bump={bump} set={set} />
            ))}
        </section>
      ))}
    </>
  );
}

function DayPicker({
  today,
  selected,
  entries,
  onPick,
}: {
  today: string;
  selected: string;
  entries: EntryMap;
  onPick: (day: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="day-picker" role="group" aria-label="Choose a day to log">
      {days.map((day) => {
        const logged = isLogged(entries[day]);
        return (
          <button
            key={day}
            className="day-chip"
            aria-pressed={day === selected}
            aria-label={`${dayLong(day)}${logged ? ", logged" : ""}`}
            onClick={() => onPick(day)}
          >
            <span className="dow">{day === today ? "Today" : dayShortWeekday(day)}</span>
            <strong>{dayOfMonth(day)}</strong>
            <span className={`mark ${logged ? "on" : ""}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function Destination({
  leagues,
  selected,
  onChange,
  note,
}: {
  leagues: League[];
  selected: string[];
  onChange: (ids: string[]) => void;
  note: string | null;
}) {
  const names = leagues.filter((l) => selected.includes(l.id)).map((l) => l.name);
  const summary = names.length === 0 ? "Personal only" : `Personal + ${names.join(", ")}`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <details className="dest">
      <summary>
        <span className="dest-label">Counts toward</span>
        <span className="dest-value">{summary}</span>
      </summary>
      <div className="dest-panel">
        <label className="check">
          <input type="checkbox" checked disabled />
          <span>Personal (always)</span>
        </label>
        {leagues.map((league) => (
          <label className="check" key={league.id}>
            <input type="checkbox" checked={selected.includes(league.id)} onChange={() => toggle(league.id)} />
            <span>{league.name}</span>
          </label>
        ))}
        {note && <p className="dest-note">{note}</p>}
        {leagues.length === 0 && (
          <p className="dest-note">Create or join a league on the Leagues tab to count entries there too.</p>
        )}
      </div>
    </details>
  );
}

function subText(row: StepperRow, rules: ScoringRules): string {
  if (row.category === "sleep") {
    const { perHour, bonus7, bonus8 } = rules.sleep;
    return `+${fmtNum(perHour)} per hr, +${fmtNum(bonus7)} bonus at 7 hrs, +${fmtNum(bonus8)} at 8 (max ${fmtNum(8 * perHour + Math.max(bonus7, bonus8))})`;
  }
  const key = row.category as RuleKey;
  return ruleText(key, rules.rules[key]);
}

function Stepper({
  row,
  group,
  entry,
  score,
  rules,
  bump,
  set,
}: {
  row: StepperRow;
  group: Group;
  entry: DayEntry;
  score: DayScore;
  rules: ScoringRules;
  bump: (row: StepperRow, direction: 1 | -1) => void;
  set: (row: StepperRow, value: number) => void;
}) {
  const points = score.categories[row.category];
  return (
    <div className="row">
      <div className="row-top">
        <span className="row-label">{row.label}</span>
        <span className="pill" style={pillStyle(GROUP_COLORS[group], points)}>{fmtSigned(points)}</span>
      </div>
      <div className="row-bottom">
        <span className="row-sub">{subText(row, rules)}</span>
        <div className="stepper">
          <button className="square" aria-label={`Decrease ${row.label}`} onClick={() => bump(row, -1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <NumberField
            value={entry[row.field]}
            max={row.max}
            decimals={row.decimals}
            unit={row.unit}
            label={row.label}
            onCommit={(value) => set(row, value)}
          />
          <button className="square" aria-label={`Increase ${row.label}`} onClick={() => bump(row, 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ClearDay({ day, disabled, onClear }: { day: string; disabled: boolean; onClear: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className="text-button" type="button" disabled={disabled} onClick={() => setAsking(true)}>
        Clear all entries
      </button>
    );
  }
  return (
    <div className="confirm" role="alertdialog" aria-label="Confirm clearing entries">
      <span>Clear everything for {dayLong(day)}?</span>
      <button
        className="text-button danger"
        type="button"
        onClick={() => {
          onClear();
          setAsking(false);
        }}
      >
        Yes, clear
      </button>
      <button className="text-button" type="button" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
}
