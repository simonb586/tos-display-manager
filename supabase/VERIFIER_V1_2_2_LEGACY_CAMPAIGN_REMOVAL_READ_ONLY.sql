BEGIN READ ONLY;

SELECT 'LEGACY_CAMPAIGN_TABLE_ABSENT' AS control_name,to_regclass('public.campagnes_et_visuels') IS NULL AS valid
UNION ALL SELECT 'CONSOLIDATED_CAMPAIGN_TABLE_PRESENT',to_regclass('public.campagnes_visuels_sites_supports') IS NOT NULL
UNION ALL SELECT 'CONSOLIDATED_OPERATIONAL_TABLE_PRESENT',to_regclass('public.communications_operationnelles_sites_supports') IS NOT NULL;

SELECT 'CONSOLIDATED_SEQUENCE_PRESENT' AS control_name,to_regclass('public.campagnes_visuels_sites_supports_id_seq') IS NOT NULL AS valid
UNION ALL SELECT 'CONSOLIDATED_ID_DEFAULT_DETACHED',column_default LIKE '%campagnes_visuels_sites_supports_id_seq%'
FROM information_schema.columns WHERE table_schema='public' AND table_name='campagnes_visuels_sites_supports' AND column_name='id';

SELECT 'CONSOLIDATED_CAMPAIGN_ROWS' AS metric,count(*) AS value FROM public.campagnes_visuels_sites_supports
UNION ALL SELECT 'CAMPAIGN_ROWS_WITHOUT_LEGACY_ID',count(*) FROM public.campagnes_visuels_sites_supports WHERE legacy_id IS NULL
UNION ALL SELECT 'CAMPAIGN_ROWS_WITHOUT_PROVENANCE',count(*) FROM public.campagnes_visuels_sites_supports WHERE source_table IS NULL OR historical_fingerprint IS NULL
UNION ALL SELECT 'CAMPAIGN_DUPLICATE_LEGACY_IDS',coalesce(sum(duplicates-1),0) FROM(SELECT source_table,legacy_id,count(*) duplicates FROM public.campagnes_visuels_sites_supports GROUP BY source_table,legacy_id HAVING count(*)>1) duplicated
UNION ALL SELECT 'INVALID_CAMPAIGN_CONTEXT',count(*) FROM public.campagnes_visuels_sites_supports WHERE business_context IS DISTINCT FROM 'marketing'
UNION ALL SELECT 'INVALID_OPERATIONAL_CONTEXT',count(*) FROM public.communications_operationnelles_sites_supports WHERE business_context IS DISTINCT FROM 'operational_communication';

SELECT 'DATABASE_VIEWS_REFERENCING_LEGACY' AS metric,count(*) AS value FROM information_schema.views WHERE table_schema NOT IN('pg_catalog','information_schema') AND lower(view_definition) LIKE '%campagnes_et_visuels%'
UNION ALL SELECT 'DATABASE_FUNCTIONS_REFERENCING_LEGACY',count(*) FROM pg_catalog.pg_proc procedure JOIN pg_catalog.pg_namespace namespace ON namespace.oid=procedure.pronamespace WHERE namespace.nspname NOT IN('pg_catalog','information_schema') AND procedure.prokind IN('f','p') AND lower(CASE WHEN procedure.prokind IN('f','p') THEN pg_get_functiondef(procedure.oid) ELSE '' END) LIKE '%campagnes_et_visuels%';

SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports');
SELECT schemaname,tablename,policyname,roles,cmd,qual FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports') ORDER BY tablename,policyname;

ROLLBACK;
