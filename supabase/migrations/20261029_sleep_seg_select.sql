-- l'app lit les phases de sommeil (hypnogramme) : lecture de ses propres segments
create policy "sleep_seg_select_own" on public.health_sleep_seg for select to authenticated using ((select auth.uid()) = user_id);
