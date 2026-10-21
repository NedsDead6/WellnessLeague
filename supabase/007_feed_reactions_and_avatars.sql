-- Milestone 7: emoji reactions on feed items, and profile photos.
-- Safe to run more than once. Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER the earlier files (schema.sql, 002 to 006).

-- Reactions on a feed item (a post or a highlight). item_key identifies the item.
create table if not exists public.league_feed_reactions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 300),
  reactor_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (league_id, item_key, reactor_id, emoji)
);

alter table public.league_feed_reactions enable row level security;

drop policy if exists "members see feed reactions" on public.league_feed_reactions;
create policy "members see feed reactions" on public.league_feed_reactions
  for select to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "members react to the feed" on public.league_feed_reactions;
create policy "members react to the feed" on public.league_feed_reactions
  for insert to authenticated
  with check (reactor_id = auth.uid() and public.is_league_member(league_id));

drop policy if exists "remove your own feed reactions" on public.league_feed_reactions;
create policy "remove your own feed reactions" on public.league_feed_reactions
  for delete to authenticated
  using (reactor_id = auth.uid());

-- Profile photo: the address of the picture, plus a public storage bucket for the files.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars are public" on storage.objects;
create policy "avatars are public" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "upload your own avatar" on storage.objects;
create policy "upload your own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "replace your own avatar" on storage.objects;
create policy "replace your own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete your own avatar" on storage.objects;
create policy "delete your own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
