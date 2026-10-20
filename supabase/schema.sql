-- Own Your Day database schema (Supabase / Postgres).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is not used by the app yet; milestone 2 (accounts and leagues) connects to it.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid not null references public.profiles (id),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  -- Commissioner-editable scoring overrides. Empty means the default table.
  scoring jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- One row per person per day. The raw entries are stored so scores can be
-- recomputed if a league changes its scoring rules.
create table public.daily_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  entry jsonb not null,
  total numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Row level security: people only see what they should.
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.daily_entries enable row level security;

create or replace function public.is_league_member(target_league uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = target_league and user_id = auth.uid()
  );
$$;

create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid());

create policy "members read their leagues" on public.leagues
  for select to authenticated using (public.is_league_member(id) or owner_id = auth.uid());
create policy "anyone signed in can create a league" on public.leagues
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates league" on public.leagues
  for update to authenticated using (owner_id = auth.uid());

create policy "members see league roster" on public.league_members
  for select to authenticated using (public.is_league_member(league_id));
create policy "join as yourself" on public.league_members
  for insert to authenticated with check (user_id = auth.uid());
create policy "leave a league" on public.league_members
  for delete to authenticated using (user_id = auth.uid());

create policy "own entries full access" on public.daily_entries
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "league mates see each other's entries" on public.daily_entries
  for select to authenticated using (
    exists (
      select 1
      from public.league_members mine
      join public.league_members theirs on theirs.league_id = mine.league_id
      where mine.user_id = auth.uid() and theirs.user_id = daily_entries.user_id
    )
  );
