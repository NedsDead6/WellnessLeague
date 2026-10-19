"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { AuthScreen } from "./AuthScreen";

interface Preview {
  name: string;
  member_count: number;
}

export function JoinLeague() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { session, ready } = useSession();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("league_preview", { code }).then(({ data }) => {
      const rows = (data ?? []) as Preview[];
      setPreview(rows.length > 0 ? rows[0] : null);
    });
  }, [code]);

  const join = async () => {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("join_league_by_code", { code });
    if (error) setMessage(error.message);
    else setJoined(true);
    setBusy(false);
  };

  if (!supabase) {
    return (
      <div className="shell">
        <main className="main">
          <p className="callout">This app isn&apos;t connected to its database yet.</p>
        </main>
      </div>
    );
  }

  if (!ready || preview === undefined) {
    return (
      <div className="shell">
        <main className="main">
          <p className="callout">Loading...</p>
        </main>
      </div>
    );
  }

  if (preview === null) {
    return (
      <div className="shell">
        <header className="head">
          <h1 className="title">Invite not found</h1>
        </header>
        <main className="main">
          <p className="callout">This invite link isn&apos;t valid. Ask your friend to send it again.</p>
          <Link className="primary link-button" href="/">
            Go to the app
          </Link>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        heading={`Join ${preview.name}`}
        note={`You've been invited to ${preview.name}. Create an account or sign in to join.`}
      />
    );
  }

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">You&apos;re invited</div>
          <h1 className="title">{preview.name}</h1>
        </div>
      </header>
      <main className="main">
        {joined ? (
          <>
            <p className="callout">You&apos;re in. Welcome to {preview.name}.</p>
            <Link className="primary link-button" href="/">
              Open the app
            </Link>
          </>
        ) : (
          <>
            <p className="callout">
              {preview.member_count} {Number(preview.member_count) === 1 ? "member" : "members"} so far.
            </p>
            <button className="primary" type="button" onClick={join} disabled={busy}>
              {busy ? "Joining..." : `Join ${preview.name}`}
            </button>
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
