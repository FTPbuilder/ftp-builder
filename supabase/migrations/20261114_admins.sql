-- Comptes admin : lisent toutes les demandes d'ajout au catalogue et changent leur statut.
-- La table n'est modifiable que depuis le tableau de bord Supabase (aucune politique d'écriture) :
--   insert into public.admins (user_id) select id from auth.users where email = '<email admin>';
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin reads bike requests" on public.bike_requests;
create policy "admin reads bike requests" on public.bike_requests for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin updates bike requests" on public.bike_requests;
create policy "admin updates bike requests" on public.bike_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
