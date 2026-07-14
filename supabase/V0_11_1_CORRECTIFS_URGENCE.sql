-- TOS Display Manager — v0.11.1 Correctifs d'urgence
-- Studio des relations complet : toutes les tables et tous les champs.

create or replace function public.list_public_schema_fields()
returns table(
  table_name text,
  column_name text,
  data_type text,
  ordinal_position integer
)
language sql
security definer
set search_path = public, information_schema
as $$
  select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.ordinal_position
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name not in (
      'schema_migrations',
      'spatial_ref_sys'
    )
  order by c.table_name, c.ordinal_position;
$$;

grant execute on function public.list_public_schema_fields()
to authenticated;

alter table public.relation_fields enable row level security;
alter table public.relation_rules enable row level security;

drop policy if exists "relation_fields_admin_all" on public.relation_fields;
create policy "relation_fields_admin_all"
on public.relation_fields
for all
to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists "relation_rules_admin_all" on public.relation_rules;
create policy "relation_rules_admin_all"
on public.relation_rules
for all
to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

grant select, insert, update, delete on public.relation_fields to authenticated;
grant select, insert, update, delete on public.relation_rules to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Inscrire tous les champs existants sans écraser les configurations déjà enregistrées.
insert into public.relation_fields(
  module_name,
  table_name,
  field_name,
  field_label,
  is_primary_source,
  triggers_updates,
  visible_terrain,
  terrain_roles,
  terrain_readonly,
  validation_status,
  updated_at
)
select
  initcap(replace(c.table_name, '_', ' ')),
  c.table_name,
  c.column_name,
  initcap(replace(c.column_name, '_', ' ')),
  true,
  false,
  false,
  '{}'::text[],
  true,
  'À confirmer',
  now()
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name not in (
    'schema_migrations',
    'spatial_ref_sys',
    'relation_fields',
    'relation_rules'
  )
on conflict(table_name, field_name) do nothing;

create or replace function public.diagnostic_correctifs_v0111()
returns table(
  tables_publiques bigint,
  champs_publics bigint,
  champs_studio bigint,
  relations_studio bigint
)
language sql
security definer
set search_path = public, information_schema
as $$
  select
    (
      select count(distinct table_name)
      from information_schema.columns
      where table_schema = 'public'
    ),
    (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
    ),
    (select count(*) from public.relation_fields),
    (select count(*) from public.relation_rules);
$$;

grant execute on function public.diagnostic_correctifs_v0111()
to authenticated;
