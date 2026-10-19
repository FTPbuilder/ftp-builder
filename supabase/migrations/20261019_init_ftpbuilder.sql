-- Appliquée sur le projet jhemwfhmohqncywjixgh (FTPbuilder, eu-west-3)
create table public.user_state (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "user_state_select_own" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_state_insert_own" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_state_update_own" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_state_delete_own" on public.user_state for delete to authenticated using ((select auth.uid()) = user_id);

create table public.strava_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  athlete_id bigint unique not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now()
);
alter table public.strava_tokens enable row level security; -- aucune policy : service_role uniquement

create or replace function public.strava_status()
returns table(connected boolean, athlete_id bigint)
language sql security definer set search_path = '' stable as $$
  select true, t.athlete_id from public.strava_tokens t where t.user_id = (select auth.uid())
$$;
revoke all on function public.strava_status() from public, anon;
grant execute on function public.strava_status() to authenticated;

create table public.strava_inbox (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  strava_id bigint not null,
  activity jsonb not null,
  streams jsonb,
  imported boolean not null default false,
  received_at timestamptz not null default now(),
  unique (user_id, strava_id)
);
create index strava_inbox_user_pending on public.strava_inbox (user_id) where not imported;
alter table public.strava_inbox enable row level security;
create policy "inbox_select_own" on public.strava_inbox for select to authenticated using ((select auth.uid()) = user_id);
create policy "inbox_update_own" on public.strava_inbox for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "inbox_delete_own" on public.strava_inbox for delete to authenticated using ((select auth.uid()) = user_id);
