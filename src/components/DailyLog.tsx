"use client";

import { EMPTY_DAY, scoreDay, type DayEntry, type DayScore, type Pillar } from "@/lib/scoring";

type NumericField = Exclude<keyof DayEntry, "meals" | "water">;
type Group = Pillar | "penalty";

interface StepperRow {
  field: NumericField;
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
      { field: "exerciseMin", label: "Exercise", sub: "+3 per 30 min, max +12", step: 30, max: 240, show: minutes },
      { field: "steps", label: "Steps", sub: "+1 per 1,000, max +20", step: 1000, max: 40000, show: (n) => n.toLocaleString("en-US") },
      { field: "sleepHours", label: "Sleep", sub: "+3 for 8+ hrs, +2 for 7+, +1 for 6+", step: 0.5, max: 12, show: hours },
    ],
  },
  {
    id: "mental",
    title: "Mental",
    color: "var(--mental)",
    fields: [
      { field: "meditationMin", label: "Meditation", sub: "+1 per 15 min, max +8", step: 15, max: 240, show: minutes },
      { field: "workHours", label: "Work", sub: "+1 per hour, max +14", step: 1, max: 16, show: hours },
      { field: "socialHours", label: "Social time", sub: "+1 per hour, max +6", step: 1, max: 12, show: hours },
      { field: "readingMin", label: "Reading", sub: "+1 per 30 min, max +4", step: 30, max: 300, show: minutes },
      { field: "journalEntries", label: "Journaling or gratitude", sub: "+1 per entry, max +3", step: 1, max: 6, show: plain },
    ],
  },
  {
    id: "spiritual",
    title: "Spiritual",
    color: "var(--spiritual)",
    fields: [
      { field: "worshipMin", label: "Worship and prayer", sub: "+1 per 15 min, max +8", step: 15, max: 240, show: minutes },
      { field: "serviceHours", label: "Service or volunteering", sub: "+1 per hour, max +4", step: 1, max: 12, show: hours },
    ],
  },
  {
    id: "penalty",
    title: "Penalties",
    color: "var(--penalty)",
    fields: [
      { field: "screenHours", label: "Screen time (non-work)", sub: "-1 per hour", step: 1, max: 16, show: hours },
      { field: "drinks", label: "Alcoholic drinks", sub: "-0.5 per drink", step: 1, max: 20, show: plain },
      { field: "weed", label: "Weed", sub: "-5 each time", step: 1, max: 10, show: plain },
      { field: "cigarettes", label: "Cigarettes", sub: "-0.5 per cigarette", step: 1, max: 40, show: plain },
    ],
  },
];

const MEALS = ["Breakfast", "Lunch", "Dinner"];

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const fmtSigned = (n: number) => (n === 0 ? "0" : `${n > 0 ? "+" : "-"}${fmt(Math.abs(n))}`);

function pillClass(group: Group, points: number) {
  return points === 0 ? "pill" : `pill ${group}`;
}

/** Points one row contributes, found by scoring an otherwise empty day. */
function rowPoints(partial: Partial<DayEntry>) {
  return scoreDay({ ...EMPTY_DAY, ...partial }, 0).total;
}

interface Props {
  entry: DayEntry;
  score: DayScore;
  onChange: (next: DayEntry) => void;
}

export function DailyLog({ entry, score, onChange }: Props) {
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

  return (
    <>
      <section className="hero" aria-label="Today's points">
        <div className="hero-label">Today&apos;s points</div>
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
                <Stepper key={row.field} row={row} group={group.id} entry={entry} bump={bump} />
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
              <Stepper row={GROUPS[0].fields[2]} group={group.id} entry={entry} bump={bump} />
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
            group.fields.map((row) => <Stepper key={row.field} row={row} group={group.id} entry={entry} bump={bump} />)}
        </section>
      ))}
    </>
  );
}

function Stepper({
  row,
  group,
  entry,
  bump,
}: {
  row: StepperRow;
  group: Group;
  entry: DayEntry;
  bump: (row: StepperRow, direction: 1 | -1) => void;
}) {
  const points = rowPoints({ [row.field]: entry[row.field] });
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
