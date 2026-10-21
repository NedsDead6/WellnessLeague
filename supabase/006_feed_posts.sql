-- Milestone 6: messages (with emojis) that members post to a league's feed.
-- Safe to run more than once. Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER the earlier files (schema.sql, 002 to 005).
-- Exercise notes, calls and the other new categories need no database change: they are saved inside each day's entry.

create table if not exists public.league_posts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists league_posts_league_idx on public.league_posts (league_id, created_at desc);

alter table public.league_posts enable row level security;

drop policy if exists "members see league posts" on public.league_posts;
create policy "members see league posts" on public.league_posts
  for select to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "members post as themselves" on public.league_posts;
create policy "members post as themselves" on public.league_posts
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_league_member(league_id));

drop policy if exists "delete your own posts" on public.league_posts;
create policy "delete your own posts" on public.league_posts
  for delete to authenticated
  using (user_id = auth.uid());
