-- Tracés GPS des sorties extérieures (vue 3D), séparés de user_state pour ne pas alourdir la synchro.
-- Clé : départ de la sortie (epoch s) ; l'app retrouve le tracé d'une activité par son startTs (± 3 min).
create table if not exists public.activity_tracks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  start_ts bigint not null,
  source text,
  track jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, start_ts)
);
alter table public.activity_tracks enable row level security;
create policy "tracks_select_own" on public.activity_tracks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tracks_insert_own" on public.activity_tracks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tracks_update_own" on public.activity_tracks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tracks_delete_own" on public.activity_tracks for delete to authenticated using ((select auth.uid()) = user_id);
