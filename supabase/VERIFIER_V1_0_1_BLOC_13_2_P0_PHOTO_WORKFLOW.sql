-- READ ONLY — vérification Bloc 13.2-P0.
select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='support_photos'
and column_name in ('edt_id','source','original_filename','normalized_filename','storage_bucket','captured_at','uploaded_at','uploaded_by','intervention_id','inspection_id','issue_id','is_current_visual','replaced_photo_id','status','metadata','updated_at')
order by column_name;

select support_id,count(*) as photos,
  count(*) filter(where is_current_visual) as visuels_actuels,
  count(*) filter(where campagne_id is null) as sans_campagne,
  count(*) filter(where edt_id is null) as sans_edt
from public.support_photos where deleted_at is null group by support_id
order by photos desc limit 100;

select count(*) as chemins_dupliques from (
  select storage_bucket,storage_path from public.support_photos
  where deleted_at is null group by storage_bucket,storage_path having count(*)>1
) duplicates;

select count(*) as photos_orphelines from public.support_photos photo
where not exists(select 1 from public.infrastructures infrastructure where infrastructure.support_id=photo.support_id);

select trigger_name,event_manipulation,action_timing
from information_schema.triggers
where event_object_schema='public' and event_object_table='support_photos'
and trigger_name in ('support_photos_workflow_v132p0','support_photos_current_visual_v132p0')
order by trigger_name,event_manipulation;

select support_id,count(*) as visuels_actuels_concurrents
from public.support_photos where deleted_at is null and is_current_visual
group by support_id having count(*)>1;

select id,support_id,storage_bucket,storage_path
from public.support_photos
where deleted_at is null and (
  (photo_url like '%/terrain-photos/%' and storage_bucket<>'terrain-photos') or
  (photo_url like '%/support-photos/%' and storage_bucket<>'support-photos')
)
order by uploaded_at desc limit 100;

select schemaname,tablename,policyname,cmd
from pg_policies where schemaname='public' and tablename in ('support_photos','infrastructures')
order by tablename,policyname;
