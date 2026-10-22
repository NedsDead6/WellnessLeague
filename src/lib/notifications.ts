import { addDays, periodLabel, periodStart } from "./dates";

const weekOf = (day: string) => periodStart(day, "week");

export interface NotifTarget {
  section: "matchups" | "feed" | "awards";
  /** Monday of the week to open (matchups and awards). */
  weekStart?: string;
  /** A specific day to open in matchups. */
  day?: string;
}

export interface Notif {
  id: string;
  kind: "reaction" | "post" | "week";
  leagueId: string;
  leagueName: string;
  /** ISO time, used for ordering and for deciding what is new. */
  at: string;
  text: string;
  target: NotifTarget;
}

export interface NotifInput {
  userId: string;
  today: string;
  leagues: { id: string; name: string; created_at?: string }[];
  names: Record<string, string>;
  /** Emoji on one of your shared days. */
  dayReactions: { league_id: string; reactor_id: string; day: string; emoji: string; created_at: string }[];
  /** Emoji on feed items (the item key says whose it is). */
  feedReactions: { league_id: string; item_key: string; reactor_id: string; emoji: string; created_at: string }[];
  myPosts: { id: string; body: string }[];
  /** Posts people other than you wrote. */
  posts: { id: string; league_id: string; user_id: string; body: string; created_at: string }[];
}

const clip = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What happened that the person might want to know about, newest first. */
export function buildNotifications(input: NotifInput): Notif[] {
  const { userId, today, leagues, names, myPosts } = input;
  const leagueName = (id: string) => leagues.find((l) => l.id === id)?.name ?? "your league";
  const who = (id: string) => names[id] ?? "Someone";
  const out: Notif[] = [];

  for (const r of input.dayReactions) {
    if (r.reactor_id === userId) continue;
    out.push({
      id: `r-${r.league_id}-${r.reactor_id}-${r.day}-${r.emoji}`,
      kind: "reaction",
      leagueId: r.league_id,
      leagueName: leagueName(r.league_id),
      at: r.created_at,
      text: `${who(r.reactor_id)} reacted ${r.emoji} to your ${r.day === today ? "day today" : periodLabel(r.day, "day")}`,
      target: { section: "matchups", weekStart: weekOf(r.day), day: r.day },
    });
  }

  const myPostBody = new Map(myPosts.map((p) => [`p-${p.id}`, p.body]));
  for (const r of input.feedReactions) {
    if (r.reactor_id === userId) continue;
    let what: string | null = null;
    if (myPostBody.has(r.item_key)) what = `your post "${clip(myPostBody.get(r.item_key) ?? "", 40)}"`;
    else if (r.item_key.startsWith(`${userId}-`)) {
      const rest = r.item_key.slice(userId.length + 1);
      what = `your highlight (${clip(rest.slice(11), 40)})`;
    }
    if (!what) continue;
    out.push({
      id: `fr-${r.league_id}-${r.item_key}-${r.reactor_id}-${r.emoji}`,
      kind: "reaction",
      leagueId: r.league_id,
      leagueName: leagueName(r.league_id),
      at: r.created_at,
      text: `${who(r.reactor_id)} reacted ${r.emoji} to ${what}`,
      target: { section: "feed" },
    });
  }

  for (const p of input.posts) {
    if (p.user_id === userId) continue;
    out.push({
      id: `p-${p.id}`,
      kind: "post",
      leagueId: p.league_id,
      leagueName: leagueName(p.league_id),
      at: p.created_at,
      text: `${who(p.user_id)} posted: ${clip(p.body)}`,
      target: { section: "feed" },
    });
  }

  // Each league's last finished week, posted when the new week starts.
  const thisWeek = weekOf(today);
  const lastWeek = addDays(thisWeek, -7);
  for (const l of leagues) {
    if (l.created_at && l.created_at.slice(0, 10) >= thisWeek) continue;
    out.push({
      id: `w-${l.id}-${lastWeek}`,
      kind: "week",
      leagueId: l.id,
      leagueName: l.name,
      at: `${thisWeek}T00:00:00`,
      text: `Week of ${periodLabel(lastWeek, "week")} is final. See the awards`,
      target: { section: "awards", weekStart: lastWeek },
    });
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 50);
}

/** How many notifications are newer than the last time the person looked. */
export function unreadCount(items: Notif[], readAt: string): number {
  const t = Date.parse(readAt);
  return items.filter((n) => !Number.isFinite(t) || Date.parse(n.at) > t).length;
}
