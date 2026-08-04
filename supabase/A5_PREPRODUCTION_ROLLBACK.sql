-- A5 PREPRODUCTION ROLLBACK — À N’UTILISER QU’APRÈS UNE A5 AUTORISÉE EN TEST.
-- Ce rollback est ciblé. Il ne restaure aucune donnée/table métier globalement.
-- Les colonnes actor_app_role/event_type et le NOT NULL ne sont pas retirés ici :
-- leur antériorité n’est pas prouvée et les supprimer pourrait perdre des données.

begin;

revoke all on function public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
) from public, anon, authenticated;

drop function if exists public.save_relation_field_validation_draft_v0131a53(
  text,text,text,jsonb,timestamptz
);

revoke all on function public.normalize_validation_config_v0131a5(jsonb)
  from public, anon, authenticated;
drop function if exists public.normalize_validation_config_v0131a5(jsonb);

alter table public.relation_fields
  drop constraint if exists relation_fields_validation_rules_object_v0131a5_check;

alter table public.relation_field_config_audit
  drop constraint if exists relation_field_config_audit_type_v0131a5_check;

do $rollback$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.relation_field_config_audit'::regclass
      and conname='relation_field_config_audit_type_v0131a42_check'
  ) then
    alter table public.relation_field_config_audit
      add constraint relation_field_config_audit_type_v0131a42_check
      check (configuration_type is null or configuration_type in ('general','display'))
      not valid;
  end if;
end;
$rollback$;

commit;

-- Après exécution, vérifier les objets et les privilèges. La restauration exacte du
-- défaut/NOT NULL ou des colonnes exige l’export préalable de leur état initial.
