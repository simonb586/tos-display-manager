BEGIN;
-- The existing edt_phase_id is the single canonical visual -> EDT relation.
CREATE OR REPLACE FUNCTION public.guard_visual_edt_assignment_v1343()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.edt_phase_id IS NOT DISTINCT FROM OLD.edt_phase_id
       AND NEW.campagne_id IS NOT DISTINCT FROM OLD.campagne_id
       AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN RETURN NEW;END IF;
  ELSIF NEW.edt_phase_id IS NULL THEN RETURN NEW;
  END IF;
  IF TG_OP='INSERT' OR NEW.edt_phase_id IS DISTINCT FROM OLD.edt_phase_id THEN
    IF (auth.uid() IS NOT NULL AND public.tos_current_role()='Administrateur') IS NOT TRUE THEN
      RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';
    END IF;
  END IF;
  IF NEW.edt_phase_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.edt_phases p JOIN public.suivi_des_edt e ON e.id=p.edt_id
      JOIN public.campagnes_maitres c ON c.id=NEW.campagne_id
    WHERE p.id=NEW.edt_phase_id AND p.phase_type='installation' AND e.archived_at IS NULL
      AND e.campagne_id=c.id AND c.client_id=e.client_id
      AND (p.client_id IS NULL OR p.client_id=e.client_id)
      AND (NEW.client_id IS NULL OR NEW.client_id=c.client_id)
      AND public.tos_table_resource_scope(c.client_id,NULL,c.id,e.id,false) IS TRUE
  ) THEN RAISE EXCEPTION 'visual_edt_client_or_campaign_mismatch' USING ERRCODE='42501';END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_visual_edt_assignment_v1343() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_visual_edt_assignment_v1343 BEFORE INSERT OR UPDATE OF edt_phase_id,campagne_id,client_id
ON public.campagne_visuels_formats FOR EACH ROW EXECUTE FUNCTION public.guard_visual_edt_assignment_v1343();

CREATE OR REPLACE FUNCTION public.rattacher_visuel_edt_v1343(p_visual_id bigint,p_phase_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v public.campagne_visuels_formats%rowtype;
BEGIN
  IF (auth.uid() IS NOT NULL AND public.tos_current_role()='Administrateur') IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
  SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=p_visual_id FOR UPDATE;
  IF NOT FOUND OR public.tos_table_resource_scope(v.client_id,NULL,v.campagne_id,NULL,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
  UPDATE public.campagne_visuels_formats SET edt_phase_id=p_phase_id,updated_at=now() WHERE id=v.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
  RETURN jsonb_build_object('ok',true,'visual_id',v.id,'edt_phase_id',p_phase_id);
END $$;
REVOKE ALL ON FUNCTION public.rattacher_visuel_edt_v1343(bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rattacher_visuel_edt_v1343(bigint,bigint) TO authenticated;

-- Cover direct table writes as well as historical assignment RPCs. Completing
-- an existing intervention does not alter its administrative assignment.
CREATE OR REPLACE FUNCTION public.guard_support_edt_assignment_v1343()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.edt_id IS NOT DISTINCT FROM OLD.edt_id
     AND NEW.phase_id IS NOT DISTINCT FROM OLD.phase_id AND NEW.support_id IS NOT DISTINCT FROM OLD.support_id THEN RETURN NEW;END IF;
  IF (auth.uid() IS NOT NULL AND public.tos_current_role()='Administrateur') IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_support_edt_assignment_required' USING ERRCODE='42501';END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;
  IF public.tos_table_resource_scope(NULL,NEW.support_id,NULL,NEW.edt_id,false) IS NOT TRUE
     OR (NEW.phase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.edt_phases p
       JOIN public.suivi_des_edt e ON e.id=p.edt_id WHERE p.id=NEW.phase_id AND e.id=NEW.edt_id
       AND (p.client_id IS NULL OR p.client_id=e.client_id))) THEN
    RAISE EXCEPTION 'support_edt_scope_denied' USING ERRCODE='42501';END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_support_edt_assignment_v1343() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_support_edt_assignment_v1343 BEFORE INSERT OR DELETE OR UPDATE OF edt_id,phase_id,support_id
ON public.edt_supports FOR EACH ROW EXECUTE FUNCTION public.guard_support_edt_assignment_v1343();
COMMIT;
