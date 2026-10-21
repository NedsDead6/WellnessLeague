"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** The signed-in person's profile photo address (null when they haven't set one). */
export function useAvatar(userId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !userId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Before the photo migration is run the column doesn't exist; that just means no photo.
        if (!cancelled) setUrl(error ? null : ((data?.avatar_url as string | null | undefined) ?? null));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { url, setUrl };
}
