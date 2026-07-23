-- TOS Display Manager v0.13.1
-- Assistant d'automatisation déclaratif. Aucune règle n'est exécutée ou traduite.

begin;

create table if not exists public.automation_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  status text not null default 'draft'
    check (status in ('draft','pending_validation','active','inactive')),
  priority text not null default 'normal'
    check (priority in ('critical','high','normal','low')),
  definition jsonb not null default '{}'::jsonb
    check (jsonb_typeof(definition) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  constraint automation_active_requires_approval check (
    status <> 'active' or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists automation_definitions_status_idx
  on public.automation_definitions(status, updated_at desc);
create index if not exists automation_definitions_updated_idx
  on public.automation_definitions(updated_at desc);

alter table public.automation_definitions enable row level security;

drop policy if exists automation_definitions_admin_read on public.automation_definitions;
create policy automation_definitions_admin_read
on public.automation_definitions for select to authenticated
using (public.current_app_role() = 'Administrateur');

drop policy if exists automation_definitions_admin_insert on public.automation_definitions;
create policy automation_definitions_admin_insert
on public.automation_definitions for insert to authenticated
with check (
  public.current_app_role() = 'Administrateur'
  and created_by = auth.uid()
  and updated_by = auth.uid()
  and approved_by is null
  and approved_at is null
  and status <> 'active'
);

drop policy if exists automation_definitions_admin_update on public.automation_definitions;
create policy automation_definitions_admin_update
on public.automation_definitions for update to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists automation_definitions_admin_delete on public.automation_definitions;
create policy automation_definitions_admin_delete
on public.automation_definitions for delete to authenticated
using (public.current_app_role() = 'Administrateur');

revoke all on public.automation_definitions from anon, authenticated;
grant select, insert, delete on public.automation_definitions to authenticated;
grant update(name,status,priority,definition,schema_version,updated_at)
  on public.automation_definitions to authenticated;

create or replace function public.prepare_automation_definition_v0131()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.updated_by := auth.uid();
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.approved_by := null;
    new.approved_at := null;
    if new.status = 'active' then new.status := 'pending_validation'; end if;
  elsif old.name is distinct from new.name
     or old.priority is distinct from new.priority
     or old.definition is distinct from new.definition
     or old.schema_version is distinct from new.schema_version then
    new.approved_by := null;
    new.approved_at := null;
    if old.status = 'active' or new.status = 'active' then
      new.status := 'pending_validation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_automation_definition_v0131
  on public.automation_definitions;
create trigger prepare_automation_definition_v0131
before insert or update on public.automation_definitions
for each row execute function public.prepare_automation_definition_v0131();

create or replace function public.approve_automation_definition_v0131(
  p_automation_id uuid
)
returns public.automation_definitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_definition public.automation_definitions%rowtype;
begin
  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  select * into v_definition
    from public.automation_definitions
   where id = p_automation_id
   for update;
  if not found then raise exception 'Automatisation introuvable.'; end if;

  if jsonb_typeof(v_definition.definition->'triggers') <> 'array'
     or jsonb_array_length(v_definition.definition->'triggers') = 0 then
    raise exception 'Au moins un déclencheur est requis.';
  end if;
  if jsonb_typeof(v_definition.definition->'targets') <> 'array'
     or jsonb_array_length(v_definition.definition->'targets') = 0 then
    raise exception 'Au moins un module cible est requis.';
  end if;

  update public.automation_definitions
     set status = 'active',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_automation_id
   returning * into v_definition;

  return v_definition;
end;
$$;

grant execute on function public.approve_automation_definition_v0131(uuid)
  to authenticated;

comment on table public.automation_definitions is
  'Configurations déclaratives du Mode simple. Aucun déclencheur SQL ne lit cette table.';

commit;
