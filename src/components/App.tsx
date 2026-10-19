"use client";

import { useMemo, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { DailyLog } from "./DailyLog";
import { LeaguesPanel } from "./LeaguesPanel";
import { Leaderboard } from "./Leaderboard";
import { EMPTY_DAY, scoreDay, type DayEntry } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";

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

type Tab = "log" | "board" | "leagues";

const TITLES: Record<Tab, string> = { log: "Daily log", board: "Leaderboard", leagues: "Leagues" };

export function App() {
  const { session, ready } = useSession();
  const [tab, setTab] = useState<Tab>("log");
  const [entry, setEntry] = useState<DayEntry>(DEMO_ENTRY);

  // Logging today extends the streak by one day.
  const score = useMemo(() => scoreDay(entry, DEMO_PRIOR_STREAK + 1), [entry]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // When the database is connected, people must sign in first.
  if (supabase && !ready) {
    return (
      <div className="shell">
        <main className="main">
          <p className="callout">Loading...</p>
        </main>
      </div>
    );
  }
  if (supabase && !session) {
    return <AuthScreen />;
  }

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">{tab === "log" ? `${today} · Friends League` : "Wellness League"}</div>
          <h1 className="title">{TITLES[tab]}</h1>
        </div>
        <span className="streak">{DEMO_PRIOR_STREAK + 1}-day streak</span>
      </header>

      <main className="main">
        {tab === "log" && <DailyLog entry={entry} score={score} onChange={setEntry} />}
        {tab === "board" && <Leaderboard todayTotal={score.total} />}
        {tab === "leagues" && <LeaguesPanel session={session} />}
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
          <button aria-current={tab === "leagues" ? "page" : undefined} onClick={() => setTab("leagues")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
              <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14a5.5 5.5 0 0 1 3 5" />
            </svg>
            Leagues
          </button>
        </div>
      </nav>
    </div>
  );
}
