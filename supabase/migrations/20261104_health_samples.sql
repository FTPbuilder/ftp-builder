-- Échantillons de la nuit envoyés par le Raccourci (FC, fréquence respiratoire, VFC) : analyse par phase et par cycle
create table if not exists public.health_samples (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('hr','resp','hrv','spo2')),
  at timestamptz not null,
  value double precision not null,
  primary key (user_id, metric, at)
);
alter table public.health_samples enable row level security;
create policy "health_samples_select_own" on public.health_samples for select to authenticated using ((select auth.uid()) = user_id);
create policy "health_samples_delete_own" on public.health_samples for delete to authenticated using ((select auth.uid()) = user_id);
