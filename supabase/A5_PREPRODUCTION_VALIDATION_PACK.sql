-- A5 PREPRODUCTION VALIDATION PACK — ÉTAPE DE GARDE, STRICTEMENT NON MUTATIVE.
-- Généré parce qu’aucun environnement non-production n’est prouvé localement.
-- NE PAS utiliser en production. NE PAS ajouter de secret.
-- Sources gelées prévues après autorisation :
-- V0_13_1_A5_VALIDATION_DRAFT.sql
-- SHA-256 F8B7861408E0D31A10E5AB748B835754B2D58D3FE8DB58FB77AC7222AF49EB04
-- VERIFIER_V0_13_1_A5_VALIDATION_DRAFT.sql
-- SHA-256 5E889DC161D5643329E310B06B6D8E9EEAE64FD27E56094EAE77E8446E9D36B5

begin read only;

do $a5_guard$
declare
  v_confirmed_ref constant text := 'CONFIRMER_REF_PREPRODUCTION';
begin
  if v_confirmed_ref = 'CONFIRMER_REF_PREPRODUCTION'
     or v_confirmed_ref !~ '^[a-z0-9]{20}$' then
    raise exception 'ARRÊT A5: confirmez visuellement la référence du projet de préproduction dans le paquet.';
  end if;

  if to_regclass('public.relation_fields') is null
     or to_regclass('public.relation_field_config_audit') is null then
    raise exception 'ARRÊT A5: tables techniques attendues absentes.';
  end if;

  if exists (
    select 1 from public.relation_fields
    where validation_rules is null
       or pg_catalog.jsonb_typeof(validation_rules) is distinct from 'object'
  ) then
    raise exception 'ARRÊT A5: validation_rules contient NULL ou une valeur non objet.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='relation_fields'
      and column_name='updated_at' and data_type='timestamp with time zone'
  ) then
    raise exception 'ARRÊT A5: updated_at absent ou non exploitable.';
  end if;
end;
$a5_guard$;

select
  'A5_PREFLIGHT_OK' as result,
  current_database() as database_name,
  count(*) as relation_fields_rows,
  count(*) filter (where validation_rules <> '{}'::jsonb) as non_empty_validation_rules,
  count(*) filter (where validation_rules is null) as null_validation_rules,
  count(*) filter (where pg_catalog.jsonb_typeof(validation_rules) is distinct from 'object') as non_object_validation_rules,
  count(*) filter (where updated_at is null) as null_updated_at
from public.relation_fields;

select configuration_status, count(*)
from public.relation_fields
group by configuration_status
order by configuration_status nulls first;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('relation_fields','relation_field_config_audit')
order by table_name, ordinal_position;

select conrelid::regclass::text as object_name, conname,
       pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid in ('public.relation_fields'::regclass,
                   'public.relation_field_config_audit'::regclass)
order by object_name, conname;

select n.nspname as schema_name, p.proname, r.rolname as owner,
       p.prosecdef as security_definer, p.provolatile, p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
join pg_catalog.pg_roles r on r.oid=p.proowner
where n.nspname='public'
  and p.proname in ('normalize_validation_config_v0131a5',
                    'save_relation_field_validation_draft_v0131a53');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname='public'
order by tablename, policyname;

rollback;

-- POINT D’ARRÊT OBLIGATOIRE.
-- Ce fichier ne contient volontairement ni migration ni appel RPC : une référence de
-- préproduction et une protection exploitable doivent d’abord être confirmées, puis
-- l’utilisateur doit autoriser explicitement l’exécution de la phase mutative.

