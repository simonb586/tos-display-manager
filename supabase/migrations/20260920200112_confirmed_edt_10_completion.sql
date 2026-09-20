-- Explicit user confirmation: EDT ID 10 was executed and completed.
-- Retain its number, all relations and the complete pre-correction state.
DO $$
DECLARE e public.suivi_des_edt%rowtype;previous_phases jsonb;
 reason text:='Exécution et achèvement de l’EDT ID 10 confirmés explicitement par le propriétaire le 2026-09-20. Horodatage de régularisation administrative ; date réelle des travaux non précisée.';
BEGIN
 SELECT * INTO e FROM public.suivi_des_edt WHERE id=10 FOR UPDATE;
 IF NOT FOUND OR e.no_edt IS DISTINCT FROM 'EDT-TOS-09 (0.1)' OR e.client_id IS DISTINCT FROM 2 OR e.campagne_id IS DISTINCT FROM 11
 THEN RAISE EXCEPTION 'confirmed_edt_10_identity_mismatch';END IF;
 IF e.raw_data ? 'confirmed_completion_20260920' THEN RETURN;END IF;
 IF e.statut IS DISTINCT FROM 'Annule' OR e.lifecycle_status IS DISTINCT FROM 'annule' OR e.archived_at IS NULL
 THEN RAISE EXCEPTION 'confirmed_edt_10_state_changed';END IF;
 PERFORM 1 FROM public.edt_phases WHERE edt_id=e.id FOR UPDATE;
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') INTO previous_phases FROM public.edt_phases p WHERE p.edt_id=e.id;
 UPDATE public.edt_phases
 SET progression=100,statut=CASE phase_type WHEN 'installation' THEN 'fermee' WHEN 'retrait' THEN 'ferme' ELSE 'Terminée' END,
  closed_at=coalesce(closed_at,now()),notes=concat_ws(E'\n',nullif(notes,''),reason),updated_at=now()
 WHERE edt_id=e.id;
 UPDATE public.suivi_des_edt
 SET statut='Terminé',lifecycle_status='ferme',progression=100,avancement=100,
  archived_at=NULL,archived_by=NULL,archive_reason=NULL,
  lifecycle_closed_at=coalesce(lifecycle_closed_at,now()),
  lifecycle_exception=concat_ws(E'\n',nullif(lifecycle_exception,''),reason),
  raw_data=coalesce(raw_data,'{}'::jsonb)||jsonb_build_object('confirmed_completion_20260920',
   jsonb_build_object('reason',reason,'confirmed_at',now(),'previous_edt',to_jsonb(e),'previous_phases',previous_phases)),updated_at=now()
 WHERE id=e.id;
END $$;
