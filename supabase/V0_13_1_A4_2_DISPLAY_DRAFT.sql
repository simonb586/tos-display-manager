-- TOS Display Manager — Phase 13.1-A4.2
-- Stockage additif des brouillons DisplayConfig 1.0.0.
-- N'active aucune configuration et ne modifie aucune table métier.

begin;

alter table public.relation_field_config_audit
  add column if not exists audit_schema_version text,
  add column if not exists configuration_type text,
  add column if not exists contract_name text,
  add column if not exists contract_version text,
  add column if not exists changed_properties text[],
  add column if not exists actor_user_id uuid,
  add column if not exists occurred_at timestamptz,
  add column if not exists transaction_id text;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a42_check'
  ) then
    alter table public.relation_field_config_audit
      add constraint relation_field_config_audit_type_v0131a42_check
      check (
        configuration_type is null
        or configuration_type in ('general', 'display')
      ) not valid;
  end if;
end;
$$;

create or replace function public.save_relation_field_display_draft_v0131a42(
  p_table_name text,
  p_field_name text,
  p_contract_version text,
  p_show_in_grid boolean,
  p_show_in_form boolean,
  p_show_in_360 boolean,
  p_display_order integer,
  p_readonly_override boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_changed_properties text[] := array[]::text[];
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if p_contract_version is distinct from '1.0.0' then
    raise exception 'Version DisplayConfig non supportée.';
  end if;

  if p_table_name is null or pg_catalog.btrim(p_table_name) = ''
     or p_field_name is null or pg_catalog.btrim(p_field_name) = '' then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  if p_display_order is not null
     and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ ou table inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or pg_catalog.lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at',
       'auth_user_id', 'photo_principale_url', 'photo_miniature_url',
       'visuel_actuel_cadre'
     )
     or pg_catalog.lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if v_old.show_in_grid is not distinct from p_show_in_grid
     and v_old.show_in_form is not distinct from p_show_in_form
     and v_old.show_in_360 is not distinct from p_show_in_360
     and v_old.display_order is not distinct from p_display_order
     and v_old.readonly_override is not distinct from p_readonly_override
     and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'changed', false,
      'status', 'no_change',
      'contractName', 'DisplayConfig',
      'contractVersion', '1.0.0'
    );
  end if;

  if v_old.show_in_grid is distinct from p_show_in_grid then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_grid');
  end if;
  if v_old.show_in_form is distinct from p_show_in_form then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_form');
  end if;
  if v_old.show_in_360 is distinct from p_show_in_360 then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_360');
  end if;
  if v_old.display_order is distinct from p_display_order then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'display_order');
  end if;
  if v_old.readonly_override is distinct from p_readonly_override then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'readonly_override');
  end if;
  if v_old.configuration_status is distinct from 'draft' then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'configuration_status');
  end if;

  v_old_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_old.show_in_grid,
    'show_in_form', v_old.show_in_form,
    'show_in_360', v_old.show_in_360,
    'display_order', v_old.display_order,
    'readonly_override', v_old.readonly_override,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set show_in_grid = p_show_in_grid,
         show_in_form = p_show_in_form,
         show_in_360 = p_show_in_360,
         display_order = p_display_order,
         readonly_override = p_readonly_override,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_updated.show_in_grid,
    'show_in_form', v_updated.show_in_form,
    'show_in_360', v_updated.show_in_360,
    'display_order', v_updated.display_order,
    'readonly_override', v_updated.readonly_override,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status,
    audit_schema_version,
    configuration_type,
    contract_name,
    contract_version,
    changed_properties,
    actor_user_id,
    occurred_at,
    transaction_id
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    v_actor,
    pg_catalog.now(),
    'draft',
    '1.0.0',
    'display',
    'DisplayConfig',
    '1.0.0',
    v_changed_properties,
    v_actor,
    pg_catalog.now(),
    pg_catalog.txid_current()::text
  );

  return pg_catalog.jsonb_build_object(
    'changed', true,
    'status', 'draft_saved',
    'contractName', 'DisplayConfig',
    'contractVersion', '1.0.0',
    'changedProperties', pg_catalog.to_jsonb(v_changed_properties)
  );
end;
$$;

alter function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) owner to postgres;

revoke all on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) from public, anon;

grant execute on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) to authenticated;

comment on function public.save_relation_field_display_draft_v0131a42(
  text, text, text, boolean, boolean, boolean, integer, boolean
) is 'Enregistre uniquement un brouillon DisplayConfig 1.0.0 dans relation_fields avec audit commun versionné.';

commit;
