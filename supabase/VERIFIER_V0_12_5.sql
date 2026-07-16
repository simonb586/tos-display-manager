select * from public.diagnostic_photos_terrain_v0125();

select
  id,
  support_id,
  type_photo,
  statut_validation,
  est_principale,
  thumbnail_url,
  photo_url,
  prise_le
from public.support_photos
order by prise_le desc nulls last
limit 20;

select
  support_id,
  visuel_actuel_cadre,
  photo_miniature_url,
  photo_principale_url
from public.infrastructures
where coalesce(visuel_actuel_cadre, photo_miniature_url) is not null
limit 20;
