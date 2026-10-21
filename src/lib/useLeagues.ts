"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { League } from "./types";

/** The leagues the signed-in person belongs to. */
export function useLeagues(userId: string | undefined) {
  const [leagues, setLeagues] = useState<League[]>([]);

  const reload = useCallback(async () => {
    if (!supabase || !userId) {
      setLeagues([]);
      return;
    }
    const { data, error } = await supabase
      .from("league_members")
      .select("leagues(id, name, invite_code, owner_id, scoring, created_at)")
      .eq("user_id", userId);
    if (error) return;
    const rows = (data ?? []) as unknown as { leagues: League | null }[];
    setLeagues(rows.map((row) => row.leagues).filter((l): l is League => l !== null));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { leagues, reload };
}
