-- Applied to the Chình Supabase project on 2026-11-19 (already live; kept here for history).

-- Backups of ratings/matches before the new formula
create table if not exists public.backup_20261119_profiles as select * from public.profiles;
create table if not exists public.backup_20261119_matches as select * from public.matches;
alter table public.backup_20261119_profiles enable row level security;
alter table public.backup_20261119_matches enable row level security;
revoke all on public.backup_20261119_profiles, public.backup_20261119_matches from anon, authenticated;

-- Adaptive rating: per-player uncertainty and last activity
alter table public.profiles
  add column if not exists rating_rd numeric not null default 0.5,
  add column if not exists last_played_at timestamptz;

-- Match context + per-player rating changes
alter table public.matches
  add column if not exists context text not null default 'casual' check (context in ('casual','tournament')),
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists rating_changes jsonb,
  add column if not exists counted boolean not null default true;

-- Ratings are only written by the submit-match function (service role)
revoke insert, update on public.profiles from anon, authenticated;
grant update (email, region) on public.profiles to authenticated;
drop policy if exists "Authenticated users can create matches" on public.matches;
drop policy if exists "Authenticated users can update matches" on public.matches;
revoke insert, update, delete on public.matches from anon, authenticated;

-- The app writes events.host_id
alter table public.events rename column creator_id to host_id;
alter table public.events alter column host_id set default auth.uid();
