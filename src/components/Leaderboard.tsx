"use client";

import { useState } from "react";
import { fmt } from "./DailyLog";

// Sample standings so the screen has something to show. These get replaced by
// real league members once accounts and leagues are connected to the database.
const SAMPLE_PLAYERS = [
  { name: "Alex", today: 41, week: 205 },
  { name: "Sam", today: 33, week: 188 },
  { name: "Jordan", today: 27, week: 171 },
  { name: "Riley", today: 19, week: 142 },
];

// Points earned earlier in the week, standing in for saved daily scores.
const SAMPLE_PRIOR_DAYS_TOTAL = 118;

type Range = "today" | "week";

export function Leaderboard({ todayTotal }: { todayTotal: number }) {
  const [range, setRange] = useState<Range>("today");

  const everyone = [
    ...SAMPLE_PLAYERS.map((p) => ({ name: p.name, points: p[range], you: false })),
    { name: "You", points: range === "today" ? todayTotal : SAMPLE_PRIOR_DAYS_TOTAL + todayTotal, you: true },
  ].sort((a, b) => b.points - a.points);

  const leader = Math.max(1, everyone[0].points);
  const youIndex = everyone.findIndex((p) => p.you);
  const when = range === "today" ? "today" : "this week";
  const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];

  const summary =
    youIndex === 0
      ? `You're in 1st place ${when}, ${fmt(everyone[0].points - everyone[1].points)} points ahead of ${everyone[1].name}.`
      : `You're in ${ordinals[youIndex]} place ${when}, ${fmt(everyone[youIndex - 1].points - everyone[youIndex].points)} points behind ${everyone[youIndex - 1].name}.`;

  return (
    <>
      <div className="seg" role="group" aria-label="Time range">
        <button aria-pressed={range === "today"} onClick={() => setRange("today")}>
          Today
        </button>
        <button aria-pressed={range === "week"} onClick={() => setRange("week")}>
          This week
        </button>
      </div>

      <div className="callout">{summary}</div>

      {everyone.map((p, index) => (
        <div className={`player ${p.you ? "you" : ""}`} key={p.name}>
          <span className="rank">{index + 1}</span>
          <span className="avatar">{p.name.charAt(0)}</span>
          <div className="player-body">
            <div className="player-name">
              {p.name}
              {p.you && <span className="you-tag">You</span>}
            </div>
            <div className="bar">
              <div style={{ width: `${Math.max(4, Math.min(100, (p.points / leader) * 100))}%` }} />
            </div>
          </div>
          <span className="player-pts">{fmt(p.points)}</span>
        </div>
      ))}

      <p className="demo-note">Friends and their scores are sample data until leagues are connected.</p>
    </>
  );
}
