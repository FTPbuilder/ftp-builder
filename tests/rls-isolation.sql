-- Test d'isolation entre comptes (RLS) — à lancer dans l'éditeur SQL Supabase.
-- Crée 2 comptes fictifs A et B, donne des données à B dans chaque table, puis tente en A (connecté)
-- et en anonyme de lire / modifier / effacer / écrire au nom de B, et d'abuser des fonctions RPC.
-- Tout est annulé à la fin : l'exception finale renvoie le rapport et fait un ROLLBACK. Aucune donnée réelle n'est touchée.
do $t$
declare
  A uuid := 'aaaaaaaa-0000-4000-8000-00000000000a'; B uuid := 'bbbbbbbb-0000-4000-8000-00000000000b';
  r text := ''; n int; cB uuid; t text[]; who text; i int := 0; ins text;
  -- table | colonne propriétaire | insertion (%1$s = propriétaire, %2$s = nombre) | mise à jour
  tbl text[][] := array[
    ['user_state','user_id',$$(user_id,data) values ('%1$s','{}')$$,$$data='{}'$$],
    ['strava_tokens','user_id',$$(user_id,athlete_id,access_token,refresh_token,expires_at) values ('%1$s',%2$s,'t','r',now())$$,$$scope='x'$$],
    ['strava_inbox','user_id',$$(user_id,strava_id,activity) values ('%1$s',%2$s,'{}')$$,$$imported=true$$],
    ['ingest_tokens','user_id',$$(user_id,token_hash) values ('%1$s','h%2$s')$$,$$last_used_at=now()$$],
    ['health_daily','user_id',$$(user_id,day,metric,value) values ('%1$s','2026-01-01','hrv',%2$s)$$,$$value=2$$],
    ['health_sleep','user_id',$$(user_id,night,asleep_min) values ('%1$s','2026-01-01',%2$s)$$,$$asleep_min=1$$],
    ['health_workouts','user_id',$$(user_id,start_at,duration_min) values ('%1$s','2026-01-01',%2$s)$$,$$type='x'$$],
    ['health_sleep_seg','user_id',$$(user_id,start_at,end_at,stage,source) values ('%1$s','2026-01-01','2026-01-01 01:00','deep','s%2$s')$$,$$stage='rem'$$],
    ['intervals_accounts','user_id',$$(user_id,athlete_id,api_key) values ('%1$s','i%2$s','k')$$,$$athlete_name='x'$$],
    ['ext_inbox','user_id',$$(user_id,source,ext_id,activity) values ('%1$s','icu','e%2$s','{}')$$,$$imported=true$$],
    ['activity_tracks','user_id',$$(user_id,start_ts,track) values ('%1$s',%2$s,'{}')$$,$$source='x'$$],
    ['climb_names','user_id',$$(user_id,key) values ('%1$s','k%2$s')$$,$$name='x'$$],
    ['workout_laps','user_id',$$(user_id,icu_id,start_at,sport,laps) values ('%1$s','w%2$s',now(),'run','[]')$$,$$sport='x'$$],
    ['health_samples','user_id',$$(user_id,metric,at,value) values ('%1$s','hr',now(),%2$s)$$,$$value=1$$],
    ['members','user_id',$$(user_id,display_name,searchable) values ('%1$s','Testeur%2$s',false)$$,$$display_name='Pirate'$$],
    ['shared_challenges','owner',$$(owner,kind,name,unit,start_date,end_date) values ('%1$s','renfo','Defi%2$s','reps',current_date,current_date+30)$$,$$name='Pirate'$$],
    ['challenge_members','user_id','',$$progress=999$$]];
begin
  insert into auth.users(id,aud,role,email,instance_id) values
    (A,'authenticated','authenticated','isolation-a@test.invalid','00000000-0000-0000-0000-000000000000'),
    (B,'authenticated','authenticated','isolation-b@test.invalid','00000000-0000-0000-0000-000000000000');
  foreach t slice 1 in array tbl loop i := i + 1;
    if t[3] <> '' then execute format('insert into public.%I ', t[1]) || format(t[3], B, 900000 + i); end if; end loop;
  select id into cB from public.shared_challenges where owner = B;
  insert into public.challenge_members(challenge_id,user_id,status) values (cB,B,'joined');

  foreach who in array array['A','anon'] loop
    perform set_config('role', case when who = 'A' then 'authenticated' else 'anon' end, true);
    perform set_config('request.jwt.claims', case when who = 'A' then json_build_object('sub',A,'role','authenticated')::text else '{"role":"anon"}' end, true);
    perform set_config('request.jwt.claim.sub', case when who = 'A' then A::text else '' end, true);
    i := 0;
    foreach t slice 1 in array tbl loop i := i + 1;
      begin execute format('select count(*) from public.%I where %I = $1', t[1], t[2]) into n using B;
        r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s lit %s de B (%s)', who, t[1], n) || chr(10);
      exception when others then r := r || format('OK   %s lit %s de B (refusé %s)', who, t[1], sqlstate) || chr(10); end;
      begin execute format('update public.%I set %s where %I = $1', t[1], t[4], t[2]) using B; get diagnostics n = row_count;
        r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s modifie %s de B (%s)', who, t[1], n) || chr(10);
      exception when others then r := r || format('OK   %s modifie %s de B (refusé %s)', who, t[1], sqlstate) || chr(10); end;
      begin execute format('delete from public.%I where %I = $1', t[1], t[2]) using B; get diagnostics n = row_count;
        r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s efface %s de B (%s)', who, t[1], n) || chr(10);
      exception when others then r := r || format('OK   %s efface %s de B (refusé %s)', who, t[1], sqlstate) || chr(10); end;
      if t[3] <> '' then
        begin execute format('insert into public.%I ', t[1]) || format(t[3], B, 800000 + i);
          r := r || format('FAIL %s écrit dans %s au nom de B (accepté)', who, t[1]) || chr(10);
        exception when others then r := r || format('OK   %s écrit dans %s au nom de B (refusé %s)', who, t[1], sqlstate) || chr(10); end;
      end if;
    end loop;
    begin select count(*) into n from public.cron_keys; r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s lit cron_keys (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s lit cron_keys (refusé %s)', who, sqlstate) || chr(10); end;
    begin select count(*) into n from auth.users; r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s lit auth.users (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s lit auth.users (refusé %s)', who, sqlstate) || chr(10); end;
    -- fonctions RPC
    begin select count(*) into n from public.strava_status(); r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s strava_status (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s strava_status (refusé %s)', who, sqlstate) || chr(10); end;
    begin select count(*) into n from public.intervals_status(); r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s intervals_status (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s intervals_status (refusé %s)', who, sqlstate) || chr(10); end;
    begin select count(*) into n from public.ingest_status(); r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s ingest_status (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s ingest_status (refusé %s)', who, sqlstate) || chr(10); end;
    begin select count(*) into n from public.social_search('Testeur'); r := r || case when n = 0 then 'OK  ' else 'FAIL' end || format(' %s trouve B non-cherchable (%s)', who, n) || chr(10);
    exception when others then r := r || format('OK   %s trouve B non-cherchable (refusé %s)', who, sqlstate) || chr(10); end;
    begin perform public.social_invite(cB, array[A]); r := r || format('FAIL %s s''invite dans le défi de B', who) || chr(10);
    exception when others then r := r || format('OK   %s s''invite dans le défi de B (refusé %s)', who, sqlstate) || chr(10); end;
    begin insert into public.friendships(a,b,status) values (A,B,'accepted'); r := r || format('FAIL %s force une amitié acceptée', who) || chr(10);
    exception when others then r := r || format('OK   %s force une amitié acceptée (refusé %s)', who, sqlstate) || chr(10); end;
    begin insert into public.friendships(a,b,status) values (B,A,'pending'); r := r || format('FAIL %s demande d''ami au nom de B', who) || chr(10);
    exception when others then r := r || format('OK   %s demande d''ami au nom de B (refusé %s)', who, sqlstate) || chr(10); end;
    begin insert into public.challenge_members(challenge_id,user_id,status) values (cB,A,'joined'); r := r || format('FAIL %s s''ajoute au défi de B', who) || chr(10);
    exception when others then r := r || format('OK   %s s''ajoute au défi de B (refusé %s)', who, sqlstate) || chr(10); end;
    perform set_config('role', 'postgres', true);
  end loop;
  raise exception 'RAPPORT%', chr(10) || r;
end $t$;
