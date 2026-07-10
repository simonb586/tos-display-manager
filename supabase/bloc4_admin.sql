alter table public.utilisateurs
  add column if not exists auth_user_id uuid,
  add column if not exists client_id bigint,
  add column if not exists updated_at timestamptz default now();

alter table public.clients
  add column if not exists updated_at timestamptz default now();

create unique index if not exists utilisateurs_courriel_unique
  on public.utilisateurs (lower(courriel))
  where courriel is not null and courriel <> '';

create unique index if not exists utilisateurs_auth_user_id_unique
  on public.utilisateurs (auth_user_id)
  where auth_user_id is not null;

create index if not exists utilisateurs_role_idx on public.utilisateurs (role);
create index if not exists utilisateurs_statut_idx on public.utilisateurs (statut);
create index if not exists utilisateurs_client_id_idx on public.utilisateurs (client_id);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.utilisateurs
  where auth_user_id = auth.uid()
  limit 1;
$$;

alter table public.utilisateurs enable row level security;
alter table public.clients enable row level security;

drop policy if exists "utilisateurs_admin_all" on public.utilisateurs;
create policy "utilisateurs_admin_all"
on public.utilisateurs
for all
to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists "utilisateurs_self_read" on public.utilisateurs;
create policy "utilisateurs_self_read"
on public.utilisateurs
for select
to authenticated
using (auth_user_id = auth.uid() or public.current_app_role() = 'Administrateur');

drop policy if exists "clients_admin_all" on public.clients;
create policy "clients_admin_all"
on public.clients
for all
to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists "clients_authenticated_read" on public.clients;
create policy "clients_authenticated_read"
on public.clients
for select
to authenticated
using (true);
