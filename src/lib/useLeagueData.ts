"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAll } from "./fetchAll";
import { normalizeEntry } from "./history";
import type { Challenge, FeedReaction, Post, Reaction } from "./league";
import type { DayEntry } from "./scoring";
import { supabase } from "./supabase";

export interface OtherMember {
  id: string;
  name: string;
  joinedAt: string;
  avatarUrl: string | null;
  /** Days this person shared with the league. */
  entries: Record<string, DayEntry>;
  /** When each shared day was last saved. */
  updatedAt: Record<string, string>;
}

/** The other members of a league and every day they shared with it. */
export async function fetchOthers(client: NonNullable<typeof supabase>, leagueId: string, userId: string): Promise<OtherMember[]> {
  let roster: { data: any[] | null; error: { message: string } | null } = await client
    .from("league_members")
    .select("user_id, joined_at, profiles(display_name, avatar_url)")
    .eq("league_id", leagueId);
  // Before the photo migration is run the column is missing; load the roster without photos instead.
  if (roster.error && /avatar_url/.test(roster.error.message))
    roster = await client.from("league_members").select("user_id, joined_at, profiles(display_name)").eq("league_id", leagueId);
  if (roster.error) throw new Error(roster.error.message);
  const members = ((roster.data ?? []) as any[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.user_id as string,
      name: (profile?.display_name as string | undefined) ?? "Member",
      joinedAt: (row.joined_at as string | undefined) ?? "",
      avatarUrl: (profile?.avatar_url as string | null | undefined) ?? null,
    };
  });
  const others = members.filter((m) => m.id !== userId);

  const shares = await fetchAll((from, to) =>
    client.from("entry_leagues").select("user_id, day").eq("league_id", leagueId).order("day").range(from, to),
  );
  const sharedKeys = new Set(shares.map((row) => `${row.user_id}|${row.day}`));
  const otherIds = new Set(others.map((m) => m.id));
  const firstDay = shares.filter((row) => otherIds.has(row.user_id)).map((row) => row.day as string).sort()[0];

  const byUser = new Map<string, Record<string, DayEntry>>();
  const stamps = new Map<string, Record<string, string>>();
  if (others.length > 0 && firstDay) {
    const rows = await fetchAll((from, to) =>
      client
        .from("daily_entries")
        .select("user_id, day, entry, updated_at")
        .in(
          "user_id",
          others.map((m) => m.id),
        )
        .gte("day", firstDay)
        .order("day")
        .range(from, to),
    );
    for (const row of rows) {
      if (!sharedKeys.has(`${row.user_id}|${row.day}`)) continue;
      const days = byUser.get(row.user_id) ?? {};
      days[row.day as string] = normalizeEntry(row.entry);
      byUser.set(row.user_id, days);
      if (row.updated_at) stamps.set(row.user_id, { ...(stamps.get(row.user_id) ?? {}), [row.day as string]: row.updated_at as string });
    }
  }

  return others.map((m) => ({ ...m, entries: byUser.get(m.id) ?? {}, updatedAt: stamps.get(m.id) ?? {} }));
}

/**
 * Everything about one league beyond the signed-in person's own days: the
 * other members and every day they shared with it, plus reactions and the
 * commissioner's team challenges.
 */
export function useLeagueData(leagueId: string | undefined, userId: string | undefined) {
  const [others, setOthers] = useState<OtherMember[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedReactions, setFeedReactions] = useState<FeedReaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !leagueId || !userId) {
      setOthers([]);
      setLoaded(true);
      return;
    }
    const client = supabase;
    setLoaded(false);
    try {
      const othersFull = await fetchOthers(client, leagueId, userId);
      const reactionRows = await fetchAll((from, to) =>
        client.from("league_reactions").select("id, league_id, target_user_id, day, reactor_id, emoji, created_at").eq("league_id", leagueId).order("created_at").range(from, to),
      );
      // Posts are optional: if the feed migration hasn't been run yet, the rest of the league still loads.
      const postRows = await client
        .from("league_posts")
        .select("id, league_id, user_id, body, created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: false })
        .limit(200);
      const feedReactionRows = await client
        .from("league_feed_reactions")
        .select("id, league_id, item_key, reactor_id, emoji")
        .eq("league_id", leagueId)
        .limit(2000);
      const challengeRows = await client.from("league_challenges").select("id, metric, target, week_start").eq("league_id", leagueId);
      if (challengeRows.error) throw new Error(challengeRows.error.message);

      setOthers(othersFull);
      setReactions(reactionRows as Reaction[]);
      setPosts(postRows.error ? [] : ((postRows.data ?? []) as unknown as Post[]));
      setFeedReactions(feedReactionRows.error ? [] : ((feedReactionRows.data ?? []) as unknown as FeedReaction[]));
      setChallenges(((challengeRows.data ?? []) as any[]).map((c) => ({ ...c, target: Number(c.target) })) as Challenge[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the league.");
    }
    setLoaded(true);
  }, [leagueId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Adds your emoji to someone's day, or takes it back if it's already there. */
  const toggleReaction = useCallback(
    async (targetId: string, day: string, emoji: string) => {
      if (!supabase || !leagueId || !userId) return;
      const mine = reactions.find(
        (r) => r.reactor_id === userId && r.target_user_id === targetId && r.day === day && r.emoji === emoji,
      );
      if (mine) {
        setReactions((all) => all.filter((r) => r !== mine));
        const { error: failed } = await supabase.from("league_reactions").delete().eq("id", mine.id);
        if (failed) setError(failed.message);
      } else {
        const fresh: Reaction = { league_id: leagueId, target_user_id: targetId, day, reactor_id: userId, emoji, created_at: new Date().toISOString() };
        setReactions((all) => [...all, fresh]);
        const { data, error: failed } = await supabase
          .from("league_reactions")
          .insert({ league_id: leagueId, target_user_id: targetId, day, reactor_id: userId, emoji })
          .select("id")
          .single();
        if (failed) {
          setError(failed.message);
          setReactions((all) => all.filter((r) => r !== fresh));
        } else if (data) {
          setReactions((all) => all.map((r) => (r === fresh ? { ...r, id: data.id as string } : r)));
        }
      }
    },
    [leagueId, userId, reactions],
  );

  /** Posts a message to the feed. Returns an error message, or null on success. */
  const addPost = useCallback(
    async (body: string): Promise<string | null> => {
      const text = body.trim();
      if (!supabase || !leagueId || !userId || !text) return null;
      const { data, error: failed } = await supabase
        .from("league_posts")
        .insert({ league_id: leagueId, user_id: userId, body: text })
        .select("id, league_id, user_id, body, created_at")
        .single();
      if (failed || !data) return failed?.message ?? "Couldn't post.";
      setPosts((all) => [data as unknown as Post, ...all]);
      return null;
    },
    [leagueId, userId],
  );

  const deletePost = useCallback(
    async (id: string) => {
      if (!supabase) return;
      setPosts((all) => all.filter((p) => p.id !== id));
      const { error: failed } = await supabase.from("league_posts").delete().eq("id", id);
      if (failed) setError(failed.message);
    },
    [],
  );

  /** Adds your emoji to a feed item, or takes it back if it's already there. Returns an error message or null. */
  const toggleFeedReaction = useCallback(
    async (itemKey: string, emoji: string): Promise<string | null> => {
      if (!supabase || !leagueId || !userId) return null;
      const mine = feedReactions.find((r) => r.reactor_id === userId && r.item_key === itemKey && r.emoji === emoji);
      if (mine) {
        setFeedReactions((all) => all.filter((r) => r !== mine));
        const { error: failed } = await supabase.from("league_feed_reactions").delete().eq("id", mine.id);
        return failed ? failed.message : null;
      }
      const fresh: FeedReaction = { league_id: leagueId, item_key: itemKey, reactor_id: userId, emoji };
      setFeedReactions((all) => [...all, fresh]);
      const { data, error: failed } = await supabase
        .from("league_feed_reactions")
        .insert({ league_id: leagueId, item_key: itemKey, reactor_id: userId, emoji })
        .select("id")
        .single();
      if (failed) {
        setFeedReactions((all) => all.filter((r) => r !== fresh));
        return failed.message;
      }
      if (data) setFeedReactions((all) => all.map((r) => (r === fresh ? { ...r, id: data.id as string } : r)));
      return null;
    },
    [leagueId, userId, feedReactions],
  );

  return { others, reactions, challenges, posts, feedReactions, toggleFeedReaction, loaded, error, reload: load, toggleReaction, addPost, deletePost };
}
