-- Synchro Intervals.icu planifiée côté serveur : 9:30, 14:30 et 21:30 heure de Paris, pour tous les comptes reliés.
-- pg_cron appelle icu_scheduled_sync() toutes les 30 min ; la fonction ne lance la synchro que dans les créneaux (heure d'été/d'hiver gérée).
-- La clé partagée (cron_keys) n'est lisible que par le serveur (RLS sans règle) ; la fonction intervals la compare à l'en-tête x-cron-key.
create extension if not exists pg_cron;
create table if not exists public.cron_keys (name text primary key, value text not null);
alter table public.cron_keys enable row level security;
insert into public.cron_keys (name, value) values ('intervals', encode(gen_random_bytes(24), 'hex')) on conflict (name) do nothing;
create or replace function public.icu_scheduled_sync() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare t time := (now() at time zone 'Europe/Paris')::time;
begin
  if not (t between '09:25' and '09:40' or t between '14:25' and '14:40' or t between '21:25' and '21:40') then return; end if;
  perform net.http_post(
    url := 'https://jhemwfhmohqncywjixgh.supabase.co/functions/v1/intervals',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select value from public.cron_keys where name = 'intervals')),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.icu_scheduled_sync() from public, anon, authenticated;
select cron.schedule('icu-sync', '30 * * * *', 'select public.icu_scheduled_sync()');
