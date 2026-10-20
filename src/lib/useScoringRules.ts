"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_RULES, normalizeRules, type ScoringRules } from "./scoring";
import { supabase } from "./supabase";
import type { SaveStatus } from "./types";

const SAVE_DELAY_MS = 700;

/**
 * The signed-in person's own point values for their Personal stats. Falls back
 * to the standard rules, and works in memory when there is no database.
 */
export function useScoringRules(userId: string | undefined) {
  const [rules, setRules] = useState<ScoringRules>(DEFAULT_RULES);
  const [loaded, setLoaded] = useState(!supabase);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const latest = useRef<ScoringRules>(DEFAULT_RULES);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latest.current = DEFAULT_RULES;
    setRules(DEFAULT_RULES);
    setStatus("idle");
    setError(null);
    if (!supabase || !userId) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const client = supabase;
    let cancelled = false;
    (async () => {
      const { data, error: loadError } = await client
        .from("user_settings")
        .select("scoring")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (loadError) {
        setError(`Couldn't load your scoring settings: ${loadError.message}`);
      } else if (data) {
        latest.current = normalizeRules(data.scoring);
        setRules(latest.current);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(async () => {
    timer.current = null;
    if (!supabase || !userId) return;
    const { error: saveError } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, scoring: latest.current, updated_at: new Date().toISOString() });
    if (saveError) {
      setStatus("error");
      setError(saveError.message);
    } else {
      setError(null);
      setStatus("saved");
    }
  }, [userId]);

  const save = useCallback(
    (next: ScoringRules) => {
      latest.current = next;
      setRules(next);
      if (!supabase || !userId) return;
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void persist(), SAVE_DELAY_MS);
    },
    [userId, persist],
  );

  const reset = useCallback(() => save(DEFAULT_RULES), [save]);

  // Don't lose a change made just before the tab is closed or hidden.
  useEffect(() => {
    const flush = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [persist]);

  return { rules, loaded, status, error, save, reset };
}
