-- Bloc 13.2-P0 — métadonnées photo et historique permanent (additif).
-- À appliquer manuellement après validation en préproduction. Aucune modification RLS.
begin;

alter table public.support_photos
  add column if not exists edt_id text,
  add column if not exists source text,
  add column if not exists original_filename text,
  add column if not exists normalized_filename text,
  add column if not exists storage_bucket text,
  add column if not exists captured_at timestamptz,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists uploaded_by text,
  add column if not exists intervention_id text,
  add column if not exists inspection_id text,
  add column if not exists issue_id text,
  add column if not exists is_current_visual boolean not null default false,
  add column if not exists replaced_photo_id text,
  add column if not exists status text not null default 'active',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.infrastructures
  add column if not exists date_visuel_actuel timestamptz;

create unique index if not exists support_photos_storage_object_uq
  on public.support_photos(storage_bucket, storage_path)
  where deleted_at is null;
create index if not exists support_photos_support_history_idx
  on public.support_photos(support_id, captured_at desc, uploaded_at desc);
create index if not exists support_photos_campaign_edt_idx
  on public.support_photos(campagne_id, edt_id);
create unique index if not exists support_photos_one_current_visual_uq
  on public.support_photos(support_id)
  where deleted_at is null and is_current_visual;

create or replace function public.sync_photo_current_visual_v132p0()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.captured_at := coalesce(new.captured_at,new.prise_le,now());
  new.prise_le := coalesce(new.prise_le,new.captured_at);
  new.original_filename := coalesce(new.original_filename,new.nom_fichier);
  new.normalized_filename := coalesce(new.normalized_filename,new.nom_fichier);
  new.storage_bucket := coalesce(nullif(new.storage_bucket,''),
    case
      when coalesce(new.photo_url,'') like '%/terrain-photos/%' then 'terrain-photos'
      when coalesce(new.photo_url,'') like '%/support-photos/%' then 'support-photos'
      else 'support-photos'
    end);
  new.source := coalesce(nullif(new.source,''),
    case when new.storage_bucket='terrain-photos' then 'terrain' else 'legacy' end);
  new.updated_at := now();
  if tg_op='INSERT' or new.type_photo is distinct from old.type_photo then
    new.is_current_visual := lower(coalesce(new.type_photo,''))='inspection'
      or (lower(coalesce(new.type_photo,''))='installation' and new.est_principale);
  end if;
  new.est_principale := new.is_current_visual;
  if new.is_current_visual then
    update public.support_photos set is_current_visual=false,est_principale=false,updated_at=now()
      where support_id=new.support_id and id<>new.id and (is_current_visual or est_principale);
  end if;
  return new;
end $$;

drop trigger if exists support_photos_workflow_v132p0 on public.support_photos;
create trigger support_photos_workflow_v132p0 before insert or update on public.support_photos
for each row execute function public.sync_photo_current_visual_v132p0();

create or replace function public.apply_photo_current_visual_v132p0()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.is_current_visual and new.status='active' then
    update public.infrastructures set
      photo_principale_url=new.photo_url,
      photo_miniature_url=coalesce(new.thumbnail_url,new.photo_url),
      visuel_actuel_cadre=coalesce(new.thumbnail_url,new.photo_url),
      date_visuel_actuel=new.captured_at,
      updated_at=now()
    where support_id=new.support_id;
  end if;
  return new;
end $$;

drop trigger if exists support_photos_current_visual_v132p0 on public.support_photos;
create trigger support_photos_current_visual_v132p0 after insert or update of is_current_visual,status on public.support_photos
for each row execute function public.apply_photo_current_visual_v132p0();

commit;
