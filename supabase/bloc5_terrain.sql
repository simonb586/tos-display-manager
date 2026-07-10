-- TOS Display Manager — Bloc 5 Terrain V1
-- Exécuter dans Supabase SQL Editor.

create table if not exists public.inspections_terrain (
  id bigserial primary key,
  support_id text,
  no_arret text,
  source_type text not null,
  emplacement text,
  action text not null,
  affiche_presente boolean default false,
  affiche_conforme boolean default false,
  support_endommage boolean default false,
  nettoyage_effectue boolean default false,
  remplacement_effectue boolean default false,
  commentaires text,
  latitude double precision,
  longitude double precision,
  precision_gps_m double precision,
  photo_path text,
  photo_url text,
  utilisateur_courriel text,
  statut text default 'Terminée',
  sync_note text,
  created_at timestamptz default now()
);

create index if not exists inspections_terrain_support_id_idx
on public.inspections_terrain (support_id);

create index if not exists inspections_terrain_no_arret_idx
on public.inspections_terrain (no_arret);

create index if not exists inspections_terrain_created_at_idx
on public.inspections_terrain (created_at desc);

alter table public.inspections_terrain enable row level security;

drop policy if exists "terrain_authenticated_read" on public.inspections_terrain;
create policy "terrain_authenticated_read"
on public.inspections_terrain
for select
to authenticated
using (true);

drop policy if exists "terrain_authenticated_insert" on public.inspections_terrain;
create policy "terrain_authenticated_insert"
on public.inspections_terrain
for insert
to authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('terrain-photos', 'terrain-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "terrain_photos_authenticated_upload" on storage.objects;
create policy "terrain_photos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'terrain-photos');

drop policy if exists "terrain_photos_public_read" on storage.objects;
create policy "terrain_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'terrain-photos');
