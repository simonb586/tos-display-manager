select * from public.diagnostic_bloc10();

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_name in (
  'tdm_audit_row_changes',
  'support_photos_sync_infrastructure_thumbnail'
)
order by event_object_table;

select *
from public.admin_change_log
order by changed_at desc
limit 20;
