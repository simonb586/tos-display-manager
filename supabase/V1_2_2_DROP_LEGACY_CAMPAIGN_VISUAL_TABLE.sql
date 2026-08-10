BEGIN;

DO $$
DECLARE
  missing_rows bigint;
  mismatched_rows bigint;
  missing_columns bigint;
BEGIN
  IF to_regclass('public.campagnes_et_visuels') IS NULL THEN
    RAISE EXCEPTION 'V1.2.2 refusée: public.campagnes_et_visuels est absente.';
  END IF;
  IF to_regclass('public.campagnes_visuels_sites_supports') IS NULL THEN
    RAISE EXCEPTION 'V1.2.2 refusée: la table consolidée est absente.';
  END IF;

  SELECT count(*) INTO missing_rows FROM public.campagnes_et_visuels old
  WHERE NOT EXISTS(SELECT 1 FROM public.campagnes_visuels_sites_supports consolidated WHERE consolidated.source_table='campagnes_et_visuels' AND consolidated.legacy_id=old.id);
  SELECT count(*) INTO mismatched_rows FROM public.campagnes_et_visuels old
  JOIN public.campagnes_visuels_sites_supports consolidated ON consolidated.source_table='campagnes_et_visuels' AND consolidated.legacy_id=old.id
  WHERE consolidated.historical_fingerprint IS DISTINCT FROM md5(jsonb_build_array(old.id,old.nom_campagne,old.visuel_terrain,old.date_debut,old.date_fin,old.statut_campagne,old.support_id,old.emplacement,old.date_mise_a_jour,old.raw_data,old.created_at,old.updated_at)::text);
  SELECT count(*) INTO missing_columns FROM information_schema.columns old_column
  WHERE old_column.table_schema='public' AND old_column.table_name='campagnes_et_visuels'
    AND NOT EXISTS(SELECT 1 FROM information_schema.columns new_column WHERE new_column.table_schema='public' AND new_column.table_name='campagnes_visuels_sites_supports' AND new_column.column_name=old_column.column_name AND new_column.udt_name=old_column.udt_name);

  IF missing_rows<>0 OR mismatched_rows<>0 OR missing_columns<>0 THEN
    RAISE EXCEPTION 'V1.2.2 refusée: missing_rows=%, mismatched_rows=%, missing_columns=%',missing_rows,mismatched_rows,missing_columns;
  END IF;
END $$;

-- LIKE INCLUDING ALL avait conservé le défaut nextval de la séquence legacy.
-- Détacher ce défaut évite CASCADE et donne à la table canonique sa propre séquence.
CREATE SEQUENCE IF NOT EXISTS public.campagnes_visuels_sites_supports_id_seq;
ALTER SEQUENCE public.campagnes_visuels_sites_supports_id_seq
  OWNED BY public.campagnes_visuels_sites_supports.id;
SELECT setval(
  'public.campagnes_visuels_sites_supports_id_seq',
  greatest(coalesce((SELECT max(id) FROM public.campagnes_visuels_sites_supports),0),1),
  EXISTS(SELECT 1 FROM public.campagnes_visuels_sites_supports)
);
ALTER TABLE public.campagnes_visuels_sites_supports
  ALTER COLUMN id SET DEFAULT nextval('public.campagnes_visuels_sites_supports_id_seq'::regclass);

DROP TABLE IF EXISTS public.campagnes_et_visuels;

COMMIT;
