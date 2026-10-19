-- Milestone 2: accounts, leagues and invite links.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Run it AFTER schema.sql.

-- 1. Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Player'
      ),
      40
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. The person who creates a league is automatically its first member.
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.league_members (league_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_league_created on public.leagues;
create trigger on_league_created
  after insert on public.leagues
  for each row execute function public.add_owner_as_member();

-- 3. Joining happens only through an invite code. Remove the open insert policy.
drop policy if exists "join as yourself" on public.league_members;

create or replace function public.join_league_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select id into target from public.leagues where invite_code = code;
  if target is null then
    raise exception 'Invite link not found';
  end if;
  insert into public.league_members (league_id, user_id)
  values (target, auth.uid())
  on conflict do nothing;
  return target;
end;
$$;

-- 4. The invite page shows the league name before the visitor signs in.
create or replace function public.league_preview(code text)
returns table (name text, member_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select l.name,
         (select count(*) from public.league_members m where m.league_id = l.id)
  from public.leagues l
  where l.invite_code = code;
$$;

revoke all on function public.join_league_by_code(text) from public;
grant execute on function public.join_league_by_code(text) to authenticated;
revoke all on function public.league_preview(text) from public;
grant execute on function public.league_preview(text) to anon, authenticated;
