"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { isDefaultRules, type ScoringRules } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";

interface Props {
  session: Session | null;
  rules: ScoringRules;
  onResetScoring: () => void;
  onOpenScoring: () => void;
}

export function AccountTab({ session, rules, onResetScoring, onOpenScoring }: Props) {
  const userId = session?.user.id;
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const value = (data?.display_name as string | undefined) ?? "";
        setName(value);
        setSavedName(value);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!supabase || !session) {
    return (
      <p className="callout">
        Accounts aren&apos;t connected yet. Once the app is connected to its database you can sign in here and manage
        your settings.
      </p>
    );
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !userId) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", userId);
    if (error) setMessage(error.message);
    else {
      setSavedName(name.trim());
      setMessage("Saved. Your new name shows in your leagues.");
    }
    setBusy(false);
  };

  const customized = !isDefaultRules(rules);

  return (
    <>
      <section aria-label="Login">
        <div className="group-head">
          <span className="name">Login</span>
        </div>
        <div className="row">
          <span className="row-sub">Signed in as</span>
          <span className="row-label">{session.user.email}</span>
          <button className="secondary" type="button" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </button>
        </div>
      </section>

      <section aria-label="Profile">
        <div className="group-head">
          <span className="name">Profile</span>
        </div>
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </label>
          <button className="primary" type="submit" disabled={busy || name.trim() === savedName || name.trim() === ""}>
            {busy ? "Saving..." : "Save name"}
          </button>
        </form>
        {message && (
          <p className="demo-note" role="status">
            {message}
          </p>
        )}
      </section>

      <section aria-label="Scoring">
        <div className="group-head">
          <span className="name">Scoring</span>
        </div>
        <div className="row">
          <span className="row-label">{customized ? "Custom scoring for your Personal stats" : "Standard scoring"}</span>
          <span className="row-sub">
            Custom point values only change your Personal stats. Leagues always use the standard scoring.
          </span>
          <button className="secondary" type="button" onClick={onOpenScoring}>
            Customize points
          </button>
          {customized && (
            <button className="text-button" type="button" onClick={onResetScoring}>
              Reset to standard scoring
            </button>
          )}
        </div>
      </section>
    </>
  );
}
