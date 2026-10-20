"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

export function AuthScreen({ heading, note }: { heading?: string; note?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (error) setMessage(error.message);
      else if (!data.session) setMessage("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMessage(error.message);
    }
    setBusy(false);
  };

  return (
    <div className="shell">
      <header className="head">
        <div>
          <div className="kicker">Own Your Day</div>
          <h1 className="title">{heading ?? (mode === "signup" ? "Create your account" : "Welcome back")}</h1>
        </div>
      </header>

      <main className="main">
        {note && <p className="callout">{note}</p>}

        <div className="seg" role="group" aria-label="Sign up or sign in">
          <button aria-pressed={mode === "signup"} onClick={() => setMode("signup")} type="button">
            Sign up
          </button>
          <button aria-pressed={mode === "signin"} onClick={() => setMode("signin")} type="button">
            Sign in
          </button>
        </div>

        <form className="form" onSubmit={submit}>
          {mode === "signup" && (
            <label className="field">
              <span>Display name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                autoComplete="nickname"
                placeholder="What your friends will see"
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "One moment..." : mode === "signup" ? "Create account" : "Sign in"}
          </button>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
