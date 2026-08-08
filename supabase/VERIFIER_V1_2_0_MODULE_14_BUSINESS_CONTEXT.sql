-- READ ONLY : ce fichier ne modifie aucune donnée ni aucun objet.
select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='campagnes_maitres' and column_name='business_context';
select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.campagnes_maitres'::regclass and conname='campagnes_maitres_business_context_v120_check';
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='campagnes_maitres' and indexname='campagnes_maitres_business_context_v120_idx';
select business_context,count(*) nombre from public.campagnes_maitres group by business_context order by business_context;
select id,nom_campagne,business_context from public.campagnes_maitres where lower(trim(nom_campagne))='exo info';
select count(*) valeurs_invalides from public.campagnes_maitres where business_context not in ('marketing','operational_communication') or business_context is null;
