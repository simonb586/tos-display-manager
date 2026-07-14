select * from public.diagnostic_bloc12();

select
  courriel,
  nom,
  role,
  statut,
  invitation_statut,
  invitation_envoyee_le
from public.utilisateurs
order by nom nulls last, courriel;

select
  source_table,
  source_field,
  destination_table,
  destination_field,
  condition_json
from public.relation_rules
where condition_json ->> 'grid_shortcut' = 'true'
order by source_table, source_field;
