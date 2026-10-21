-- Milestone 5: league reactions, team challenges and commissioner scoring.
-- Safe to run more than once. Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER the earlier files (schema.sql, 002, 003, 004).

-- A high-five (or other emoji) on someone's shared day, visible to the league.
create table if not exists public.league_reactions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  reactor_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (league_id, target_user_id, day, reactor_id, emoji)
);

alter table public.league_reactions enable row level security;

drop policy if exists "members see league reactions" on public.league_reactions;
create policy "members see league reactions" on public.league_reactions
  for select to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "members react as themselves" on public.league_reactions;
create policy "members react as themselves" on public.league_reactions
  for insert to authenticated
  with check (
    reactor_id = auth.uid()
    and public.is_league_member(league_id)
    and exists (
      select 1 from public.league_members m
      where m.league_id = league_reactions.league_id and m.user_id = league_reactions.target_user_id
    )
  );

drop policy if exists "remove your own reactions" on public.league_reactions;
create policy "remove your own reactions" on public.league_reactions
  for delete to authenticated
  using (reactor_id = auth.uid());

-- A goal the whole league works on together during one week (Monday start).
create table if not exists public.league_challenges (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  metric text not null check (metric in ('steps', 'exerciseMin', 'meditationMin', 'readingMin', 'worshipMin', 'serviceHours', 'points')),
  target numeric not null check (target > 0),
  week_start date not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.league_challenges enable row level security;

drop policy if exists "members see league challenges" on public.league_challenges;
create policy "members see league challenges" on public.league_challenges
  for select to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "owner manages league challenges" on public.league_challenges;
create policy "owner manages league challenges" on public.league_challenges
  for all to authenticated
  using (exists (select 1 from public.leagues l where l.id = league_id and l.owner_id = auth.uid()))
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.leagues l where l.id = league_id and l.owner_id = auth.uid())
  );

-- Commissioner scoring is stored in leagues.scoring (already in the schema), and the
-- existing "owner updates league" policy already lets only the owner change it.
