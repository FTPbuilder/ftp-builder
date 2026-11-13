-- Profil › GARAGE : modèle 3D (.glb) et film (.mp4) de chaque vélo, dans un espace privé (un dossier par compte).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('garage-media', 'garage-media', false, 52428800, array['model/gltf-binary', 'application/octet-stream', 'video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do nothing;
create policy garage_media_select on storage.objects for select to authenticated
  using (bucket_id = 'garage-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy garage_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'garage-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy garage_media_update on storage.objects for update to authenticated
  using (bucket_id = 'garage-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'garage-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy garage_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'garage-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
