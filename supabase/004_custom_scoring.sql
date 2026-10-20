-- Milestone 4: personal scoring settings.
-- Safe to run more than once. Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Each person can customize the point values used for their own Personal stats.
-- Leagues always use the standard scoring, so nothing here is visible to league mates.

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  scoring jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "own settings full access" on public.user_settings;
create policy "own settings full access" on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
