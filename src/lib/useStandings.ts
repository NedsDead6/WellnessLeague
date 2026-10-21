"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, periodStart } from "./dates";
import { normalizeEntry } from "./history";
import { scoreDay, type DayEntry, type DayScore } from "./scoring";
import { supabase } from "./supabase";

/** One member's shared days this week, each scored with the standard rules. */
export interface MemberDays {
  userId: string;
  name: string;
  days: Record<string, DayScore>;
}

/**
 * Everyone else in a league and the days they shared with it this week
 * (Monday to today), scored by category. Standings always use the standard
 * scoring, whatever custom scoring each person uses for their own stats.
 */
export function useStandings(leagueId: string | undefined, userId: string | undefined, today: string) {
  const [others, setOthers] = useState<MemberDays[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !leagueId || !userId) {
      setOthers([]);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const weekStart = periodStart(today, "week");

    const roster = await supabase
      .from("league_members")
      .select("user_id, profiles(display_name)")
      .eq("league_id", leagueId);
    if (roster.error) {
      setError(roster.error.message);
      setLoaded(true);
      return;
    }
    const members = ((roster.data ?? []) as any[])
      .filter((row) => row.user_id !== userId)
      .map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return { userId: row.user_id as string, name: (profile?.display_name as string | undefined) ?? "Member" };
      });
    if (members.length === 0) {
      setOthers([]);
      setError(null);
      setLoaded(true);
      return;
    }

    const shares = await supabase
      .from("entry_leagues")
      .select("user_id, day")
      .eq("league_id", leagueId)
      .gte("day", weekStart)
      .lte("day", today);
    if (shares.error) {
      setError(shares.error.message);
      setLoaded(true);
      return;
    }
    const sharedKeys = new Set(((shares.data ?? []) as any[]).map((row) => `${row.user_id}|${row.day}`));

    const rows = await supabase
      .from("daily_entries")
      .select("user_id, day, entry")
      .in(
        "user_id",
        members.map((m) => m.userId),
      )
      .gte("day", weekStart)
      .lte("day", today);
    if (rows.error) {
      setError(rows.error.message);
      setLoaded(true);
      return;
    }

    const byUser = new Map<string, Record<string, DayScore>>();
    for (const row of (rows.data ?? []) as any[]) {
      if (!sharedKeys.has(`${row.user_id}|${row.day}`)) continue;
      const days = byUser.get(row.user_id) ?? {};
      days[row.day as string] = scoreDay(normalizeEntry(row.entry), 0);
      byUser.set(row.user_id, days);
    }

    setOthers(members.map((m) => ({ ...m, days: byUser.get(m.userId) ?? {} })));
    setError(null);
    setLoaded(true);
  }, [leagueId, userId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  return { others, loaded, error, reload: load };
}

/** The signed-in person's own shared days for a league, from entries already on this device. */
export function ownDays(
  entries: Record<string, DayEntry>,
  shared: Record<string, string[]>,
  leagueId: string,
  today: string,
): Record<string, DayScore> {
  const days: Record<string, DayScore> = {};
  for (let day = periodStart(today, "week"); day <= today; day = addDays(day, 1)) {
    const entry = entries[day];
    if (entry && (shared[day] ?? []).includes(leagueId)) days[day] = scoreDay(entry, 0);
  }
  return days;
}
