-- Vérification v0.12.9 Lot 3
select 'support_photos' as objet, to_regclass('public.support_photos') is not null as ok
union all select 'photo_action_log', to_regclass('public.photo_action_log') is not null
union all select 'RPC suppression', to_regprocedure('public.supprimer_photo_support_v0129_lot3(text)') is not null
union all select 'fonction rôle', to_regprocedure('public.tos_current_role()') is not null;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='support_photos'
  and column_name in ('id','support_id','storage_path','photo_url','thumbnail_url','est_principale')
order by column_name;

select policyname,cmd,roles
from pg_policies
where schemaname='public' and tablename in ('support_photos','photo_action_log')
order by tablename,policyname;
