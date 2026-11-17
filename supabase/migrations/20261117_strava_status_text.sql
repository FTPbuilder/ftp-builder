-- Identifiants Strava 64 bits (juin 2027) : strava_status renvoie athlete_id en texte pour que l'app
-- ne l'arrondisse pas (un nombre JS n'est exact que jusqu'à 2^53). Les colonnes restent en bigint.
drop function if exists public.strava_status();
create function public.strava_status()
returns table(connected boolean, athlete_id text)
language sql security definer set search_path = '' stable as $$
  select true, t.athlete_id::text from public.strava_tokens t where t.user_id = (select auth.uid())
$$;
revoke all on function public.strava_status() from public, anon;
grant execute on function public.strava_status() to authenticated;
