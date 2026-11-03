-- Intervalles (laps) des séances course/natation, remplis par la synchro Intervals.icu, pour la recomposition de séance
create table if not exists public.workout_laps (
  user_id uuid not null references auth.users(id) on delete cascade,
  icu_id text not null,
  start_at timestamptz not null,
  sport text not null,
  laps jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, icu_id)
);
create index if not exists workout_laps_user_start on public.workout_laps (user_id, start_at);
alter table public.workout_laps enable row level security;
create policy "workout_laps select own" on public.workout_laps for select using (auth.uid() = user_id);
create policy "workout_laps delete own" on public.workout_laps for delete using (auth.uid() = user_id);
