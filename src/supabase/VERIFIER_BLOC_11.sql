select * from public.diagnostic_bloc11();

select trigger_name, event_object_table
from information_schema.triggers
where trigger_name in ('tdm_operations_audit','sync_edt_progress_from_work_order')
order by event_object_table;

select *
from public.operations_history
order by created_at desc
limit 20;
