-- Applied 2026-11-19 via Supabase MCP ("brackets_teams_lobbies_v2" and "lock_brackets_and_cleanup").
alter table public.events add column if not exists teams jsonb;
alter table public.match_lobbies add column if not exists match_id uuid references public.matches(id) on delete set null;
update public.match_lobbies set status = 'expired' where status = 'waiting' and created_at < now() - interval '3 hours';
alter table public.match_lobbies drop constraint if exists match_lobbies_pin_key;
create unique index if not exists match_lobbies_open_pin on public.match_lobbies (pin) where status = 'waiting';
-- join_lobby(): now also requires the lobby to be opened within the last 3 hours (see function body in the database).

-- Brackets and teams are written only by the submit-match function
revoke insert, update on public.events from anon, authenticated;
grant insert (host_id, title, event_type, format, date_time, begin_date, end_date, region, location,
              min_dupr, max_dupr, max_players, entry_fee, status) on public.events to authenticated;
grant update (title, event_type, format, date_time, begin_date, end_date, region, location,
              min_dupr, max_dupr, max_players, entry_fee, status) on public.events to authenticated;

drop table if exists public.tournament_matches;
drop table if exists public.backup_20261119_profiles;
drop table if exists public.backup_20261119_matches;
