-- Erreurs JavaScript remontées par l'app (window.onerror / unhandledrejection).
-- Écriture seule pour l'utilisateur connecté, sur ses propres lignes ; lecture réservée au tableau de bord Supabase.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  app_version text check (char_length(app_version) <= 20),
  msg text not null check (char_length(msg) <= 500),
  stack text check (char_length(stack) <= 4000),
  where_ text check (char_length(where_) <= 200),
  ua text check (char_length(ua) <= 300)
);
create index if not exists client_errors_at on public.client_errors (at desc);
alter table public.client_errors enable row level security;
drop policy if exists "insert own errors" on public.client_errors;
create policy "insert own errors" on public.client_errors for insert to authenticated with check (user_id = (select auth.uid()));
