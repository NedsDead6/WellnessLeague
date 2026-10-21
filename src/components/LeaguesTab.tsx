"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { addDays, dayLong, dayOfMonth, dayShortWeekday, periodStart } from "@/lib/dates";
import { sumDays, type EntryMap } from "@/lib/history";
import type { DayScore } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import type { League } from "@/lib/types";
import { ownDays, useStandings } from "@/lib/useStandings";
import { fmt } from "./DailyLog";
import { StackedChart, segmentsOf, type ChartBar } from "./StackedChart";

const LAST_LEAGUE_KEY = "wl:last-league";

type Mode = "day" | "week";

function rememberedLeague(): string | null {
  try {
    return window.localStorage.getItem(LAST_LEAGUE_KEY);
  } catch {
    return null;
  }
}

function remember(id: string) {
  try {
    window.localStorage.setItem(LAST_LEAGUE_KEY, id);
  } catch {
    // Remembering the league is only a convenience.
  }
}

interface Props {
  session: Session | null;
  leagues: League[];
  onLeaguesChanged: () => void | Promise<void>;
  entries: EntryMap;
  shared: Record<string, string[]>;
  today: string;
}

export function LeaguesTab({ session, leagues, onLeaguesChanged, entries, shared, today }: Props) {
  const userId = session?.user.id;
  const [chosen, setChosen] = useState<string | null>(() => (typeof window === "undefined" ? null : rememberedLeague()));

  const selected = leagues.find((l) => l.id === chosen) ?? leagues[0];

  useEffect(() => {
    if (selected) remember(selected.id);
  }, [selected]);

  if (!supabase || !session) {
    return (
      <p className="callout">
        Leagues need an account. Once the app is connected to its database, you can create a league here, invite
        friends and see the standings.
      </p>
    );
  }

  return (
    <>
      {leagues.length === 0 && <p className="callout">You&apos;re not in a league yet. Create one below, or open an invite link from a friend.</p>}

      {leagues.length > 1 && (
        <div className="league-tabs" role="group" aria-label="Your leagues">
          {leagues.map((league) => (
            <button key={league.id} aria-pressed={league.id === selected?.id} onClick={() => setChosen(league.id)}>
              {league.name}
            </button>
          ))}
        </div>
      )}

      <LeagueTools
        league={selected}
        userId={userId!}
        onCreated={async (id) => {
          await onLeaguesChanged();
          setChosen(id);
        }}
      />

      {selected && (
        <Standings
          key={selected.id}
          league={selected}
          userId={userId!}
          today={today}
          entries={entries}
          shared={shared}
          showName={leagues.length === 1}
        />
      )}
    </>
  );
}

interface Member {
  id: string;
  name: string;
  you: boolean;
  days: Record<string, DayScore>;
}

function Standings({
  league,
  userId,
  today,
  entries,
  shared,
  showName,
}: {
  league: League;
  userId: string;
  today: string;
  entries: EntryMap;
  shared: Record<string, string[]>;
  showName: boolean;
}) {
  const [mode, setMode] = useState<Mode>("day");
  const [day, setDay] = useState(today);
  const { others, loaded, error, reload } = useStandings(league.id, userId, today);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(periodStart(today, "week"), i)), [today]);
  const members: Member[] = useMemo(
    () => [
      ...others.map((o) => ({ id: o.userId, name: o.name, you: false, days: o.days })),
      { id: userId, name: "You", you: true, days: ownDays(entries, shared, league.id, today) },
    ],
    [others, userId, entries, shared, league.id, today],
  );

  const picked = mode === "week" ? weekDays : [day];
  const rows = members
    .map((m) => {
      const scored = picked.filter((d) => m.days[d]).map((d) => ({ score: m.days[d] }));
      return { ...m, totals: sumDays(scored), shared: scored.length };
    })
    .sort((a, b) => b.totals.total - a.totals.total || Number(b.you) - Number(a.you));

  const leader = Math.max(1, rows[0].totals.total);
  const youIndex = rows.findIndex((p) => p.you);
  const when = mode === "week" ? "this week" : day === today ? "today" : `on ${dayLong(day)}`;
  const anyone = rows.some((r) => r.shared > 0);
  const ordinal = (n: number) => ["1st", "2nd", "3rd"][n - 1] ?? `${n}th`;

  let summary: string;
  if (others.length === 0) {
    summary = loaded ? "You're the only member so far. Use Invite friends above to bring in friends." : "Loading standings...";
  } else if (!anyone) {
    summary = `Nobody has shared a day with this league ${when} yet.`;
  } else if (youIndex === 0) {
    summary = `You're in 1st place ${when}, ${fmt(rows[0].totals.total - rows[1].totals.total)} points ahead of ${rows[1].name}.`;
  } else {
    summary = `You're in ${ordinal(youIndex + 1)} place ${when}, ${fmt(rows[youIndex - 1].totals.total - rows[youIndex].totals.total)} points behind ${rows[youIndex - 1].name}.`;
  }

  const bars: ChartBar[] = rows.map((r) => ({
    key: r.id,
    label: r.you ? "You" : r.name.split(" ")[0].slice(0, 7),
    title: r.you ? `${r.name === "You" ? "You" : r.name}` : r.name,
    sub: mode === "week" ? `This week, ${r.shared} ${r.shared === 1 ? "day" : "days"} shared` : dayLong(day),
    segments: segmentsOf(r.totals),
    hasData: r.shared > 0,
    marked: r.you,
  }));

  return (
    <section aria-label={`${league.name} standings`}>
      <div className="group-head">
        <span className="name">{showName ? league.name : "Standings"}</span>
        <button className="text-button" type="button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <div className="seg" role="group" aria-label="Time range">
        <button aria-pressed={mode === "day"} onClick={() => setMode("day")}>
          Day
        </button>
        <button aria-pressed={mode === "week"} onClick={() => setMode("week")}>
          Week
        </button>
      </div>

      {mode === "day" && (
        <div className="day-picker" role="group" aria-label="Choose a day this week">
          {weekDays.map((d) => {
            const future = d > today;
            const hasData = members.some((m) => m.days[d]);
            return (
              <button
                key={d}
                className="day-chip"
                disabled={future}
                aria-pressed={d === day}
                aria-label={`${dayLong(d)}${hasData ? ", points shared" : ""}`}
                onClick={() => setDay(d)}
              >
                <span className="dow">{d === today ? "Today" : dayShortWeekday(d)}</span>
                <strong>{dayOfMonth(d)}</strong>
                <span className={`mark ${hasData ? "on" : ""}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="form-message">Couldn&apos;t load everyone&apos;s points: {error}</p>}
      <div className="callout">{summary}</div>

      <StackedChart
        bars={bars}
        emptyText="Nothing shared"
        ariaLabel={`Points by member ${mode === "week" ? "this week" : `for ${dayLong(day)}`}, split by category`}
      />

      <div className="standings-list">
        {rows.map((p, index) => (
          <div className={`player ${p.you ? "you" : ""}`} key={p.id}>
            <span className="rank">{index + 1}</span>
            <span className="avatar">{p.name.charAt(0).toUpperCase()}</span>
            <div className="player-body">
              <div className="player-name">
                {p.name}
                {p.you && <span className="you-tag">You</span>}
              </div>
              <div className="bar">
                <div style={{ width: `${Math.max(4, Math.min(100, (p.totals.total / leader) * 100))}%` }} />
              </div>
            </div>
            <span className="player-pts">{fmt(p.totals.total)}</span>
          </div>
        ))}
      </div>

      <p className="demo-note">
        Standings use the standard scoring for everyone, and only count days shared with this league. The streak bonus
        isn&apos;t included yet.
      </p>
    </section>
  );
}

/** Invite friends and create a league, tucked into two compact toggles. */
function LeagueTools({
  league,
  userId,
  onCreated,
}: {
  league: League | undefined;
  userId: string;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState<"invite" | "create" | null>(league ? null : "create");
  const toggle = (which: "invite" | "create") => setOpen(open === which ? null : which);

  return (
    <div className="tools">
      <div className="seg tools-seg" role="group" aria-label="League tools">
        <button aria-expanded={open === "invite"} disabled={!league} onClick={() => toggle("invite")}>
          Invite friends
        </button>
        <button aria-expanded={open === "create"} onClick={() => toggle("create")}>
          New league
        </button>
      </div>
      {open === "invite" && league && <InvitePanel league={league} />}
      {open === "create" && (
        <CreatePanel
          userId={userId}
          onCreated={async (id) => {
            await onCreated(id);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function InvitePanel({ league }: { league: League }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/join/${league.invite_code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setMessage(null);
    } catch {
      setMessage("Couldn't copy automatically. Select the link and copy it by hand.");
    }
  };

  return (
    <div className="tools-panel">
      <span className="tools-note">Anyone with this link can join {league.name}.</span>
      <div className="inline-row">
        <input className="link-box" readOnly value={link} aria-label={`Invite link for ${league.name}`} onFocus={(e) => e.currentTarget.select()} />
        <button className="primary" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {message && <p className="form-message">{message}</p>}
    </div>
  );
}

function CreatePanel({ userId, onCreated }: { userId: string; onCreated: (id: string) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("leagues")
      .insert({ name: name.trim(), owner_id: userId })
      .select("id")
      .single();
    if (error || !data) setMessage(error?.message ?? "Couldn't create the league.");
    else {
      setName("");
      await onCreated(data.id as string);
    }
    setBusy(false);
  };

  return (
    <form className="tools-panel" onSubmit={create}>
      <label className="tools-note" htmlFor="new-league-name">
        League name
      </label>
      <div className="inline-row">
        <input id="new-league-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Friends League" />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create"}
        </button>
      </div>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
