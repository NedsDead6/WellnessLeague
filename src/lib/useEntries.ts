"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeEntry, streakAt, type EntryMap } from "./history";
import { scoreDay, type DayEntry } from "./scoring";
import { fetchAll } from "./fetchAll";
import { supabase } from "./supabase";
import type { SaveStatus } from "./types";

const SAVE_DELAY_MS = 700;

/**
 * Every saved day for the signed-in person, plus which leagues each day also
 * counts toward. Changes show up instantly and save to the database a moment
 * later. Without a database connection it works in memory only.
 */
export function useEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<EntryMap>({});
  const [shared, setShared] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(!supabase);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const entriesRef = useRef<EntryMap>({});
  const sharedRef = useRef<Record<string, string[]>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    entriesRef.current = {};
    sharedRef.current = {};
    setEntries({});
    setShared({});
    setError(null);
    setStatus("idle");
    if (!supabase || !userId) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const client = supabase;
    let cancelled = false;
    (async () => {
      try {
        const entryRows = await fetchAll((from, to) =>
          client.from("daily_entries").select("day, entry").eq("user_id", userId).order("day").range(from, to),
        );
        const shareRows = await fetchAll((from, to) =>
          client.from("entry_leagues").select("day, league_id").eq("user_id", userId).order("day").range(from, to),
        );
        if (cancelled) return;
        const entryMap: EntryMap = {};
        for (const row of entryRows) entryMap[row.day as string] = normalizeEntry(row.entry);
        const shareMap: Record<string, string[]> = {};
        for (const row of shareRows) (shareMap[row.day as string] ??= []).push(row.league_id as string);
        entriesRef.current = entryMap;
        sharedRef.current = shareMap;
        setEntries(entryMap);
        setShared(shareMap);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your entries.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (day: string) => {
      timers.current.delete(day);
      if (!supabase || !userId) return;
      const entry = entriesRef.current[day];
      if (!entry) return;
      const leagueIds = sharedRef.current[day] ?? [];
      const total = scoreDay(entry, streakAt(entriesRef.current, day)).total;

      const fail = (message: string) => {
        setStatus("error");
        setError(message);
      };

      const saved = await supabase
        .from("daily_entries")
        .upsert({ user_id: userId, day, entry, total, updated_at: new Date().toISOString() });
      if (saved.error) return fail(saved.error.message);

      const cleared = await supabase.from("entry_leagues").delete().eq("user_id", userId).eq("day", day);
      if (cleared.error) return fail(cleared.error.message);

      if (leagueIds.length > 0) {
        const shares = await supabase
          .from("entry_leagues")
          .insert(leagueIds.map((league_id) => ({ user_id: userId, day, league_id })));
        if (shares.error) return fail(shares.error.message);
      }

      setError(null);
      if (timers.current.size === 0) setStatus("saved");
    },
    [userId],
  );

  /** Records a day's entry and which leagues it counts toward. */
  const save = useCallback(
    (day: string, entry: DayEntry, leagueIds: string[]) => {
      entriesRef.current = { ...entriesRef.current, [day]: entry };
      sharedRef.current = { ...sharedRef.current, [day]: leagueIds };
      setEntries(entriesRef.current);
      setShared(sharedRef.current);
      if (!supabase || !userId) return;
      setStatus("saving");
      const pending = timers.current.get(day);
      if (pending) clearTimeout(pending);
      timers.current.set(
        day,
        setTimeout(() => {
          void persist(day);
        }, SAVE_DELAY_MS),
      );
    },
    [userId, persist],
  );

  // Don't lose a change made just before the tab is closed or hidden.
  useEffect(() => {
    const flush = () => {
      for (const [day, timer] of Array.from(timers.current.entries())) {
        clearTimeout(timer);
        void persist(day);
      }
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

  return { entries, shared, loaded, status, error, save };
}
