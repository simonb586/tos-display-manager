BEGIN READ ONLY;

-- Présence des quatre sources.
SELECT 'TABLE_PRESENCE' AS control_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('campagnes_et_visuels','campagnes_visuels_sites_supports','communications_operationnelles','communications_operationnelles_sites_supports')
ORDER BY c.relname;

-- Structure exhaustive : ordre, type, nullabilité et valeur par défaut.
SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN
 ('campagnes_et_visuels','campagnes_visuels_sites_supports','communications_operationnelles','communications_operationnelles_sites_supports')
ORDER BY table_name,ordinal_position;

-- Toute colonne historique doit exister avec le même type dans la destination.
SELECT 'MISSING_HISTORICAL_COLUMNS' AS metric,count(*) AS value
FROM information_schema.columns old_column
WHERE old_column.table_schema='public'
  AND old_column.table_name IN ('campagnes_et_visuels','communications_operationnelles')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns new_column
    WHERE new_column.table_schema='public'
      AND new_column.table_name=CASE old_column.table_name
        WHEN 'campagnes_et_visuels' THEN 'campagnes_visuels_sites_supports'
        ELSE 'communications_operationnelles_sites_supports' END
      AND new_column.column_name=old_column.column_name
      AND new_column.data_type=old_column.data_type
      AND new_column.udt_name=old_column.udt_name);

-- Clés, contraintes et index.
SELECT tc.table_name,tc.constraint_name,tc.constraint_type,kcu.column_name,ccu.table_name AS referenced_table,ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_schema=tc.constraint_schema AND ccu.constraint_name=tc.constraint_name
WHERE tc.table_schema='public' AND tc.table_name IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
ORDER BY tc.table_name,tc.constraint_type,tc.constraint_name,kcu.ordinal_position;
SELECT schemaname,tablename,indexname,indexdef FROM pg_catalog.pg_indexes
WHERE schemaname='public' AND tablename IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
ORDER BY tablename,indexname;

-- Comptes et identité historique.
SELECT 'OLD_CAMPAIGN_ROWS' AS metric,count(*) AS value FROM public.campagnes_et_visuels
UNION ALL SELECT 'NEW_CAMPAIGN_ROWS',count(*) FROM public.campagnes_visuels_sites_supports
UNION ALL SELECT 'MISSING_CAMPAIGN_ROWS',count(*) FROM public.campagnes_et_visuels o WHERE NOT EXISTS (SELECT 1 FROM public.campagnes_visuels_sites_supports n WHERE n.legacy_id=o.id AND n.source_table='campagnes_et_visuels')
UNION ALL SELECT 'EXTRA_CAMPAIGN_ROWS',count(*) FROM public.campagnes_visuels_sites_supports n WHERE n.source_table='campagnes_et_visuels' AND NOT EXISTS (SELECT 1 FROM public.campagnes_et_visuels o WHERE o.id=n.legacy_id)
UNION ALL SELECT 'MISMATCHED_CAMPAIGN_ROWS',count(*) FROM public.campagnes_visuels_sites_supports n JOIN public.campagnes_et_visuels o ON o.id=n.legacy_id WHERE n.historical_fingerprint IS DISTINCT FROM md5(jsonb_build_array(o.id,o.nom_campagne,o.visuel_terrain,o.date_debut,o.date_fin,o.statut_campagne,o.support_id,o.emplacement,o.date_mise_a_jour,o.raw_data,o.created_at,o.updated_at)::text)
UNION ALL SELECT 'CAMPAIGN_HASH_MISMATCHES',count(*) FROM public.campagnes_visuels_sites_supports n JOIN public.campagnes_et_visuels o ON o.id=n.legacy_id WHERE n.historical_fingerprint IS DISTINCT FROM md5(jsonb_build_array(o.id,o.nom_campagne,o.visuel_terrain,o.date_debut,o.date_fin,o.statut_campagne,o.support_id,o.emplacement,o.date_mise_a_jour,o.raw_data,o.created_at,o.updated_at)::text);

SELECT 'OLD_OPERATIONAL_ROWS' AS metric,count(*) AS value FROM public.communications_operationnelles
UNION ALL SELECT 'NEW_OPERATIONAL_ROWS',count(*) FROM public.communications_operationnelles_sites_supports
UNION ALL SELECT 'MISSING_OPERATIONAL_ROWS',count(*) FROM public.communications_operationnelles o WHERE NOT EXISTS (SELECT 1 FROM public.communications_operationnelles_sites_supports n WHERE n.legacy_id=o.id AND n.source_table='communications_operationnelles')
UNION ALL SELECT 'EXTRA_OPERATIONAL_ROWS',count(*) FROM public.communications_operationnelles_sites_supports n WHERE n.source_table='communications_operationnelles' AND NOT EXISTS (SELECT 1 FROM public.communications_operationnelles o WHERE o.id=n.legacy_id)
UNION ALL SELECT 'MISMATCHED_OPERATIONAL_ROWS',count(*) FROM public.communications_operationnelles_sites_supports n JOIN public.communications_operationnelles o ON o.id=n.legacy_id WHERE n.historical_fingerprint IS DISTINCT FROM md5(jsonb_build_array(o.id,o.emplacement,o.message,o.date_debut,o.date_fin,o.statut,o.no_arret,o.site_ou_arret,o.support_id,o.no_edt,o.related_voiture,o.visuel_message,o.visuel_terrain,o.raw_data,o.created_at,o.updated_at)::text)
UNION ALL SELECT 'OPERATIONAL_HASH_MISMATCHES',count(*) FROM public.communications_operationnelles_sites_supports n JOIN public.communications_operationnelles o ON o.id=n.legacy_id WHERE n.historical_fingerprint IS DISTINCT FROM md5(jsonb_build_array(o.id,o.emplacement,o.message,o.date_debut,o.date_fin,o.statut,o.no_arret,o.site_ou_arret,o.support_id,o.no_edt,o.related_voiture,o.visuel_message,o.visuel_terrain,o.raw_data,o.created_at,o.updated_at)::text);

-- Contexte et qualité des enrichissements. Une ligne impossible à enrichir reste légitime.
SELECT 'INVALID_CAMPAIGN_BUSINESS_CONTEXT' AS metric,count(*) AS value FROM public.campagnes_visuels_sites_supports WHERE business_context IS DISTINCT FROM 'marketing'
UNION ALL SELECT 'INVALID_OPERATIONAL_BUSINESS_CONTEXT',count(*) FROM public.communications_operationnelles_sites_supports WHERE business_context IS DISTINCT FROM 'operational_communication'
UNION ALL SELECT 'EXO_INFO_WRONG_CONTEXT',count(*) FROM public.communications_operationnelles_sites_supports WHERE lower(coalesce(message,'')) LIKE '%exo info%' AND business_context IS DISTINCT FROM 'operational_communication';

SELECT source_table,
 count(*) FILTER(WHERE site IS NOT NULL) AS rows_with_site,
 count(*) FILTER(WHERE support_id IS NOT NULL) AS rows_with_support,
 count(*) FILTER(WHERE infrastructure_id IS NOT NULL) AS rows_with_infrastructure,
 count(*) FILTER(WHERE site IS NOT NULL AND support_id IS NOT NULL AND infrastructure_id IS NOT NULL) AS fully_enriched_rows,
 count(*) FILTER(WHERE support_id IS NOT NULL AND (site IS NULL OR infrastructure_id IS NULL)) AS partially_enriched_rows,
 count(*) FILTER(WHERE support_id IS NULL AND site IS NULL AND infrastructure_id IS NULL) AS unenrichable_rows
FROM (SELECT source_table,site,support_id,infrastructure_id FROM public.campagnes_visuels_sites_supports
 UNION ALL SELECT source_table,site,support_id,infrastructure_id FROM public.communications_operationnelles_sites_supports) enriched
GROUP BY source_table ORDER BY source_table;

SELECT 'CAMPAIGN_ORPHAN_INFRASTRUCTURES' AS metric,count(*) AS value FROM public.campagnes_visuels_sites_supports n WHERE n.infrastructure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.id=n.infrastructure_id)
UNION ALL SELECT 'OPERATIONAL_ORPHAN_INFRASTRUCTURES',count(*) FROM public.communications_operationnelles_sites_supports n WHERE n.infrastructure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.infrastructures i WHERE i.id=n.infrastructure_id)
UNION ALL SELECT 'CAMPAIGN_ORPHAN_CAMPAIGNS',count(*) FROM public.campagnes_visuels_sites_supports n WHERE n.campaign_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.campagnes_maitres c WHERE c.id=n.campaign_id)
UNION ALL SELECT 'OPERATIONAL_ORPHAN_CAMPAIGNS',count(*) FROM public.communications_operationnelles_sites_supports n WHERE n.campaign_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.campagnes_maitres c WHERE c.id=n.campaign_id);

-- Les doublons de jointure ont le même legacy_id; les lignes historiques distinctes restent comptées séparément.
SELECT 'CAMPAIGN_JOIN_DUPLICATES' AS metric,coalesce(sum(duplicate_count-1),0) AS value FROM (SELECT source_table,legacy_id,count(*) duplicate_count FROM public.campagnes_visuels_sites_supports GROUP BY source_table,legacy_id HAVING count(*)>1) d
UNION ALL SELECT 'OPERATIONAL_JOIN_DUPLICATES',coalesce(sum(duplicate_count-1),0) FROM (SELECT source_table,legacy_id,count(*) duplicate_count FROM public.communications_operationnelles_sites_supports GROUP BY source_table,legacy_id HAVING count(*)>1) d
UNION ALL SELECT 'LEGITIMATE_CAMPAIGN_HISTORICAL_ROWS',count(*) FROM public.campagnes_visuels_sites_supports
UNION ALL SELECT 'LEGITIMATE_OPERATIONAL_HISTORICAL_ROWS',count(*) FROM public.communications_operationnelles_sites_supports;

-- RLS, policies et privilèges effectifs. Résultat attendu : policies internes seulement.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
ORDER BY tablename,policyname;
SELECT grantee,table_name,privilege_type,is_grantable FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
  AND grantee IN ('PUBLIC','anon','authenticated') ORDER BY table_name,grantee,privilege_type;
SELECT role_name,table_name,
 has_table_privilege(role_name,'public.'||table_name,'SELECT') AS can_select,
 has_table_privilege(role_name,'public.'||table_name,'INSERT') AS can_insert,
 has_table_privilege(role_name,'public.'||table_name,'UPDATE') AS can_update,
 has_table_privilege(role_name,'public.'||table_name,'DELETE') AS can_delete
FROM (VALUES('anon'),('authenticated')) roles(role_name)
CROSS JOIN (VALUES('campagnes_visuels_sites_supports'),('communications_operationnelles_sites_supports')) tables(table_name)
ORDER BY table_name,role_name;
SELECT c.relname AS table_name,e.privilege_type
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) e
WHERE n.nspname='public' AND c.relname IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
  AND e.grantee=0
ORDER BY c.relname,e.privilege_type;
SELECT 'DANGEROUS_DIRECT_POLICIES' AS metric,count(*) AS value FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename IN ('campagnes_visuels_sites_supports','communications_operationnelles_sites_supports')
 AND (roles&&ARRAY['public','anon']::name[] OR (roles&&ARRAY['authenticated']::name[] AND regexp_replace(lower(coalesce(qual,'')),'\s','','g') IN ('true','(true)')));

-- Module 17 : identité serveur, SECURITY DEFINER, search_path et privilège EXECUTE.
SELECT p.proname,p.prosecdef,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition,
 EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('client_portal_identity_v120','client_can_access_campaign_v120','client_portal_list_v120')
ORDER BY p.proname;

-- Les scénarios Client A/B doivent être exécutés avec JWT de test en préproduction :
-- accès direct aux deux tables => aucune ligne; RPC => organisation dérivée de auth.uid().
SELECT 'CROSS_CLIENT_STATIC_GUARD' AS control_name,
 bool_and(position('auth.uid()' in pg_get_functiondef(p.oid))>0) AS auth_uid_used,
 bool_and(position('p_client_id' in pg_get_function_identity_arguments(p.oid))=0) AS no_authoritative_client_parameter
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('client_portal_identity_v120','client_can_access_campaign_v120','client_portal_list_v120');

ROLLBACK;
