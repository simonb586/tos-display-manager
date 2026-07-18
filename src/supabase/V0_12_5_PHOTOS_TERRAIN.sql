-- TOS Display Manager — v0.12.5
-- Synchronisation automatique des photos terrain vers Infrastructure.

alter table public.support_photos
add column if not exists est_principale boolean not null default false;

alter table public.support_photos
add column if not exists commentaire_validation text;

alter table public.support_photos
add column if not exists validee_le timestamptz;

alter table public.support_photos
add column if not exists validee_par uuid;

alter table public.infrastructures
add column if not exists photo_miniature_url text;

alter table public.infrastructures
add column if not exists photo_principale_url text;

alter table public.infrastructures
add column if not exists visuel_actuel_cadre text;

create or replace function public.sync_infrastructure_photo_thumbnail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Une seule photo principale par support.
  if new.est_principale = true then
    update public.support_photos
    set est_principale = false
    where support_id = new.support_id
      and id <> new.id
      and est_principale = true;
  end if;

  -- Seule une photo validée et principale remplace l’image visible
  -- dans la table Infrastructure.
  if new.support_id is not null
     and new.statut_validation = 'Validée'
     and new.est_principale = true
     and coalesce(new.thumbnail_url, new.photo_url) is not null
  then
    update public.infrastructures
    set
      photo_miniature_url = coalesce(new.thumbnail_url, new.photo_url),
      photo_principale_url = coalesce(new.photo_url, new.thumbnail_url),
      visuel_actuel_cadre = coalesce(new.thumbnail_url, new.photo_url),
      updated_at = now()
    where support_id = new.support_id;
  end if;

  return new;
end;
$$;

drop trigger if exists support_photos_sync_infrastructure_thumbnail
on public.support_photos;

create trigger support_photos_sync_infrastructure_thumbnail
after insert or update of
  thumbnail_url,
  photo_url,
  statut_validation,
  est_principale
on public.support_photos
for each row
execute function public.sync_infrastructure_photo_thumbnail();

-- Règles métier :
-- Installation = Validée + principale.
-- Inspection = Validée, sans remplacer la principale.
-- Enjeu / autre = À valider, sans remplacer la principale.
create or replace function public.normalize_terrain_photo_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.type_photo, '')) = 'installation' then
    new.statut_validation := 'Validée';
    new.est_principale := true;
    new.validee_le := coalesce(new.validee_le, now());
  elsif lower(coalesce(new.type_photo, '')) = 'inspection' then
    new.statut_validation := 'Validée';
    new.est_principale := false;
    new.validee_le := coalesce(new.validee_le, now());
  elsif lower(coalesce(new.type_photo, '')) in ('enjeu', 'photo', 'autre photo') then
    new.statut_validation := 'À valider';
    new.est_principale := false;
  end if;

  new.thumbnail_url := coalesce(new.thumbnail_url, new.photo_url);
  return new;
end;
$$;

drop trigger if exists normalize_terrain_photo_rules
on public.support_photos;

create trigger normalize_terrain_photo_rules
before insert or update of type_photo, photo_url, thumbnail_url
on public.support_photos
for each row
execute function public.normalize_terrain_photo_rules();

create or replace function public.diagnostic_photos_terrain_v0125()
returns table(
  photos_total bigint,
  installations_principales bigint,
  inspections_validees bigint,
  photos_en_attente bigint,
  infrastructures_avec_miniature bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.support_photos),
    (
      select count(*)
      from public.support_photos
      where type_photo = 'Installation'
        and statut_validation = 'Validée'
        and est_principale = true
    ),
    (
      select count(*)
      from public.support_photos
      where type_photo = 'Inspection'
        and statut_validation = 'Validée'
    ),
    (
      select count(*)
      from public.support_photos
      where statut_validation = 'À valider'
    ),
    (
      select count(*)
      from public.infrastructures
      where coalesce(visuel_actuel_cadre, photo_miniature_url) is not null
    );
$$;

grant execute on function public.diagnostic_photos_terrain_v0125()
to authenticated;
