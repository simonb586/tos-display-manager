-- NE PAS EXÉCUTER SANS AUTORISATION EXPLICITE
-- Fichier séparé; ne fait partie d'aucune exécution automatique.
-- Prérequis: C1 appliqué/vérifié, sauvegarde confirmée, anciennes lignes inspectées.
BEGIN;

-- Lecture préalable: tout résultat impose l'arrêt et un ROLLBACK manuel.
select id, configuration_type
from public.relation_field_config_audit
where configuration_type is not null
  and configuration_type not in
    ('general','display','validation','permission','terrain','import_export','relation','calculation')
order by id;

-- Arrêt logique: empêche VALIDATE si une ligne incompatible existe.
DO $c1_guard$
BEGIN
  IF EXISTS (
    select 1 from public.relation_field_config_audit
    where configuration_type is not null
      and configuration_type not in
        ('general','display','validation','permission','terrain','import_export','relation','calculation')
  ) THEN
    RAISE EXCEPTION 'NO-GO: lignes incompatibles avec la contrainte C1';
  END IF;
END
$c1_guard$;

ALTER TABLE public.relation_field_config_audit
  VALIDATE CONSTRAINT relation_field_config_audit_type_v01311c1_check;

select conname,convalidated,pg_catalog.pg_get_constraintdef(oid,true) definition
from pg_catalog.pg_constraint
where conrelid='public.relation_field_config_audit'::pg_catalog.regclass
  and conname='relation_field_config_audit_type_v01311c1_check';

COMMIT;
