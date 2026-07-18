select
  reference,
  support_id,
  visuel_id,
  etape,
  statut,
  details,
  created_at
from public.terrain_sync_diagnostics
order by created_at desc
limit 50;

select
  support_id,
  campagne_actuelle,
  visuel_campagne,
  edt_associe,
  visuel_actuel_cadre,
  photo_miniature_url,
  photo_principale_url,
  updated_at
from public.infrastructures
order by updated_at desc nulls last
limit 20;
