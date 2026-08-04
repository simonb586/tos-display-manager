-- TOS Display Manager — Phase 13.1-A5
-- Stockage additif des brouillons ValidationConfig 1.0.0.
-- À valider en préproduction avant toute exécution. Aucune activation métier.

begin;

alter table public.relation_field_config_audit
  add column if not exists actor_app_role text,
  add column if not exists event_type text;

alter table public.relation_fields
  alter column validation_rules set default '{}'::jsonb,
  alter column validation_rules set not null;

comment on column public.relation_fields.validation_rules is
  'Brouillon administratif ValidationConfig 1.0.0. {} signifie aucune configuration préparée; aucune activation implicite.';
comment on column public.relation_field_config_audit.actor_app_role is
  'Rôle applicatif de l’acteur au moment de l’événement administratif.';
comment on column public.relation_field_config_audit.event_type is
  'Type versionné de l’événement de configuration administrative.';

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a42_check'
  ) then
    alter table public.relation_field_config_audit
      drop constraint relation_field_config_audit_type_v0131a42_check;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a5_check'
  ) then
    alter table public.relation_field_config_audit
      add constraint relation_field_config_audit_type_v0131a5_check
      check (configuration_type is null or configuration_type in ('general','display','validation'))
      not valid;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'public.relation_fields'::pg_catalog.regclass
       and conname = 'relation_fields_validation_rules_object_v0131a5_check'
  ) then
    alter table public.relation_fields
      add constraint relation_fields_validation_rules_object_v0131a5_check
      check (pg_catalog.jsonb_typeof(validation_rules) = 'object') not valid;
  end if;
end;
$$;

create or replace function public.normalize_validation_config_v0131a5(
  p_config jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  v_allowed_keys constant text[] := array[
    'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
    'maximumValue', 'allowedValues', 'errorMessages'
  ];
  v_message_keys constant text[] := array[
    'requiredOverride', 'minimumLength', 'maximumLength', 'minimumValue',
    'maximumValue', 'allowedValues'
  ];
  v_key text;
  v_item jsonb;
  v_message text;
  v_allowed jsonb;
  v_messages jsonb;
  v_min_length integer;
  v_max_length integer;
  v_min_value numeric;
  v_max_value numeric;
begin
  if p_config is null or pg_catalog.jsonb_typeof(p_config) <> 'object' then
    raise exception using message = 'Configuration de validation invalide.', detail = '{"code":"invalid_payload"}';
  end if;

  for v_key in select pg_catalog.jsonb_object_keys(p_config)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception using message = 'Propriété ValidationConfig inconnue.', detail = pg_catalog.jsonb_build_object('code','unknown_property','field',v_key)::text;
    end if;
  end loop;

  if p_config ? 'requiredOverride'
     and p_config->'requiredOverride' <> 'null'::jsonb
     and pg_catalog.jsonb_typeof(p_config->'requiredOverride') <> 'boolean' then
    raise exception using message = 'requiredOverride doit être booléen ou null.', detail = '{"code":"invalid_required_override","field":"requiredOverride"}';
  end if;

  if p_config ? 'minimumLength' and p_config->'minimumLength' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'minimumLength') <> 'number'
       or (p_config->>'minimumLength') !~ '^[0-9]+$' then
      raise exception using message = 'Longueur minimale invalide.', detail = '{"code":"invalid_minimum_length","field":"minimumLength"}';
    end if;
    v_min_length := (p_config->>'minimumLength')::integer;
  end if;
  if p_config ? 'maximumLength' and p_config->'maximumLength' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'maximumLength') <> 'number'
       or (p_config->>'maximumLength') !~ '^[0-9]+$' then
      raise exception using message = 'Longueur maximale invalide.', detail = '{"code":"invalid_maximum_length","field":"maximumLength"}';
    end if;
    v_max_length := (p_config->>'maximumLength')::integer;
  end if;
  if v_min_length is not null and v_max_length is not null and v_min_length > v_max_length then
    raise exception using message = 'La longueur minimale ne peut pas dépasser la longueur maximale.', detail = '{"code":"minimum_length_exceeds_maximum_length","field":"maximumLength"}';
  end if;

  if p_config ? 'minimumValue' and p_config->'minimumValue' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'minimumValue') <> 'number' then
      raise exception using message = 'Valeur minimale invalide.', detail = '{"code":"invalid_minimum_value","field":"minimumValue"}';
    end if;
    v_min_value := (p_config->>'minimumValue')::numeric;
  end if;
  if p_config ? 'maximumValue' and p_config->'maximumValue' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_config->'maximumValue') <> 'number' then
      raise exception using message = 'Valeur maximale invalide.', detail = '{"code":"invalid_maximum_value","field":"maximumValue"}';
    end if;
    v_max_value := (p_config->>'maximumValue')::numeric;
  end if;
  if v_min_value is not null and v_max_value is not null and v_min_value > v_max_value then
    raise exception using message = 'La valeur minimale ne peut pas dépasser la valeur maximale.', detail = '{"code":"minimum_value_exceeds_maximum_value","field":"maximumValue"}';
  end if;

  v_allowed := coalesce(p_config->'allowedValues', 'null'::jsonb);
  if v_allowed <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(v_allowed) <> 'array' then
      raise exception using message = 'Valeurs permises invalides.', detail = '{"code":"invalid_allowed_values","field":"allowedValues"}';
    end if;
    if pg_catalog.jsonb_array_length(v_allowed) > 100 or pg_catalog.octet_length(v_allowed::text) > 65536 then
      raise exception using message = 'La liste de valeurs permises est trop grande.', detail = '{"code":"allowed_values_too_large","field":"allowedValues"}';
    end if;
    for v_item in select value from pg_catalog.jsonb_array_elements(v_allowed)
    loop
      if pg_catalog.jsonb_typeof(v_item) = 'null' then
        raise exception using message = 'null est interdit dans les valeurs permises.', detail = '{"code":"null_allowed_value","field":"allowedValues"}';
      end if;
      if pg_catalog.jsonb_typeof(v_item) not in ('string','number','boolean')
         or (pg_catalog.jsonb_typeof(v_item) = 'string' and pg_catalog.char_length(v_item #>> '{}') > 500) then
        raise exception using message = 'Valeur permise invalide.', detail = '{"code":"invalid_allowed_values","field":"allowedValues"}';
      end if;
    end loop;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(v_allowed) item(value)
       group by pg_catalog.jsonb_typeof(value), value having count(*) > 1
    ) then
      raise exception using message = 'Une valeur permise est présente plusieurs fois.', detail = '{"code":"duplicate_allowed_value","field":"allowedValues"}';
    end if;
  end if;

  v_messages := coalesce(p_config->'errorMessages', 'null'::jsonb);
  if v_messages <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(v_messages) <> 'object' then
      raise exception using message = 'Messages de validation invalides.', detail = '{"code":"invalid_error_messages","field":"errorMessages"}';
    end if;
    for v_key, v_item in select key, value from pg_catalog.jsonb_each(v_messages)
    loop
      if not (v_key = any(v_message_keys)) then
        raise exception using message = 'Clé de message inconnue.', detail = pg_catalog.jsonb_build_object('code','unknown_error_message_key','field',v_key)::text;
      end if;
      if pg_catalog.jsonb_typeof(v_item) <> 'string' then
        raise exception using message = 'Message de validation invalide.', detail = '{"code":"invalid_error_messages","field":"errorMessages"}';
      end if;
      v_message := pg_catalog.btrim(v_item #>> '{}');
      if v_message = '' then
        raise exception using message = 'Un message de validation est vide.', detail = '{"code":"error_message_empty","field":"errorMessages"}';
      end if;
      if pg_catalog.char_length(v_message) > 300 then
        raise exception using message = 'Un message de validation est trop long.', detail = '{"code":"error_message_too_long","field":"errorMessages"}';
      end if;
      if v_message ~* '<[^>]*>|javascript[[:space:]]*:|<script|[$][{]|[{][{]' then
        raise exception using message = 'Un message contient du contenu interdit.', detail = '{"code":"error_message_unsafe","field":"errorMessages"}';
      end if;
      v_messages := pg_catalog.jsonb_set(v_messages, array[v_key], pg_catalog.to_jsonb(v_message), false);
    end loop;
  end if;

  return pg_catalog.jsonb_build_object(
    'requiredOverride', coalesce(p_config->'requiredOverride', 'null'::jsonb),
    'minimumLength', coalesce(p_config->'minimumLength', 'null'::jsonb),
    'maximumLength', coalesce(p_config->'maximumLength', 'null'::jsonb),
    'minimumValue', coalesce(p_config->'minimumValue', 'null'::jsonb),
    'maximumValue', coalesce(p_config->'maximumValue', 'null'::jsonb),
    'allowedValues', v_allowed,
    'errorMessages', v_messages
  );
end;
$$;

alter function public.normalize_validation_config_v0131a5(jsonb) owner to postgres;
revoke all on function public.normalize_validation_config_v0131a5(jsonb) from public, anon, authenticated;

create or replace function public.save_relation_field_validation_draft_v0131a53(
  p_table_name text,
  p_field_name text,
  p_contract_version text,
  p_validation_config jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old public.relation_fields%rowtype;
  v_old_config jsonb;
  v_new_config jsonb;
  v_changed text[] := array[]::text[];
  v_key text;
  v_actor uuid := auth.uid();
  v_role text;
  v_updated_at timestamptz;
begin
  v_role := public.current_app_role();
  if v_actor is null then
    raise exception using message = 'Authentification requise.', detail = '{"code":"unauthorized"}';
  end if;
  if v_role <> 'Administrateur' then
    raise exception using message = 'Permission administrateur requise.', detail = '{"code":"administrator_required"}';
  end if;
  if p_contract_version is distinct from '1.0.0' then
    raise exception using message = 'Version ValidationConfig non supportée.', detail = '{"code":"unsupported_contract_version"}';
  end if;
  if p_expected_updated_at is null then
    raise exception using message = 'Horodatage attendu obligatoire.', detail = '{"code":"invalid_payload","field":"expectedUpdatedAt"}';
  end if;

  select * into v_old
    from public.relation_fields
   where table_name = p_table_name and field_name = p_field_name
   for update;
  if not found then
    raise exception using message = 'Champ inconnu dans relation_fields.', detail = '{"code":"field_not_found"}';
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'Ce brouillon a été modifié par un autre administrateur.', detail = '{"code":"stale_draft"}';
  end if;
  if coalesce(v_old.physical_is_primary_key,false)
     or coalesce(v_old.physical_is_foreign_key,false)
     or coalesce(v_old.physical_is_generated,false)
     or coalesce(v_old.physical_is_identity,false)
     or v_old.field_type = 'calculated'
     or lower(v_old.field_name) in (
       'id','support_id','created_at','updated_at','deleted_at','auth_user_id',
       'photo_principale_url','photo_miniature_url','visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception using message = 'Ce champ est protégé.', detail = '{"code":"field_protected"}';
  end if;

  v_new_config := public.normalize_validation_config_v0131a5(p_validation_config);
  v_old_config := public.normalize_validation_config_v0131a5(
    case when v_old.validation_rules = '{}'::jsonb then '{}'::jsonb else v_old.validation_rules end
  );

  if v_old.field_type in ('number','currency')
     and (v_new_config->'minimumLength' <> 'null'::jsonb or v_new_config->'maximumLength' <> 'null'::jsonb)
     or v_old.field_type in ('short_text','long_text')
     and (v_new_config->'minimumValue' <> 'null'::jsonb or v_new_config->'maximumValue' <> 'null'::jsonb)
     or v_old.field_type in ('date','datetime','boolean','single_select','multi_select','photo','file','relation')
     and (
       v_new_config->'minimumLength' <> 'null'::jsonb
       or v_new_config->'maximumLength' <> 'null'::jsonb
       or v_new_config->'minimumValue' <> 'null'::jsonb
       or v_new_config->'maximumValue' <> 'null'::jsonb
     )
  then
    raise exception using message = 'Règle incompatible avec le type du champ.', detail = '{"code":"incompatible_field_type"}';
  end if;

  if v_old_config = v_new_config and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'ok',true,'changed',false,'code','no_change',
      'validationConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at
    );
  end if;

  foreach v_key in array array[
    'requiredOverride','minimumLength','maximumLength','minimumValue',
    'maximumValue','allowedValues','errorMessages'
  ] loop
    if v_old_config->v_key is distinct from v_new_config->v_key then
      v_changed := pg_catalog.array_append(v_changed,v_key);
    end if;
  end loop;

  update public.relation_fields
     set validation_rules = v_new_config,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning updated_at into v_updated_at;

  insert into public.relation_field_config_audit(
    relation_field_id,table_name,field_name,old_values,new_values,changed_by,
    changed_at,configuration_status,audit_schema_version,configuration_type,
    contract_name,contract_version,changed_properties,actor_user_id,occurred_at,
    transaction_id,actor_app_role,event_type
  ) values (
    v_old.id,v_old.table_name,v_old.field_name,
    pg_catalog.jsonb_build_object('validationConfig',v_old_config,'configuration_status',v_old.configuration_status),
    pg_catalog.jsonb_build_object('validationConfig',v_new_config,'configuration_status','draft'),
    v_actor,pg_catalog.now(),'draft','1.0.0','validation','ValidationConfig',
    '1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,
    v_role,'validation_draft_saved'
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'changed',true,'code','saved','validationConfig',v_new_config,
    'contractVersion','1.0.0','updatedAt',v_updated_at,
    'changedProperties',pg_catalog.to_jsonb(v_changed)
  );
end;
$$;

alter function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) owner to postgres;
revoke all on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) from public, anon;
grant execute on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) to authenticated;

comment on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) is 'Enregistre atomiquement un brouillon ValidationConfig 1.0.0 avec concurrence et audit commun; aucune activation.';

commit;
