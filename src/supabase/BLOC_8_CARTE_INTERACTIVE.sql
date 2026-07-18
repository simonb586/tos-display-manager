-- TOS Display Manager — Bloc 8 : Carte interactive
-- Version robuste : aucun index fonctionnel IMMUTABLE requis.
-- Exécuter une seule fois dans Supabase SQL Editor.

create or replace function public.diagnostic_carte_v08()
returns table(
  total_infrastructures bigint,
  infrastructures_geolocalisees bigint,
  infrastructures_sans_gps bigint,
  latitude_invalide bigint,
  longitude_invalide bigint
)
language sql
security definer
set search_path = public
as $$
  with source as (
    select
      trim(coalesce(to_jsonb(i)->>'latitude', '')) as latitude_texte,
      trim(coalesce(to_jsonb(i)->>'longitude', '')) as longitude_texte
    from public.infrastructures i
  ),
  cleaned as (
    select
      latitude_texte,
      longitude_texte,
      case
        when replace(latitude_texte, ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
        then replace(latitude_texte, ',', '.')::double precision
        else null
      end as lat,
      case
        when replace(longitude_texte, ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
        then replace(longitude_texte, ',', '.')::double precision
        else null
      end as lon
    from source
  )
  select
    count(*)::bigint,
    count(*) filter (
      where lat between -90 and 90
        and lon between -180 and 180
    )::bigint,
    count(*) filter (
      where latitude_texte = ''
         or longitude_texte = ''
    )::bigint,
    count(*) filter (
      where latitude_texte <> ''
        and (lat is null or lat not between -90 and 90)
    )::bigint,
    count(*) filter (
      where longitude_texte <> ''
        and (lon is null or lon not between -180 and 180)
    )::bigint
  from cleaned;
$$;

grant execute on function public.diagnostic_carte_v08()
to authenticated;

do $$
begin
  if to_regclass('public.relation_fields') is not null then
    insert into public.relation_fields (
      module_name,
      table_name,
      field_name,
      field_label,
      is_primary_source,
      triggers_updates,
      visible_terrain,
      terrain_roles,
      terrain_section,
      validation_status
    )
    values
    (
      'Infrastructures',
      'infrastructures',
      'latitude',
      'Latitude cartographique',
      true,
      true,
      true,
      array['Administrateur','Coordonnateur','Installateur'],
      'Localisation',
      'Validée'
    ),
    (
      'Infrastructures',
      'infrastructures',
      'longitude',
      'Longitude cartographique',
      true,
      true,
      true,
      array['Administrateur','Coordonnateur','Installateur'],
      'Localisation',
      'Validée'
    )
    on conflict (table_name, field_name) do nothing;
  end if;
end $$;


-- Ajustements Bloc 8 : visibilité par rôle et miniatures dans Infrastructure.

create table if not exists public.role_ui_permissions (
  role text primary key,
  visible_tables text[] not null default '{}',
  visible_columns jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.role_ui_permissions enable row level security;

drop policy if exists "role_ui_permissions_authenticated_read" on public.role_ui_permissions;
create policy "role_ui_permissions_authenticated_read"
on public.role_ui_permissions
for select
to authenticated
using (true);

drop policy if exists "role_ui_permissions_admin_write" on public.role_ui_permissions;
create policy "role_ui_permissions_admin_write"
on public.role_ui_permissions
for all
to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

insert into public.role_ui_permissions(role, visible_tables, visible_columns)
values
(
  'Administrateur',
  array['*'],
  '{}'::jsonb
),
(
  'Coordonnateur',
  array[
    'Infrastructures','Campagnes et visuels','Répertoire des affiches',
    'Enjeux des cadres et supports','Liste des arrêts','Photos',
    'Bons de travail','Historique des campagnes','Suivi des EDT','Clients'
  ],
  '{}'::jsonb
),
(
  'Installateur',
  array[
    'Infrastructures','Liste des arrêts','Photos',
    'Bons de travail','Enjeux des cadres et supports'
  ],
  '{}'::jsonb
),
(
  'Client-Admin',
  array[
    'Infrastructures','Campagnes et visuels','Photos',
    'Bons de travail','Historique des campagnes','Suivi des EDT'
  ],
  '{}'::jsonb
),
(
  'Client',
  array['Infrastructures','Campagnes et visuels','Photos'],
  '{}'::jsonb
)
on conflict(role) do nothing;

grant select on public.role_ui_permissions to authenticated;
grant insert, update, delete on public.role_ui_permissions to authenticated;

-- La colonne format_visuel n'est pas supprimée physiquement afin de ne perdre aucune donnée.
-- Elle est masquée dans la table et les exports Infrastructure.

-- Bloc 8.1 : compatibilité avec la structure réelle de public.support_photos.
-- Colonnes disponibles :
-- support_id, photo_url, thumbnail_url, prise_le, statut_validation.

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
  if new.support_id is not null
     and coalesce(new.thumbnail_url, new.photo_url) is not null
     and new.statut_validation = 'Validée'
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
after insert or update of thumbnail_url, photo_url, statut_validation
on public.support_photos
for each row
when (
  new.statut_validation = 'Validée'
  and coalesce(new.thumbnail_url, new.photo_url) is not null
)
execute function public.sync_infrastructure_photo_thumbnail();

with latest_photo as (
  select distinct on (support_id)
    support_id,
    coalesce(thumbnail_url, photo_url) as miniature,
    coalesce(photo_url, thumbnail_url) as principale
  from public.support_photos
  where coalesce(thumbnail_url, photo_url) is not null
  order by
    support_id,
    (statut_validation = 'Validée') desc,
    prise_le desc nulls last,
    id desc
)
update public.infrastructures i
set
  photo_miniature_url = p.miniature,
  photo_principale_url = p.principale,
  visuel_actuel_cadre = p.miniature,
  updated_at = now()
from latest_photo p
where i.support_id = p.support_id;
