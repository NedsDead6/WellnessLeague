"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildNotifications, matchupResultText, unreadCount, type Notif, type NotifInput } from "./notifications";
import { supabase } from "./supabase";
import type { League } from "./types";
import { addDays, periodStart } from "./dates";
import { scoreMember, type LeagueMember } from "./league";
import { normalizeRules } from "./scoring";
import type { EntryMap } from "./history";
import { fetchOthers } from "./useLeagueData";

const POLL_MS = 60_000;
const key = (userId: string) => `wl:notif-read:${userId}`;

function loadRead(userId: string): string {
  try {
    const saved = window.localStorage.getItem(key(userId));
    if (saved) return saved;
    // First time on this device: start from now, so old activity doesn't show up as new.
    const now = new Date().toISOString();
    window.localStorage.setItem(key(userId), now);
    return now;
  } catch {
    return new Date().toISOString();
  }
}

/** In-app notifications across all of the person's leagues, with a count of unread ones. */
export interface MyData {
  ready: boolean;
  entries: EntryMap;
  shared: Record<string, string[]>;
  updatedAt: Record<string, string>;
}

const resultKey = (userId: string, leagueId: string, week: string) => `wl:notif-result:${userId}:${leagueId}:${week}`;

export function useNotifications(userId: string | undefined, leagues: League[], today: string, my: MyData) {
  const [items, setItems] = useState<Notif[]>([]);
  const [readAt, setReadAt] = useState<string>("");

  useEffect(() => {
    if (userId) setReadAt(loadRead(userId));
  }, [userId]);

  const leagueKey = leagues.map((l) => l.id).join(",");

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client || !userId || !today || leagues.length === 0) {
      setItems([]);
      return;
    }
    const ids = leagues.map((l) => l.id);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    try {
      const [members, dayR, feedR, mine, posts] = await Promise.all([
        client.from("league_members").select("user_id, profiles(display_name)").in("league_id", ids),
        client.from("league_reactions").select("league_id, reactor_id, day, emoji, created_at").in("league_id", ids).eq("target_user_id", userId).neq("reactor_id", userId).gte("created_at", since).limit(200),
        client.from("league_feed_reactions").select("league_id, item_key, reactor_id, emoji, created_at").in("league_id", ids).neq("reactor_id", userId).gte("created_at", since).limit(500),
        client.from("league_posts").select("id, body").in("league_id", ids).eq("user_id", userId).gte("created_at", since).limit(200),
        client.from("league_posts").select("id, league_id, user_id, body, created_at").in("league_id", ids).neq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(100),
      ]);
      const names: Record<string, string> = {};
      for (const row of ((members.data ?? []) as unknown as { user_id: string; profiles: { display_name?: string } | { display_name?: string }[] | null }[])) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        names[row.user_id] = profile?.display_name ?? "Someone";
      }
      // Last week's matchup result: worked out once per league and week, then remembered.
      const lastWeek = addDays(periodStart(today, "week"), -7);
      const results: NonNullable<NotifInput["results"]> = [];
      for (const l of leagues) {
        if (l.created_at && l.created_at.slice(0, 10) >= periodStart(today, "week")) continue;
        let text: string | null = null;
        try {
          text = window.localStorage.getItem(resultKey(userId, l.id, lastWeek));
        } catch {
          text = null;
        }
        if (text === null && my.ready) {
          try {
            const others = await fetchOthers(client, l.id, userId);
            const me: LeagueMember = {
              id: userId,
              name: "You",
              you: true,
              avatarUrl: null,
              entries: Object.fromEntries(Object.entries(my.entries).filter(([d]) => (my.shared[d] ?? []).includes(l.id))),
              updatedAt: {},
            };
            const rules = normalizeRules(l.scoring);
            const scored = [...others.map((o) => ({ id: o.id, name: o.name, you: false, avatarUrl: o.avatarUrl, entries: o.entries, updatedAt: o.updatedAt })), me].map((m) => scoreMember(m, rules));
            text = matchupResultText(scored, lastWeek) ?? "";
            try {
              window.localStorage.setItem(resultKey(userId, l.id, lastWeek), text);
            } catch {
              // Worked out again next time.
            }
          } catch {
            text = null;
          }
        }
        if (text) results.push({ leagueId: l.id, weekStart: lastWeek, text });
      }

      const input: NotifInput = {
        results,
        userId,
        today,
        leagues,
        names,
        dayReactions: (dayR.data ?? []) as unknown as NotifInput["dayReactions"],
        feedReactions: (feedR.data ?? []) as unknown as NotifInput["feedReactions"],
        myPosts: (mine.data ?? []) as unknown as NotifInput["myPosts"],
        posts: (posts.data ?? []) as unknown as NotifInput["posts"],
      };
      setItems(buildNotifications(input));
    } catch {
      // Notifications are a convenience; keep whatever we had.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, today, leagueKey, my.ready]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh]);

  const unread = useMemo(() => (readAt ? unreadCount(items, readAt) : 0), [items, readAt]);

  /** Marks everything as seen and returns the previous mark, so the list can still show what was new. */
  const markAllRead = useCallback(() => {
    const previous = readAt;
    const now = new Date().toISOString();
    setReadAt(now);
    if (userId) {
      try {
        window.localStorage.setItem(key(userId), now);
      } catch {
        // Fine: the badge just returns next visit.
      }
    }
    return previous;
  }, [readAt, userId]);

  return { items, unread, readAt, markAllRead, refresh };
}
