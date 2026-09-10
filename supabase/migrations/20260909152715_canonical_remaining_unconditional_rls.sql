-- Intersect existing permissions with canonical identity and coherent resource ownership.
CREATE OR REPLACE FUNCTION public.tos_remaining_log_scope(p_table text,p_row jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE c bigint;camp bigint;edt bigint;support text;v bigint;target_client bigint;target_role text;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() IS NULL OR p_row IS NULL THEN RETURN false;END IF;
 support:=nullif(p_row->>'support_id','');
 IF p_table='journal_propagations' THEN camp:=nullif(p_row->>'campagne_id','')::bigint;
 ELSIF p_table='inventory_movements' THEN
  v:=nullif(p_row->>'visual_id','')::bigint;
  IF v IS NOT NULL THEN
   SELECT f.client_id,f.campagne_id INTO c,camp FROM public.campagne_visuels_formats f WHERE f.id=v;
   IF NOT FOUND THEN RETURN false;END IF;
  END IF;
  IF nullif(p_row->>'edt_number','') IS NOT NULL THEN
   IF (SELECT count(*) FROM public.suivi_des_edt e WHERE e.no_edt=p_row->>'edt_number')<>1 THEN RETURN false;END IF;
   SELECT e.id INTO edt FROM public.suivi_des_edt e WHERE e.no_edt=p_row->>'edt_number';
  END IF;
 ELSIF p_table='edt_assignments' THEN
  edt:=nullif(p_row->>'edt_id','')::bigint;
  IF edt IS NULL THEN RETURN false;END IF;
 ELSE RETURN false;END IF;
 IF public.tos_table_resource_scope(c,support,camp,edt,p_table IN ('journal_propagations','inventory_movements')) IS NOT TRUE THEN RETURN false;END IF;
 IF public.tos_current_role() IN ('Client','Client-Admin') THEN
  IF edt IS NOT NULL THEN SELECT e.campagne_id INTO camp FROM public.suivi_des_edt e WHERE e.id=edt;END IF;
  IF camp IS NOT NULL AND public.client_can_access_campaign_v120(camp) IS NOT TRUE THEN RETURN false;END IF;
 END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION public.tos_remaining_log_scope(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tos_remaining_log_scope(text,jsonb) TO authenticated;

ALTER TABLE public.journal_propagations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_propagations FROM PUBLIC,anon;
CREATE POLICY final_remaining_scope_fence ON public.journal_propagations AS RESTRICTIVE FOR ALL TO authenticated USING (public.tos_remaining_log_scope('journal_propagations',to_jsonb(journal_propagations)) IS TRUE) WITH CHECK (public.tos_remaining_log_scope('journal_propagations',to_jsonb(journal_propagations)) IS TRUE);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_movements FROM PUBLIC,anon;
CREATE POLICY final_remaining_scope_fence ON public.inventory_movements AS RESTRICTIVE FOR ALL TO authenticated USING (public.tos_remaining_log_scope('inventory_movements',to_jsonb(inventory_movements)) IS TRUE) WITH CHECK (public.tos_remaining_log_scope('inventory_movements',to_jsonb(inventory_movements)) IS TRUE);

ALTER TABLE public.edt_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edt_assignments FROM PUBLIC,anon;
CREATE POLICY final_remaining_scope_fence ON public.edt_assignments AS RESTRICTIVE FOR ALL TO authenticated USING (public.tos_remaining_log_scope('edt_assignments',to_jsonb(edt_assignments)) IS TRUE) WITH CHECK (public.tos_remaining_log_scope('edt_assignments',to_jsonb(edt_assignments)) IS TRUE);
