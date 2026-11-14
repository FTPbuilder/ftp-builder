-- Demandes d'ajout au catalogue du garage (cadre ou groupe absent) : l'utilisateur écrit et relit les siennes ;
-- l'admin les lit dans le tableau de bord Supabase et passe le statut à 'ajoute' ou 'refuse'.
create table if not exists public.bike_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  brand text not null check (char_length(brand) between 1 and 60),
  model text not null check (char_length(model) between 1 and 80),
  year text check (char_length(year) <= 20),
  groupset text check (char_length(groupset) <= 120),
  note text check (char_length(note) <= 300),
  app_version text check (char_length(app_version) <= 20),
  status text not null default 'nouveau' check (status in ('nouveau', 'ajoute', 'refuse'))
);
create index if not exists bike_requests_at on public.bike_requests (at desc);
alter table public.bike_requests enable row level security;
drop policy if exists "insert own bike requests" on public.bike_requests;
create policy "insert own bike requests" on public.bike_requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'nouveau');
drop policy if exists "read own bike requests" on public.bike_requests;
create policy "read own bike requests" on public.bike_requests for select to authenticated using (user_id = (select auth.uid()));
