"use client";

import { useMemo, useState } from "react";
import { DailyLog } from "./DailyLog";
import { Leaderboard } from "./Leaderboard";
import { EMPTY_DAY, scoreDay, type DayEntry } from "@/lib/scoring";

// Demo values so the first screen isn't empty. Real data replaces these once
// entries are saved to the database.
const DEMO_ENTRY: DayEntry = {
  ...EMPTY_DAY,
  exerciseMin: 30,
  steps: 6000,
  meals: [2, 1, 0],
  sleepHours: 7.5,
  workHours: 6,
  socialHours: 1,
  screenHours: 2,
};
const DEMO_PRIOR_STREAK = 6;

type Tab = "log" | "board";

export function App() {
  const [tab, setTab] = useState<Tab>("log");
  const [entry, setEntry] = useState<DayEntry>(DEMO_ENTRY);

  // Logging today extends the streak by one day.
  const score = useMemo(() => scoreDay(entry, DEMO_PRIOR_STREAK + 1), [entry]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">{tab === "log" ? `${today} · Friends League` : "Friends League"}</div>
          <h1 className="title">{tab === "log" ? "Daily log" : "Leaderboard"}</h1>
        </div>
        <span className="streak">{DEMO_PRIOR_STREAK + 1}-day streak</span>
      </header>

      <main className="main">
        {tab === "log" ? (
          <DailyLog entry={entry} score={score} onChange={setEntry} />
        ) : (
          <Leaderboard todayTotal={score.total} />
        )}
      </main>

      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <button aria-current={tab === "log" ? "page" : undefined} onClick={() => setTab("log")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="4" width="14" height="17" rx="3" />
              <path d="M9 4.5h6M9 13l2.2 2.2L15.5 11" />
            </svg>
            Daily log
          </button>
          <button aria-current={tab === "board" ? "page" : undefined} onClick={() => setTab("board")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
              <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
            </svg>
            Leaderboard
          </button>
        </div>
      </nav>
    </div>
  );
}
