-- Communauté : membres (pseudo), amis, défis partagés (FTP / renfo) et leurs participants.
-- Principe : un membre ne voit que ses amis, ses demandes d'amis et les participants de ses défis,
-- et seulement leur pseudo et leur progression dans le défi (jamais les séances ni la santé).

create table public.members (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  searchable boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.friendships (
  a uuid not null references auth.users on delete cascade,   -- demandeur
  b uuid not null references auth.users on delete cascade,   -- destinataire
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create unique index friendships_pair on public.friendships (least(a, b), greatest(a, b));
create index friendships_b on public.friendships (b);

create table public.shared_challenges (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('ftp', 'renfo')),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  unit text check (unit in ('min', 'reps')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date > start_date and end_date <= start_date + 200),
  check ((kind = 'renfo') = (unit is not null))
);

create table public.challenge_members (
  challenge_id uuid not null references public.shared_challenges on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined')),
  start_val numeric check (start_val is null or (start_val >= 0 and start_val < 100000)),
  goal numeric check (goal is null or (goal > 0 and goal < 100000)),
  progress numeric check (progress is null or (progress >= 0 and progress < 100000)),
  last_update date,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index challenge_members_user on public.challenge_members (user_id);

-- ---------- fonctions d'aide (security definer : évitent la récursion des règles) ----------
create or replace function public.is_friend(x uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and ((f.a = (select auth.uid()) and f.b = x) or (f.b = (select auth.uid()) and f.a = x)))
$$;
create or replace function public.has_friend_link(x uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
    where (f.a = (select auth.uid()) and f.b = x) or (f.b = (select auth.uid()) and f.a = x))
$$;
create or replace function public.in_challenge(c uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_members m where m.challenge_id = c and m.user_id = (select auth.uid()))
$$;
create or replace function public.shares_challenge(x uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_members m1 join public.challenge_members m2 on m2.challenge_id = m1.challenge_id
    where m1.user_id = (select auth.uid()) and m2.user_id = x)
$$;
create or replace function public.challenge_owner(c uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.owner from public.shared_challenges s where s.id = c
$$;

-- ---------- règles d'accès ----------
alter table public.members enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_challenges enable row level security;
alter table public.challenge_members enable row level security;

create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_friend_link(user_id) or public.shares_challenge(user_id));
create policy members_insert on public.members for insert to authenticated with check (user_id = (select auth.uid()));
create policy members_update on public.members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy members_delete on public.members for delete to authenticated using (user_id = (select auth.uid()));

create policy friendships_select on public.friendships for select to authenticated
  using (a = (select auth.uid()) or b = (select auth.uid()));
create policy friendships_insert on public.friendships for insert to authenticated
  with check (a = (select auth.uid()) and status = 'pending');
create policy friendships_update on public.friendships for update to authenticated
  using (b = (select auth.uid())) with check (b = (select auth.uid()) and status = 'accepted');
create policy friendships_delete on public.friendships for delete to authenticated
  using (a = (select auth.uid()) or b = (select auth.uid()));

create policy shared_select on public.shared_challenges for select to authenticated using (public.in_challenge(id));
create policy shared_delete on public.shared_challenges for delete to authenticated using (owner = (select auth.uid()));

create policy cm_select on public.challenge_members for select to authenticated using (public.in_challenge(challenge_id));
create policy cm_update on public.challenge_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cm_delete on public.challenge_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.challenge_owner(challenge_id) = (select auth.uid()));

-- droits par colonne : on ne peut pas changer les identifiants d'une ligne
revoke all on public.members, public.friendships, public.shared_challenges, public.challenge_members from anon, authenticated;
grant select, insert, delete on public.members to authenticated;
grant update (display_name, searchable, updated_at) on public.members to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
grant select, delete on public.shared_challenges to authenticated;
grant select, delete on public.challenge_members to authenticated;
grant update (status, start_val, goal, progress, last_update, updated_at) on public.challenge_members to authenticated;

-- ---------- RPC ----------
-- recherche par pseudo (membres qui acceptent d'être trouvés) avec la relation actuelle
create or replace function public.social_search(q text)
returns table (user_id uuid, display_name text, rel text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.display_name,
    coalesce((select case when f.status = 'accepted' then 'friend' when f.a = (select auth.uid()) then 'sent' else 'received' end
      from public.friendships f where (f.a = (select auth.uid()) and f.b = m.user_id) or (f.b = (select auth.uid()) and f.a = m.user_id) limit 1), 'none')
  from public.members m
  where (select auth.uid()) is not null and m.searchable and m.user_id <> (select auth.uid())
    and char_length(btrim(q)) >= 2 and m.display_name ilike '%' || replace(replace(btrim(q), '%', ''), '_', '') || '%'
  order by m.display_name limit 20
$$;

-- crée un défi, y inscrit son auteur et invite ses amis (les non-amis sont ignorés)
create or replace function public.social_create_challenge(p_kind text, p_name text, p_unit text, p_start date, p_end date,
  p_start_val numeric, p_goal numeric, p_invitees uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Non connecté'; end if;
  insert into public.shared_challenges (owner, kind, name, unit, start_date, end_date)
    values (me, p_kind, btrim(p_name), case when p_kind = 'renfo' then p_unit end, p_start, p_end) returning id into cid;
  insert into public.challenge_members (challenge_id, user_id, status, start_val, goal, progress, last_update)
    values (cid, me, 'joined', p_start_val, p_goal, case when p_kind = 'ftp' then p_start_val else 0 end, current_date);
  insert into public.challenge_members (challenge_id, user_id)
    select cid, x from unnest(coalesce(p_invitees, '{}')) x
    where x <> me and public.is_friend(x) on conflict do nothing;
  return cid;
end $$;

-- invite des amis dans un défi auquel on participe
create or replace function public.social_invite(p_challenge uuid, p_invitees uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from public.challenge_members m where m.challenge_id = p_challenge and m.user_id = auth.uid() and m.status = 'joined')
    then raise exception 'Tu ne participes pas à ce défi'; end if;
  insert into public.challenge_members (challenge_id, user_id)
    select p_challenge, x from unnest(coalesce(p_invitees, '{}')) x
    where x <> auth.uid() and public.is_friend(x) on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;

revoke all on function public.is_friend(uuid), public.has_friend_link(uuid), public.in_challenge(uuid), public.shares_challenge(uuid),
  public.challenge_owner(uuid), public.social_search(text), public.social_create_challenge(text, text, text, date, date, numeric, numeric, uuid[]),
  public.social_invite(uuid, uuid[]) from public, anon;
grant execute on function public.is_friend(uuid), public.has_friend_link(uuid), public.in_challenge(uuid), public.shares_challenge(uuid),
  public.challenge_owner(uuid), public.social_search(text), public.social_create_challenge(text, text, text, date, date, numeric, numeric, uuid[]),
  public.social_invite(uuid, uuid[]) to authenticated;

-- Les fonctions d'aide quittent le schéma exposé par l'API (appelables seulement par les règles et les RPC)
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.is_friend(uuid) set schema private;
alter function public.has_friend_link(uuid) set schema private;
alter function public.in_challenge(uuid) set schema private;
alter function public.shares_challenge(uuid) set schema private;
alter function public.challenge_owner(uuid) set schema private;
-- crée un défi, y inscrit son auteur et invite ses amis (les non-amis sont ignorés)
create or replace function public.social_create_challenge(p_kind text, p_name text, p_unit text, p_start date, p_end date,
  p_start_val numeric, p_goal numeric, p_invitees uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'Non connecté'; end if;
  insert into public.shared_challenges (owner, kind, name, unit, start_date, end_date)
    values (me, p_kind, btrim(p_name), case when p_kind = 'renfo' then p_unit end, p_start, p_end) returning id into cid;
  insert into public.challenge_members (challenge_id, user_id, status, start_val, goal, progress, last_update)
    values (cid, me, 'joined', p_start_val, p_goal, case when p_kind = 'ftp' then p_start_val else 0 end, current_date);
  insert into public.challenge_members (challenge_id, user_id)
    select cid, x from unnest(coalesce(p_invitees, '{}')) x
    where x <> me and private.is_friend(x) on conflict do nothing;
  return cid;
end $$;

-- invite des amis dans un défi auquel on participe
create or replace function public.social_invite(p_challenge uuid, p_invitees uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from public.challenge_members m where m.challenge_id = p_challenge and m.user_id = auth.uid() and m.status = 'joined')
    then raise exception 'Tu ne participes pas à ce défi'; end if;
  insert into public.challenge_members (challenge_id, user_id)
    select p_challenge, x from unnest(coalesce(p_invitees, '{}')) x
    where x <> auth.uid() and private.is_friend(x) on conflict do nothing;
  get diagnostics n = row_count; return n;
end $$;

