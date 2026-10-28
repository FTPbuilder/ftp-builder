-- Noms des ascensions calculés en tâche de fond par la fonction climb-names (Photon / OpenStreetMap).
-- Clé : position du sommet arrondie (« lat,lon » à 3 décimales). Lecture par l'utilisateur, écriture par le serveur (service_role).
create table if not exists public.climb_names (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name text,
  error text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.climb_names enable row level security;
create policy "climb_names_select_own" on public.climb_names for select to authenticated using ((select auth.uid()) = user_id);
