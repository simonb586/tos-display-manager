-- Vérification Bloc 8.1

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_name = 'support_photos_sync_infrastructure_thumbnail';

select
  support_id,
  visuel_actuel_cadre,
  photo_miniature_url,
  photo_principale_url
from public.infrastructures
where photo_miniature_url is not null
limit 20;

select * from public.diagnostic_carte_v08();
