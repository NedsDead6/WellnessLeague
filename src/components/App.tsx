"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { DailyLog } from "./DailyLog";
import { LeaguesPanel } from "./LeaguesPanel";
import { Leaderboard } from "./Leaderboard";
import { Personal } from "./Personal";
import { dayKey, periodLabel } from "@/lib/dates";
import { currentStreak, streakAt } from "@/lib/history";
import { EMPTY_DAY, scoreDay, type DayEntry } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { useEntries } from "@/lib/useEntries";
import { useLeagues } from "@/lib/useLeagues";
import { useSession } from "@/lib/useSession";

type Tab = "log" | "personal" | "board" | "leagues";

const TITLES: Record<Tab, string> = {
  log: "Daily log",
  personal: "Personal",
  board: "Leaderboard",
  leagues: "Leagues",
};

function Loading() {
  return (
    <div className="shell">
      <main className="main">
        <p className="callout">Loading...</p>
      </main>
    </div>
  );
}

export function App() {
  const { session, ready } = useSession();
  const userId = session?.user.id;
  const { leagues, reload: reloadLeagues } = useLeagues(userId);
  const { entries, shared, loaded, status, error, save } = useEntries(userId);

  const [tab, setTab] = useState<Tab>("log");
  // Dates are filled in after the page loads so the server and browser agree.
  const [today, setToday] = useState("");
  const [day, setDay] = useState("");
  useEffect(() => {
    const key = dayKey(new Date());
    setToday(key);
    setDay(key);
  }, []);

  const entry: DayEntry = entries[day] ?? EMPTY_DAY;

  // A day with no saved entry yet starts with the same leagues as the latest saved day.
  const defaultLeagueIds = useMemo(() => {
    const latest = Object.keys(entries).sort().pop();
    return latest ? (shared[latest] ?? []) : [];
  }, [entries, shared]);

  const selectedLeagueIds = useMemo(() => {
    const chosen = entries[day] !== undefined ? (shared[day] ?? []) : defaultLeagueIds;
    return chosen.filter((id) => leagues.some((l) => l.id === id));
  }, [entries, shared, day, defaultLeagueIds, leagues]);

  const score = useMemo(() => scoreDay(entry, streakAt(entries, day)), [entry, entries, day]);

  const todayTotal = useMemo(
    () => scoreDay(entries[today] ?? EMPTY_DAY, streakAt(entries, today)).total,
    [entries, today],
  );
  const streak = useMemo(() => (today ? currentStreak(entries, today) : 0), [entries, today]);

  if (!today) return <Loading />;
  if (supabase && !ready) return <Loading />;
  if (supabase && !session) return <AuthScreen />;
  if (!loaded) return <Loading />;

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">{tab === "log" ? periodLabel(day, "day") : "Wellness League"}</div>
          <h1 className="title">{TITLES[tab]}</h1>
        </div>
        <span className="streak">{streak}-day streak</span>
      </header>

      <main className="main">
        {tab === "log" && (
          <DailyLog
            day={day}
            today={today}
            entries={entries}
            entry={entry}
            score={score}
            onChange={(next) => save(day, next, selectedLeagueIds)}
            onPickDay={setDay}
            leagues={leagues}
            selectedLeagueIds={selectedLeagueIds}
            onLeaguesChange={(ids) => save(day, entry, ids)}
            status={status}
            error={error}
          />
        )}
        {tab === "personal" && <Personal entries={entries} today={today} />}
        {tab === "board" && <Leaderboard todayTotal={todayTotal} />}
        {tab === "leagues" && <LeaguesPanel session={session} onLeaguesChanged={reloadLeagues} />}
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
          <button aria-current={tab === "personal" ? "page" : undefined} onClick={() => setTab("personal")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 20V11M12 20V5M19 20v-7" />
            </svg>
            Personal
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
