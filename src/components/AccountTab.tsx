"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { isDefaultRules, type ScoringRules } from "@/lib/scoring";
import { squareJpeg } from "@/lib/avatarImage";
import { supabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";

interface Props {
  session: Session | null;
  rules: ScoringRules;
  onResetScoring: () => void;
  onOpenScoring: () => void;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}

export function AccountTab({ session, rules, onResetScoring, onOpenScoring, avatarUrl, onAvatarChange }: Props) {
  const userId = session?.user.id;
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);

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

  const choosePhoto = async (file: File | undefined) => {
    if (!supabase || !userId || !file) return;
    setPhotoBusy(true);
    setPhotoMessage(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose a picture.");
      const blob = await squareJpeg(file);
      const path = `${userId}/avatar.jpg`;
      const up = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
      if (up.error) throw new Error(up.error.message);
      const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
      const saved = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (saved.error) throw new Error(saved.error.message);
      onAvatarChange(url);
      setPhotoMessage("Photo updated.");
    } catch (e) {
      setPhotoMessage(e instanceof Error ? e.message : "Couldn't upload that photo.");
    }
    setPhotoBusy(false);
  };

  const removePhoto = async () => {
    if (!supabase || !userId) return;
    setPhotoBusy(true);
    setPhotoMessage(null);
    await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
    const saved = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (saved.error) setPhotoMessage(saved.error.message);
    else {
      onAvatarChange(null);
      setPhotoMessage("Photo removed.");
    }
    setPhotoBusy(false);
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
        <div className="photo-row">
          <Avatar name={name || session.user.email || "?"} url={avatarUrl} size={72} />
          <div className="photo-actions">
            <label className={`secondary file-button ${photoBusy ? "disabled" : ""}`}>
              {photoBusy ? "Uploading..." : avatarUrl ? "Change photo" : "Upload a photo"}
              <input
                type="file"
                accept="image/*"
                disabled={photoBusy}
                onChange={(e) => {
                  void choosePhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {avatarUrl && (
              <button className="text-button" type="button" disabled={photoBusy} onClick={() => void removePhoto()}>
                Remove photo
              </button>
            )}
          </div>
        </div>
        {photoMessage && (
          <p className="demo-note" role="status">
            {photoMessage}
          </p>
        )}
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
            Custom point values only change your Personal stats. Each league uses its own scoring, set by the league owner.
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
