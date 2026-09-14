BEGIN;
-- A legacy phase may inherit its tenant from its EDT. Keep the same EDT,
-- campaign and visual tenant guards used by administrative assignment.
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.lister_visuels_installation_terrain_v1331(text,bigint)'::regprocedure) INTO definition;
 IF position('ep.client_id is not distinct from v.client_id' in definition)=0 THEN
   RAISE EXCEPTION 'expected_visual_edt_owner_guard_missing';
 END IF;
 EXECUTE replace(definition,'ep.client_id is not distinct from v.client_id','(ep.client_id is null or ep.client_id=v.client_id)');
END $$;
COMMIT;
