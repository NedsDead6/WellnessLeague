"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface League {
  id: string;
  name: string;
  invite_code: string;
}

export function LeaguesPanel({
  session,
  onLeaguesChanged,
}: {
  session: Session | null;
  onLeaguesChanged?: () => void;
}) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from("league_members")
      .select("leagues(id, name, invite_code)")
      .eq("user_id", userId);
    if (error) {
      setMessage(error.message);
      return;
    }
    const rows = (data ?? []) as unknown as { leagues: League | null }[];
    setLeagues(rows.map((row) => row.leagues).filter((l): l is League => l !== null));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!supabase || !session) {
    return (
      <p className="callout">
        Leagues need an account. Once the app is connected to its database, you can create a league here and invite
        friends.
      </p>
    );
  }

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !userId) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("leagues").insert({ name: name.trim(), owner_id: userId });
    if (error) setMessage(error.message);
    else {
      setName("");
      await load();
      onLeaguesChanged?.();
    }
    setBusy(false);
  };

  const inviteLink = (code: string) => `${window.location.origin}/join/${code}`;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
    } catch {
      setMessage("Couldn't copy automatically. Select the link and copy it by hand.");
    }
  };

  const displayName = (session.user.user_metadata?.display_name as string | undefined) ?? session.user.email;

  return (
    <>
      <section aria-label="Your leagues">
        <div className="group-head">
          <span className="name">Your leagues</span>
        </div>
        {leagues.length === 0 && <p className="callout">You&apos;re not in a league yet. Create one below.</p>}
        {leagues.map((league) => (
          <div className="row" key={league.id}>
            <div className="row-top">
              <span className="row-label">{league.name}</span>
            </div>
            <input className="link-box" readOnly value={inviteLink(league.invite_code)} aria-label={`Invite link for ${league.name}`} onFocus={(e) => e.currentTarget.select()} />
            <button className="primary" type="button" onClick={() => copy(league.invite_code)}>
              {copied === league.invite_code ? "Link copied" : "Copy invite link"}
            </button>
          </div>
        ))}
      </section>

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
      </section>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      <section aria-label="Account">
        <div className="group-head">
          <span className="name">Account</span>
        </div>
        <div className="row">
          <div className="row-top">
            <span className="row-label">{displayName}</span>
          </div>
          <button className="secondary" type="button" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </section>
    </>
  );
}
