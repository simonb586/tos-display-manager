-- Preserve the existing invoker/RLS projection and allow explicit archive filtering.
DO $$DECLARE definition text;old_fragment text:='SELECT * FROM public.suivi_des_edt WHERE archived_at IS NULL ORDER BY date_debut DESC NULLS LAST';
BEGIN
 SELECT pg_get_functiondef('public.portal_business_context(text,text)'::regprocedure) INTO definition;
 IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'Unexpected operations projection; review before applying';END IF;
 EXECUTE replace(definition,old_fragment,$replacement$WITH
  visible_visuals AS MATERIALIZED (SELECT id,client_id,nom_visuel,edt_phase_id FROM public.campagne_visuels_formats),
  visible_links AS MATERIALIZED (SELECT visual_id,edt_id FROM public.visual_edt_associations),
  visible_phases AS MATERIALIZED (SELECT id,edt_id FROM public.edt_phases)
  SELECT e.*,
  (SELECT string_agg(DISTINCT v.nom_visuel,' · ')
   FROM visible_visuals v
   LEFT JOIN visible_links a ON a.visual_id=v.id
   LEFT JOIN visible_phases p ON p.id=v.edt_phase_id
   WHERE v.client_id=e.client_id AND (a.edt_id=e.id OR p.edt_id=e.id)) AS visual_names
  FROM public.suivi_des_edt e ORDER BY date_debut DESC NULLS LAST$replacement$);
END $$;

-- This exact existing EDT has completed both phases. Preserve the former archive
-- metadata in raw_data; do not infer completion for other cancelled/archived EDTs.
UPDATE public.suivi_des_edt e
SET raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('completed_visibility_restoration',jsonb_build_object(
 'archived_at',archived_at,'archived_by',archived_by,'archive_reason',archive_reason,'restored_at',now())),
 archived_at=NULL,archived_by=NULL,archive_reason=NULL,statut='Terminé',progression=100,updated_at=now()
WHERE id=22 AND no_edt='EDT-TOS-22-A' AND client_id=2 AND campagne_id=15
 AND archived_at IS NOT NULL AND statut='Terminé' AND lifecycle_status='retrait_termine'
 AND EXISTS(SELECT 1 FROM public.edt_phases p WHERE p.edt_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM public.edt_phases p WHERE p.edt_id=e.id AND (p.progression IS DISTINCT FROM 100 OR p.closed_at IS NULL));
