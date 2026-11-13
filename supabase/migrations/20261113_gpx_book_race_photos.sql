-- Profil › Mes GPX : livre de traces ouvert aux amis, en lecture seule.
-- Les lignes n'existent que quand l'utilisateur a ouvert son livre (l'app les efface quand il le ferme) ;
-- un ami accepté peut les lire, personne d'autre que le propriétaire ne peut écrire.
create table public.gpx_book (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  track_id text not null check (char_length(track_id) between 1 and 40),
  data jsonb not null check (octet_length(data::text) < 400000),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);
alter table public.gpx_book enable row level security;
create policy gpx_book_select on public.gpx_book for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));
create policy gpx_book_insert on public.gpx_book for insert to authenticated with check (user_id = (select auth.uid()));
create policy gpx_book_update on public.gpx_book for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy gpx_book_delete on public.gpx_book for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.gpx_book from anon, authenticated;
grant select, insert, update, delete on public.gpx_book to authenticated;

-- Profil › Mes courses : photos (médaille, dossard, arrivée…) dans un espace privé, un dossier par compte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('race-photos', 'race-photos', false, 3145728, array['image/jpeg'])
  on conflict (id) do nothing;
create policy race_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy race_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy race_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy race_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'race-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
