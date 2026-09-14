-- Inspection without an EDT reaches an unassigned PL/pgSQL record on return.
-- Preserve the deployed authorization guards, signature, owner and ACL.
DO $migration$
DECLARE
  definition text;
  marker text := 'v_email:=coalesce(nullif(v_user.courriel,';
  initialization text := E'if p_edt_phase_id is null then\n select null::bigint as edt_id, null::text as phase_type into v_context;\n end if;\n ';
BEGIN
  SELECT pg_get_functiondef('public.finaliser_intervention_terrain_v1342(text,bigint,text,text,text,text,text,text,text,text)'::regprocedure)
    INTO definition;
  IF position(initialization IN definition)>0 THEN RETURN; END IF;
  IF position(marker IN definition)=0 OR position('canonical_rpc_role_denied' IN definition)=0
     OR position('support_scope_denied' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected deployed Terrain RPC; audit before applying migration';
  END IF;
  EXECUTE replace(definition,marker,initialization||marker);
END
$migration$;
