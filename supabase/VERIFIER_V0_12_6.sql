select * from public.diagnostic_sync_terrain_v0126();

select
  support_id,
  campagne_actuelle,
  visuel_campagne,
  visuel_en_expo,
  visuel_actuel_cadre,
  photo_miniature_url,
  photo_principale_url,
  edt_associe,
  updated_at
from public.infrastructures
order by updated_at desc nulls last
limit 20;

select
  id,
  support_id,
  type_photo,
  statut_validation,
  est_principale,
  photo_url,
  prise_le
from public.support_photos
order by prise_le desc nulls last
limit 20;
