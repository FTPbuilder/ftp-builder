-- Questionnaire d'avis dans l'app (accessibilité, fluidité) : chaque utilisateur envoie ses réponses (notes de 1 à 5 + commentaire libre) ;
-- l'admin les lit dans le tableau de bord Supabase. Un envoi par questionnaire et par utilisateur.
create table if not exists public.feedback_surveys (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  survey text not null check (char_length(survey) between 1 and 40),
  nav smallint not null check (nav between 1 and 5),        -- trouver ce qu'on cherche
  read smallint not null check (read between 1 and 5),      -- lisibilité
  smooth smallint not null check (smooth between 1 and 5),  -- fluidité
  daily smallint not null check (daily between 1 and 5),    -- usage au quotidien
  comment text check (char_length(comment) <= 1500),
  app_version text check (char_length(app_version) <= 20),
  device text check (char_length(device) <= 220),
  unique (user_id, survey)
);
create index if not exists feedback_surveys_at on public.feedback_surveys (at desc);
alter table public.feedback_surveys enable row level security;
drop policy if exists "insert own feedback" on public.feedback_surveys;
create policy "insert own feedback" on public.feedback_surveys for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "read own feedback" on public.feedback_surveys;
create policy "read own feedback" on public.feedback_surveys for select to authenticated using (user_id = (select auth.uid()));
