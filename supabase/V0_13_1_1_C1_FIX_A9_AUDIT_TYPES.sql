-- Bloc 13.1.1-C1 — correctif additif local, non exécuté.
-- Seule la contrainte CHECK de configuration_type de l'audit commun est remplacée.
begin;

do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_constraint
     where conrelid = 'public.relation_field_config_audit'::pg_catalog.regclass
       and conname = 'relation_field_config_audit_type_v0131a8_check'
       and contype = 'c'
  ) then
    raise exception 'Contrainte audit A8 attendue absente; correctif C1 non appliqué.';
  end if;
end;
$$;

alter table public.relation_field_config_audit
  drop constraint relation_field_config_audit_type_v0131a8_check;

alter table public.relation_field_config_audit
  add constraint relation_field_config_audit_type_v01311c1_check
  check (
    configuration_type is null
    or configuration_type in (
      'general',
      'display',
      'validation',
      'permission',
      'terrain',
      'import_export',
      'relation',
      'calculation'
    )
  ) not valid;

comment on constraint relation_field_config_audit_type_v01311c1_check
  on public.relation_field_config_audit is
  'Correctif 13.1.1-C1: conserve A3-A8 et autorise les audits RelationConfig/CalculationConfig A9.';

commit;
