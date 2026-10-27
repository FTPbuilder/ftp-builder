-- Sorties extérieures : dénivelé positif et vitesses (remplis par la synchro Intervals.icu / le Raccourci)
alter table public.health_workouts
  add column if not exists elevation_m double precision,
  add column if not exists avg_speed_kmh double precision,
  add column if not exists max_speed_kmh double precision;
