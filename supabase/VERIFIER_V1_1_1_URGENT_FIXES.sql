select column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='campagne_visuels_formats' and column_name='is_out_of_frame';
select p.proname,pg_get_function_identity_arguments(p.oid) arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='delete_or_archive_master_campaign_v111';
select count(*) as photos_sans_type from public.support_photos where nullif(trim(type_photo),'') is null;
select count(*) as campagnes_avec_dependances from public.campagnes_maitres c where exists(select 1 from public.support_photos p where p.campagne_id=c.id) or exists(select 1 from public.campagne_visuels_formats v where v.campagne_id=c.id);
