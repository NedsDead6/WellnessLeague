"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import type { EntryMap } from "@/lib/history";
import { supabase } from "@/lib/supabase";
import type { League } from "@/lib/types";
import { ownPoints, useStandings } from "@/lib/useStandings";
import { fmt } from "./DailyLog";

const LAST_LEAGUE_KEY = "wl:last-league";

type Range = "today" | "week";

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

      {selected && (
        <>
          <Standings
            key={selected.id}
            league={selected}
            userId={userId!}
            today={today}
            entries={entries}
            shared={shared}
            showName={leagues.length === 1}
          />
          <Invite league={selected} />
        </>
      )}

      <CreateLeague
        userId={userId!}
        onCreated={async (id) => {
          await onLeaguesChanged();
          setChosen(id);
        }}
      />
    </>
  );
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
  const [range, setRange] = useState<Range>("today");
  const { others, loaded, error, reload } = useStandings(league.id, userId, today);

  const mine = ownPoints(entries, shared, league.id, today);
  const everyone = [
    ...others.map((p) => ({ id: p.userId, name: p.name, points: p[range], you: false })),
    { id: userId, name: "You", points: mine[range], you: true },
  ].sort((a, b) => b.points - a.points || Number(b.you) - Number(a.you));

  const leader = Math.max(1, everyone[0].points);
  const youIndex = everyone.findIndex((p) => p.you);
  const when = range === "today" ? "today" : "this week";
  const ordinal = (n: number) => ["1st", "2nd", "3rd"][n - 1] ?? `${n}th`;

  let summary: string;
  if (others.length === 0) {
    summary = loaded ? "You're the only member so far. Share the invite link below to bring in friends." : "Loading standings...";
  } else if (youIndex === 0) {
    summary = `You're in 1st place ${when}, ${fmt(everyone[0].points - everyone[1].points)} points ahead of ${everyone[1].name}.`;
  } else {
    summary = `You're in ${ordinal(youIndex + 1)} place ${when}, ${fmt(everyone[youIndex - 1].points - everyone[youIndex].points)} points behind ${everyone[youIndex - 1].name}.`;
  }

  return (
    <section aria-label={`${league.name} standings`}>
      <div className="group-head">
        <span className="name">{showName ? league.name : "Standings"}</span>
        <button className="text-button" type="button" onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      <div className="seg" role="group" aria-label="Time range">
        <button aria-pressed={range === "today"} onClick={() => setRange("today")}>
          Today
        </button>
        <button aria-pressed={range === "week"} onClick={() => setRange("week")}>
          This week
        </button>
      </div>

      {error && <p className="form-message">Couldn&apos;t load everyone&apos;s points: {error}</p>}
      <div className="callout">{summary}</div>

      {everyone.map((p, index) => (
        <div className={`player ${p.you ? "you" : ""}`} key={p.id}>
          <span className="rank">{index + 1}</span>
          <span className="avatar">{p.name.charAt(0).toUpperCase()}</span>
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

      <p className="demo-note">
        Standings use the standard scoring for everyone, and only count days shared with this league. The streak bonus
        isn&apos;t included yet.
      </p>
    </section>
  );
}

function Invite({ league }: { league: League }) {
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
    <section aria-label="Invite friends">
      <div className="group-head">
        <span className="name">Invite friends to {league.name}</span>
      </div>
      <div className="row">
        <input className="link-box" readOnly value={link} aria-label={`Invite link for ${league.name}`} onFocus={(e) => e.currentTarget.select()} />
        <button className="primary" type="button" onClick={copy}>
          {copied ? "Link copied" : "Copy invite link"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </div>
    </section>
  );
}

function CreateLeague({ userId, onCreated }: { userId: string; onCreated: (id: string) => void | Promise<void> }) {
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
    <section aria-label="Create a league">
      <div className="group-head">
        <span className="name">Create a league</span>
      </div>
      <form className="form" onSubmit={create}>
        <label className="field">
          <span>League name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Friends League" />
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create league"}
        </button>
      </form>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
