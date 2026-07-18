-- Vérification Bloc 8 après exécution du script principal.

select * from public.diagnostic_carte_v08();

select
  role,
  visible_tables,
  visible_columns
from public.role_ui_permissions
order by role;

select
  trigger_name,
  event_object_table
from information_schema.triggers
where trigger_name = 'support_photos_sync_infrastructure_thumbnail';
