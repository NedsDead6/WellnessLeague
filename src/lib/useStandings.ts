"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, periodStart } from "./dates";
import { normalizeEntry } from "./history";
import { scoreDay } from "./scoring";
import { supabase } from "./supabase";

export interface MemberPoints {
  userId: string;
  name: string;
  today: number;
  week: number;
}

/**
 * Everyone else in a league and the points they shared with it, for today and
 * for the current week (Monday to today). Standings always use the standard
 * scoring, whatever custom scoring each person uses for their own stats.
 */
export function useStandings(leagueId: string | undefined, userId: string | undefined, today: string) {
  const [others, setOthers] = useState<MemberPoints[]>([]);
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

    const points = new Map<string, { today: number; week: number }>();
    for (const row of (rows.data ?? []) as any[]) {
      if (!sharedKeys.has(`${row.user_id}|${row.day}`)) continue;
      const total = scoreDay(normalizeEntry(row.entry), 0).total;
      const sum = points.get(row.user_id) ?? { today: 0, week: 0 };
      sum.week += total;
      if (row.day === today) sum.today += total;
      points.set(row.user_id, sum);
    }

    setOthers(
      members.map((m) => ({
        ...m,
        today: Math.round((points.get(m.userId)?.today ?? 0) * 1000) / 1000,
        week: Math.round((points.get(m.userId)?.week ?? 0) * 1000) / 1000,
      })),
    );
    setError(null);
    setLoaded(true);
  }, [leagueId, userId, today]);

  useEffect(() => {
    void load();
  }, [load]);

  return { others, loaded, error, reload: load };
}

/** The signed-in person's own points for a league, from entries already on this device. */
export function ownPoints(
  entries: Record<string, import("./scoring").DayEntry>,
  shared: Record<string, string[]>,
  leagueId: string,
  today: string,
) {
  const weekStart = periodStart(today, "week");
  let todayPoints = 0;
  let week = 0;
  for (let day = weekStart; day <= today; day = addDays(day, 1)) {
    const entry = entries[day];
    if (!entry || !(shared[day] ?? []).includes(leagueId)) continue;
    const total = scoreDay(entry, 0).total;
    week += total;
    if (day === today) todayPoints += total;
  }
  return { today: Math.round(todayPoints * 1000) / 1000, week: Math.round(week * 1000) / 1000 };
}
