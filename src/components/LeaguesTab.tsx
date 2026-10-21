"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { addDays, weekdayIndex } from "@/lib/dates";
import type { EntryMap } from "@/lib/history";
import { feedItems, firstWeek, scoreMember, weekOf, type LeagueMember } from "@/lib/league";
import { normalizeRules } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import type { League } from "@/lib/types";
import { useLeagueData } from "@/lib/useLeagueData";
import { FeedSection, GoalsSection, MatchupsSection, StandingsSection, WeekNav, type Mode } from "./LeagueSections";
import { LeagueSettings } from "./LeagueSettings";

const LAST_LEAGUE_KEY = "wl:last-league";

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
  updatedAt: Record<string, string>;
  avatarUrl: string | null;
  today: string;
}

export function LeaguesTab({ session, leagues, onLeaguesChanged, entries, shared, updatedAt, avatarUrl, today }: Props) {
  const userId = session?.user.id;
  const [chosen, setChosen] = useState<string | null>(() => (typeof window === "undefined" ? null : rememberedLeague()));
  const [settingsOpen, setSettingsOpen] = useState(false);

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
            <button
              key={league.id}
              aria-pressed={league.id === selected?.id}
              onClick={() => {
                setChosen(league.id);
                setSettingsOpen(false);
              }}
            >
              {league.name}
            </button>
          ))}
        </div>
      )}

      <LeagueTools
        league={selected}
        userId={userId!}
        isOwner={selected?.owner_id === userId}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen(!settingsOpen)}
        onCreated={async (id) => {
          await onLeaguesChanged();
          setChosen(id);
          setSettingsOpen(false);
        }}
      />

      {selected && (
        <LeagueView
          key={selected.id}
          league={selected}
          userId={userId!}
          today={today}
          entries={entries}
          shared={shared}
          updatedAt={updatedAt}
          avatarUrl={avatarUrl}
          showName={leagues.length === 1}
          settingsOpen={settingsOpen && selected.owner_id === userId}
          onCloseSettings={() => setSettingsOpen(false)}
          onLeaguesChanged={onLeaguesChanged}
        />
      )}
    </>
  );
}

type Section = "standings" | "matchups" | "goals" | "feed";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "standings", label: "Standings" },
  { id: "matchups", label: "Matchups" },
  { id: "goals", label: "Goals" },
  { id: "feed", label: "Feed" },
];

function LeagueView({
  league,
  userId,
  today,
  entries,
  shared,
  updatedAt,
  avatarUrl,
  showName,
  settingsOpen,
  onCloseSettings,
  onLeaguesChanged,
}: {
  league: League;
  userId: string;
  today: string;
  entries: EntryMap;
  shared: Record<string, string[]>;
  updatedAt: Record<string, string>;
  avatarUrl: string | null;
  showName: boolean;
  settingsOpen: boolean;
  onCloseSettings: () => void;
  onLeaguesChanged: () => void | Promise<void>;
}) {
  const data = useLeagueData(league.id, userId);
  const rules = useMemo(() => normalizeRules(league.scoring), [league.scoring]);

  const [section, setSection] = useState<Section>("standings");
  const [mode, setMode] = useState<Mode>("day");
  const [offset, setOffset] = useState(0);
  const [dayIdx, setDayIdx] = useState(() => weekdayIndex(today));
  const [pairId, setPairId] = useState<string | null>(null);

  // Your own shared days come from this device so changes show instantly.
  const members = useMemo(() => {
    const mine: LeagueMember = {
      id: userId,
      name: "You",
      you: true,
      avatarUrl,
      entries: Object.fromEntries(Object.entries(entries).filter(([day]) => (shared[day] ?? []).includes(league.id))),
      updatedAt: Object.fromEntries(Object.entries(updatedAt).filter(([day]) => (shared[day] ?? []).includes(league.id))),
    };
    const others: LeagueMember[] = data.others.map((o) => ({ id: o.id, name: o.name, you: false, avatarUrl: o.avatarUrl, entries: o.entries, updatedAt: o.updatedAt }));
    return [...others, mine].map((m) => scoreMember(m, rules));
  }, [data.others, entries, shared, updatedAt, avatarUrl, league.id, userId, rules]);

  const currentWeek = weekOf(today);
  const weekStart = addDays(currentWeek, offset * 7);
  const earliest = firstWeek(members) ?? currentWeek;
  const feed = useMemo(
    () => feedItems(members, data.posts, data.others.filter((o) => o.joinedAt).map((o) => ({ userId: o.id, joinedAt: o.joinedAt })), today),
    [members, data.posts, data.others, today],
  );

  if (settingsOpen) {
    return (
      <LeagueSettings
        league={league}
        today={today}
        userId={userId}
        challenges={data.challenges}
        onBack={onCloseSettings}
        onScoringSaved={onLeaguesChanged}
        onChallengesChanged={data.reload}
      />
    );
  }

  const usesWeek = section !== "feed";
  const shownDay = Math.min(dayIdx, offset === 0 ? weekdayIndex(today) : 6);

  return (
    <section aria-label={`${league.name}`}>
      <div className="group-head">
        <span className="name">{showName ? league.name : "League"}</span>
        <button className="text-button" type="button" onClick={() => void data.reload()}>
          Refresh
        </button>
      </div>

      <div className="seg sections" role="group" aria-label="League sections">
        {SECTIONS.map((s) => (
          <button key={s.id} aria-pressed={section === s.id} onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {data.error && <p className="form-message">Couldn&apos;t load the league: {data.error}</p>}

      {usesWeek && (
        <WeekNav
          weekStart={weekStart}
          isCurrent={offset === 0}
          canPrev={weekStart > earliest}
          canNext={offset < 0}
          onPrev={() => setOffset(offset - 1)}
          onNext={() => setOffset(offset + 1)}
        />
      )}

      {section === "standings" && (
        <StandingsSection
          members={members}
          today={today}
          weekStart={weekStart}
          onOpenMatchup={(id) => {
            setPairId(id);
            setSection("matchups");
          }}
        />
      )}
      {section === "matchups" && (
        <MatchupsSection
          members={members}
          reactions={data.reactions}
          today={today}
          weekStart={weekStart}
          mode={mode}
          onMode={setMode}
          dayIdx={shownDay}
          onDay={setDayIdx}
          pairId={pairId}
          onPair={setPairId}
          onReact={(target, day, emoji) => void data.toggleReaction(target, day, emoji)}
          userId={userId}
        />
      )}
      {section === "goals" && <GoalsSection challenges={data.challenges} members={members} weekStart={weekStart} />}
      {section === "feed" && <FeedSection items={feed} reactions={data.feedReactions} userId={userId} onReact={data.toggleFeedReaction} onPost={data.addPost} onDelete={(id) => void data.deletePost(id)} />}
    </section>
  );
}

/** Invite friends and create a league, tucked into two compact toggles. */
function LeagueTools({
  league,
  userId,
  isOwner,
  settingsOpen,
  onToggleSettings,
  onCreated,
}: {
  league: League | undefined;
  userId: string;
  isOwner: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
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
        {isOwner && (
          <button aria-expanded={settingsOpen} onClick={onToggleSettings}>
            Settings
          </button>
        )}
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
