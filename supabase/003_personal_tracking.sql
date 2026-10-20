-- Milestone 3: personal tracking, and choosing which leagues count each day.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER schema.sql and 002_leagues_and_invites.sql.

-- Every saved day always counts toward the person's own stats (daily_entries).
-- This table records which leagues a given day ALSO counts toward.
create table public.entry_leagues (
  user_id uuid not null,
  day date not null,
  league_id uuid not null references public.leagues (id) on delete cascade,
  primary key (user_id, day, league_id),
  foreign key (user_id, day) references public.daily_entries (user_id, day) on delete cascade
);

alter table public.entry_leagues enable row level security;

create policy "manage your own shares, only for leagues you are in" on public.entry_leagues
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_league_member(league_id));

create policy "league members see what was shared with the league" on public.entry_leagues
  for select to authenticated
  using (public.is_league_member(league_id));

-- Privacy: the first schema let league mates read ALL of each other's days.
-- Replace that so mates can only read days that were shared with a league
-- they are both in. Everything else stays personal.
drop policy if exists "league mates see each other's entries" on public.daily_entries;

create policy "entries shared with a common league" on public.daily_entries
  for select to authenticated
  using (
    exists (
      select 1
      from public.entry_leagues el
      where el.user_id = daily_entries.user_id
        and el.day = daily_entries.day
        and public.is_league_member(el.league_id)
    )
  );
