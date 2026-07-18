select * from public.diagnostic_correctifs_v0111();

select
  table_name,
  count(*) as nombre_de_champs
from public.relation_fields
group by table_name
order by table_name;

select
  source_table,
  source_field,
  destination_table,
  destination_field,
  enabled,
  validation_status
from public.relation_rules
order by source_table, source_field;
