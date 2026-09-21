-- Use the existing canonical import transaction and support lock. A new EDT
-- assignment requires an explicit manual decision or an exact infrastructure
-- reference; matching only a client/date never creates an assignment.
DO $patch$
DECLARE definition text;needle text;insertion text;
BEGIN
 SELECT pg_get_functiondef('public.finalize_import_photo(bigint)'::regprocedure) INTO definition;
 needle:='   IF edt.id IS NULL OR phase.id IS NULL OR phase.edt_id<>edt.id OR phase.phase_type<>kind OR edt.client_id IS DISTINCT FROM infra.client_id';
 IF position(needle in definition)=0 THEN RAISE EXCEPTION 'import_edt_contract_changed';END IF;
 insertion:=$body$
   IF edt.id IS NOT NULL AND phase.id IS NOT NULL AND phase.edt_id=edt.id AND phase.phase_type=kind AND edt.client_id=infra.client_id
    AND public.tos_table_resource_scope(edt.client_id,infra.support_id,edt.campagne_id,edt.id,false) IS TRUE
    AND (states->>'edt'='MANUAL_CONFIRMED' OR lower(btrim(edt.no_edt)) IN (lower(btrim(infra.edt_associe)),lower(btrim(infra.edt_precedent_associe)),lower(btrim(infra.prochain_edt_cible))))
    AND NOT EXISTS(SELECT 1 FROM public.edt_supports WHERE edt_id=edt.id AND phase_id=phase.id AND support_id=infra.support_id)
   THEN
    INSERT INTO public.edt_supports(edt_id,phase_id,support_id,date_cible) VALUES(edt.id,phase.id,infra.support_id,(captured AT TIME ZONE 'America/Toronto')::date);
   END IF;
$body$;
 EXECUTE replace(definition,needle,insertion||needle);
END $patch$;
