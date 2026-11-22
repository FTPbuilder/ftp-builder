-- Questionnaire d'avis dans l'app : chaque utilisateur envoie ses réponses (answers : notes de 1 à 5 et choix, en JSON) et ses suggestions ;
-- l'admin les lit dans l'app (Profil › boîte aux lettres 📮 › Avis) et les marque lues. Un envoi par questionnaire et par utilisateur.
create table if not exists public.feedback_surveys (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  survey text not null check (char_length(survey) between 1 and 40),
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 2000),
  comment text check (char_length(comment) <= 1500),          -- suggestions d'amélioration ou de modules
  who text check (char_length(who) <= 60),                    -- prénom du profil, pour l'admin
  app_version text check (char_length(app_version) <= 20),
  device text check (char_length(device) <= 220),
  seen boolean not null default false,                        -- lu par l'admin
  unique (user_id, survey)
);
create index if not exists feedback_surveys_at on public.feedback_surveys (at desc);
alter table public.feedback_surveys enable row level security;
drop policy if exists "insert own feedback" on public.feedback_surveys;
create policy "insert own feedback" on public.feedback_surveys for insert to authenticated with check (user_id = (select auth.uid()) and seen = false);
drop policy if exists "read own feedback" on public.feedback_surveys;
create policy "read own feedback" on public.feedback_surveys for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "admin reads feedback" on public.feedback_surveys;
create policy "admin reads feedback" on public.feedback_surveys for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin marks feedback seen" on public.feedback_surveys;
create policy "admin marks feedback seen" on public.feedback_surveys for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
