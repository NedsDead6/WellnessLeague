"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountTab } from "./AccountTab";
import { AuthScreen } from "./AuthScreen";
import { DailyLog } from "./DailyLog";
import { LeaguesTab } from "./LeaguesTab";
import { Personal } from "./Personal";
import { ScoringEditor } from "./ScoringEditor";
import { dayKey, periodLabel } from "@/lib/dates";
import { currentStreak, streakAt } from "@/lib/history";
import { EMPTY_DAY, isDefaultRules, normalizeRules, scoreDay, type DayEntry } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { useEntries } from "@/lib/useEntries";
import { useLeagues } from "@/lib/useLeagues";
import { useScoringRules } from "@/lib/useScoringRules";
import { useSession } from "@/lib/useSession";

type Tab = "log" | "personal" | "leagues" | "account";

const TITLES: Record<Tab, string> = {
  log: "Daily log",
  personal: "Personal",
  leagues: "Leagues",
  account: "Account",
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

const ICON = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function App() {
  const { session, ready } = useSession();
  const userId = session?.user.id;
  const { leagues, reload: reloadLeagues } = useLeagues(userId);
  const { entries, shared, loaded, status, error, save } = useEntries(userId);
  const scoring = useScoringRules(userId);
  const rules = scoring.rules;

  const [tab, setTab] = useState<Tab>("log");
  const [scoringOpen, setScoringOpen] = useState(false);
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

  const score = useMemo(() => scoreDay(entry, streakAt(entries, day), rules), [entry, entries, day, rules]);
  // Each league scores a day with its own rules (without the streak bonus), so say so when that
  // differs from the person's own total.
  const leagueNote = useMemo(() => {
    const own = scoreDay(entry, 0, rules).total;
    const parts = leagues
      .filter((l) => selectedLeagueIds.includes(l.id))
      .map((l) => ({ name: l.name, total: scoreDay(entry, 0, normalizeRules(l.scoring)).total }))
      .filter((l) => l.total !== own)
      .map((l) => `${l.name} counts it as ${Math.round(l.total * 100) / 100} points`);
    return parts.length > 0 ? `${parts.join(". ")}, using that league's own scoring.` : null;
  }, [entry, rules, leagues, selectedLeagueIds]);
  const streak = useMemo(() => (today ? currentStreak(entries, today) : 0), [entries, today]);

  if (!today) return <Loading />;
  if (supabase && !ready) return <Loading />;
  if (supabase && !session) return <AuthScreen />;
  if (!loaded || !scoring.loaded) return <Loading />;

  const openScoring = () => {
    setTab("log");
    setScoringOpen(true);
  };
  const choose = (next: Tab) => {
    setTab(next);
    if (next !== "log") setScoringOpen(false);
  };

  const heading = tab === "log" && scoringOpen ? "My scoring" : TITLES[tab];
  const kicker = tab === "log" && !scoringOpen ? periodLabel(day, "day") : "Own Your Day";

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">{kicker}</div>
          <h1 className="title">{heading}</h1>
        </div>
        <span className="streak">{streak}-day streak</span>
      </header>

      <main className="main">
        {tab === "log" && scoringOpen && (
          <ScoringEditor
            rules={rules}
            onChange={scoring.save}
            onReset={scoring.reset}
            onBack={() => setScoringOpen(false)}
            status={scoring.status}
            error={scoring.error}
          />
        )}
        {tab === "log" && !scoringOpen && (
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
            rules={rules}
            customized={!isDefaultRules(rules)}
            leagueNote={leagueNote}
            onOpenScoring={openScoring}
          />
        )}
        {tab === "personal" && <Personal entries={entries} today={today} rules={rules} />}
        {tab === "leagues" && (
          <LeaguesTab
            session={session}
            leagues={leagues}
            onLeaguesChanged={reloadLeagues}
            entries={entries}
            shared={shared}
            today={today}
          />
        )}
        {tab === "account" && (
          <AccountTab session={session} rules={rules} onResetScoring={scoring.reset} onOpenScoring={openScoring} />
        )}
      </main>

      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <button aria-current={tab === "log" ? "page" : undefined} onClick={() => choose("log")}>
            <svg {...ICON}>
              <rect x="5" y="4" width="14" height="17" rx="3" />
              <path d="M9 4.5h6M9 13l2.2 2.2L15.5 11" />
            </svg>
            Daily log
          </button>
          <button aria-current={tab === "personal" ? "page" : undefined} onClick={() => choose("personal")}>
            <svg {...ICON}>
              <path d="M5 20V11M12 20V5M19 20v-7" />
            </svg>
            Personal
          </button>
          <button aria-current={tab === "leagues" ? "page" : undefined} onClick={() => choose("leagues")}>
            <svg {...ICON}>
              <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
              <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
            </svg>
            Leagues
          </button>
          <button aria-current={tab === "account" ? "page" : undefined} onClick={() => choose("account")}>
            <svg {...ICON}>
              <circle cx="12" cy="8" r="3.6" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
            </svg>
            Account
          </button>
        </div>
      </nav>
    </div>
  );
}
