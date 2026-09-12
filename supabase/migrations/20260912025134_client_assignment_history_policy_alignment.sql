-- Keep the final restrictive tenant fence, using the historical ownership rule
-- for the two historical assignment sources only. Staff behavior is unchanged.
DO $$ DECLARE t text; predicate text; BEGIN
 FOREACH t IN ARRAY ARRAY['campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  predicate:=format('CASE WHEN public.tos_current_role() IN (''Client'',''Client-Admin'') THEN public.portal_assignment_scope(%L,to_jsonb(%I.*)) ELSE public.tos_remaining_tenant_scope(%L,to_jsonb(%I.*),''read'') END IS TRUE',t,t,t,t);
  EXECUTE format('ALTER POLICY final_tenant_read ON public.%I USING (%s)',t,predicate);
  predicate:=format('CASE WHEN public.tos_current_role() IN (''Client'',''Client-Admin'') THEN public.portal_assignment_scope(%L,to_jsonb(%I.*),true) ELSE public.tos_remaining_tenant_scope(%L,to_jsonb(%I.*),''write'') END IS TRUE',t,t,t,t);
  EXECUTE format('ALTER POLICY final_tenant_update ON public.%I USING (%s) WITH CHECK (%s)',t,predicate,predicate);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
