"use client";

import { addDays, dayOfMonth, dayShortWeekday, dayLong } from "@/lib/dates";
import { isLogged, type EntryMap } from "@/lib/history";
import { type CategoryKey, type DayEntry, type DayScore, type Group } from "@/lib/scoring";
import type { League, SaveStatus } from "@/lib/types";

type NumericField = Exclude<keyof DayEntry, "meals" | "water">;

interface StepperRow {
  field: NumericField;
  category: CategoryKey;
  label: string;
  sub: string;
  step: number;
  max: number;
  show: (n: number) => string;
}

const minutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
const hours = (h: number) => `${h} ${h === 1 ? "hr" : "hrs"}`;
const plain = (n: number) => String(n);

const GROUPS: { id: Group; title: string; color: string; fields: StepperRow[] }[] = [
  {
    id: "physical",
    title: "Physical",
    color: "var(--physical)",
    fields: [
      { field: "exerciseMin", category: "exercise", label: "Exercise", sub: "+3 per 30 min, max +12", step: 30, max: 240, show: minutes },
      { field: "steps", category: "steps", label: "Steps", sub: "+1 per 1,000, max +20", step: 1000, max: 40000, show: (n) => n.toLocaleString("en-US") },
      { field: "sleepHours", category: "sleep", label: "Sleep", sub: "+3 for 8+ hrs, +2 for 7+, +1 for 6+", step: 0.5, max: 12, show: hours },
    ],
  },
  {
    id: "mental",
    title: "Mental",
    color: "var(--mental)",
    fields: [
      { field: "meditationMin", category: "meditation", label: "Meditation", sub: "+1 per 15 min, max +8", step: 15, max: 240, show: minutes },
      { field: "workHours", category: "work", label: "Work", sub: "+1 per hour, max +14", step: 1, max: 16, show: hours },
      { field: "socialHours", category: "social", label: "Social time", sub: "+1 per hour, max +6", step: 1, max: 12, show: hours },
      { field: "readingMin", category: "reading", label: "Reading", sub: "+1 per 30 min, max +4", step: 30, max: 300, show: minutes },
      { field: "journalEntries", category: "journal", label: "Journaling or gratitude", sub: "+1 per entry, max +3", step: 1, max: 6, show: plain },
    ],
  },
  {
    id: "spiritual",
    title: "Spiritual",
    color: "var(--spiritual)",
    fields: [
      { field: "worshipMin", category: "worship", label: "Worship and prayer", sub: "+1 per 15 min, max +8", step: 15, max: 240, show: minutes },
      { field: "serviceHours", category: "service", label: "Service or volunteering", sub: "+1 per hour, max +4", step: 1, max: 12, show: hours },
    ],
  },
  {
    id: "penalty",
    title: "Penalties",
    color: "var(--penalty)",
    fields: [
      { field: "screenHours", category: "screen", label: "Screen time (non-work)", sub: "-1 per hour", step: 1, max: 16, show: hours },
      { field: "drinks", category: "drinks", label: "Alcoholic drinks", sub: "-0.5 per drink", step: 1, max: 20, show: plain },
      { field: "weed", category: "weed", label: "Weed", sub: "-5 each time", step: 1, max: 10, show: plain },
      { field: "cigarettes", category: "cigarettes", label: "Cigarettes", sub: "-0.5 per cigarette", step: 1, max: 40, show: plain },
    ],
  },
];

const MEALS = ["Breakfast", "Lunch", "Dinner"];

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const fmtSigned = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "-"}${fmt(Math.abs(n))}`);

function pillClass(group: Group, points: number) {
  return points === 0 ? "pill" : `pill ${group}`;
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
}: Props) {
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

  const setMeal = (index: number, grade: number) => {
    const meals = [...entry.meals] as DayEntry["meals"];
    meals[index] = grade;
    onChange({ ...entry, meals });
  };

  const pillars: { name: string; pts: number; max: number; color: string }[] = [
    { name: "Physical", pts: score.physical, max: 42, color: "#5ccfb5" },
    { name: "Mental", pts: score.mental, max: 35, color: "#9aa5ff" },
    { name: "Spiritual", pts: score.spiritual, max: 12, color: "#f2c063" },
  ];

  const heading = day === today ? "Today's points" : `Points for ${dayLong(day)}`;

  return (
    <>
      <DayPicker today={today} selected={day} entries={entries} onPick={onPickDay} />

      <div className="save-line" aria-live="polite">
        {error ? <span className="save-error">{error}</span> : STATUS_TEXT[status]}
      </div>

      <Destination leagues={leagues} selected={selectedLeagueIds} onChange={onLeaguesChange} />

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
          <span className={`chip ${score.balanceBonus ? "on" : ""}`}>Balance bonus {fmtSigned(2)}</span>
          <span className={`chip ${score.streakBonus ? "on" : ""}`}>Streak bonus {fmtSigned(2)}</span>
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
              {GROUPS[0].fields.slice(0, 2).map((row) => (
                <Stepper key={row.field} row={row} group={group.id} entry={entry} score={score} bump={bump} />
              ))}
              {MEALS.map((name, index) => {
                const points = entry.meals[index];
                return (
                  <div className="row" key={name}>
                    <div className="row-top">
                      <span className="row-label">{name}</span>
                      <span className={pillClass("physical", points)}>{fmtSigned(points)}</span>
                    </div>
                    <div className="row-bottom">
                      <span className="row-sub">0 junk, 1 mixed, 2 healthy</span>
                      <div className="grades">
                        {[0, 1, 2].map((grade) => (
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
              <Stepper row={GROUPS[0].fields[2]} group={group.id} entry={entry} score={score} bump={bump} />
              <div className="row">
                <div className="row-top">
                  <span className="row-label">Water</span>
                  <span className={pillClass("physical", entry.water ? 1 : 0)}>{fmtSigned(entry.water ? 1 : 0)}</span>
                </div>
                <div className="row-bottom">
                  <span className="row-sub">Daily glass target met</span>
                  <button
                    className="switch"
                    role="switch"
                    aria-checked={entry.water}
                    aria-label="Water target met"
                    onClick={() => onChange({ ...entry, water: !entry.water })}
                  >
                    <span className="rail">
                      <span className="knob" />
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

          {group.id !== "physical" &&
            group.fields.map((row) => (
              <Stepper key={row.field} row={row} group={group.id} entry={entry} score={score} bump={bump} />
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
}: {
  leagues: League[];
  selected: string[];
  onChange: (ids: string[]) => void;
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
        {leagues.length === 0 && (
          <p className="dest-note">Create or join a league on the Leagues tab to count entries there too.</p>
        )}
      </div>
    </details>
  );
}

function Stepper({
  row,
  group,
  entry,
  score,
  bump,
}: {
  row: StepperRow;
  group: Group;
  entry: DayEntry;
  score: DayScore;
  bump: (row: StepperRow, direction: 1 | -1) => void;
}) {
  const points = score.categories[row.category];
  return (
    <div className="row">
      <div className="row-top">
        <span className="row-label">{row.label}</span>
        <span className={pillClass(group, points)}>{fmtSigned(points)}</span>
      </div>
      <div className="row-bottom">
        <span className="row-sub">{row.sub}</span>
        <div className="stepper">
          <button className="square" aria-label={`Decrease ${row.label}`} onClick={() => bump(row, -1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
          <span className="value">{row.show(entry[row.field])}</span>
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
