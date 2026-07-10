-- TOS Display Manager — Bloc 6 Bons de travail V1

alter table public.bons_de_travail
  add column if not exists description text,
  add column if not exists created_by text,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists bons_de_travail_no_bt_unique
on public.bons_de_travail (no_bt)
where no_bt is not null and no_bt <> '';

create index if not exists bons_de_travail_statut_idx
on public.bons_de_travail (statut);

create index if not exists bons_de_travail_priorite_idx
on public.bons_de_travail (priorite);

create index if not exists bons_de_travail_assigne_a_idx
on public.bons_de_travail (assigne_a);

create index if not exists bons_de_travail_date_cible_idx
on public.bons_de_travail (date_cible);

alter table public.bons_de_travail enable row level security;

drop policy if exists "bt_authenticated_read" on public.bons_de_travail;
create policy "bt_authenticated_read"
on public.bons_de_travail
for select
to authenticated
using (true);

drop policy if exists "bt_authenticated_insert" on public.bons_de_travail;
create policy "bt_authenticated_insert"
on public.bons_de_travail
for insert
to authenticated
with check (true);

drop policy if exists "bt_authenticated_update" on public.bons_de_travail;
create policy "bt_authenticated_update"
on public.bons_de_travail
for update
to authenticated
using (true)
with check (true);

drop policy if exists "bt_admin_delete" on public.bons_de_travail;
create policy "bt_admin_delete"
on public.bons_de_travail
for delete
to authenticated
using (public.current_app_role() = 'Administrateur');
