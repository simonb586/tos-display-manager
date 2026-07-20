
-- TOS Display Manager — v0.12.8
-- Stabilisation complète des opérations terrain.
-- Installation : exécuter ce fichier une seule fois dans Supabase SQL Editor.

begin;

alter table public.infrastructures
  add column if not exists campagne_precedente text,
  add column if not exists visuel_precedent text,
  add column if not exists edt_precedent_associe text,
  add column if not exists legacy_campagnes_precedentes_quickbase text,
  add column if not exists legacy_edt_precedent_quickbase text,
  add column if not exists updated_at timestamptz default now();

-- Préserver les valeurs Quickbase importées dans raw_data avant toute normalisation.
update public.infrastructures
set
  legacy_campagnes_precedentes_quickbase = coalesce(
    legacy_campagnes_precedentes_quickbase,
    nullif(raw_data ->> 'Campagne précédentes', ''),
    nullif(raw_data ->> 'Campagne précédente', '')
  ),
  legacy_edt_precedent_quickbase = coalesce(
    legacy_edt_precedent_quickbase,
    nullif(raw_data ->> 'EDT précédent associé', '')
  ),
  campagne_precedente = coalesce(
    nullif(campagne_precedente, ''),
    nullif(raw_data ->> 'Campagne précédentes', ''),
    nullif(raw_data ->> 'Campagne précédente', '')
  ),
  edt_precedent_associe = coalesce(
    nullif(edt_precedent_associe, ''),
    nullif(raw_data ->> 'EDT précédent associé', '')
  )
where raw_data is not null;

create table if not exists public.terrain_operations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  type_operation text not null,
  support_id text,
  utilisateur text,
  statut text not null default 'En cours',
  etape text not null default 'Début',
  details jsonb not null default '{}'::jsonb,
  erreur text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists terrain_operations_support_idx
  on public.terrain_operations(support_id, created_at desc);

alter table public.terrain_operations enable row level security;
drop policy if exists "terrain_operations_read" on public.terrain_operations;
create policy "terrain_operations_read"
on public.terrain_operations for select to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur','Installateur'));
grant select on public.terrain_operations to authenticated;

-- Table normalisée des enjeux terrain. Elle devient la source fiable des nouveaux enjeux.
create table if not exists public.enjeux_terrain (
  id bigserial primary key,
  reference text not null unique,
  support_id text not null,
  type_enjeu text not null,
  description text,
  statut text not null default 'Ouvert',
  priorite text not null default 'Normale',
  photo_id bigint,
  photo_url text,
  storage_path text,
  utilisateur text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.enjeux_terrain enable row level security;
drop policy if exists "enjeux_terrain_read" on public.enjeux_terrain;
create policy "enjeux_terrain_read"
on public.enjeux_terrain for select to authenticated using (true);
grant select on public.enjeux_terrain to authenticated;

create or replace function public.finaliser_installation_terrain_v01273(
  p_support_id text,
  p_visuel_id bigint,
  p_nom_fichier text,
  p_storage_path text,
  p_photo_url text,
  p_utilisateur text default null,
  p_commentaires text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ref text := coalesce(nullif(trim(p_idempotency_key),''),
    'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;
  v_visual public.campagne_visuels_formats%rowtype;
  v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;
  v_photo public.support_photos%rowtype;
begin
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,'installation',p_support_id,p_utilisateur)
  on conflict(reference) do update set reference=excluded.reference
  returning id into v_op;

  select * into v_visual from public.campagne_visuels_formats
  where id=p_visuel_id and actif=true;
  if not found then raise exception 'Visuel actif introuvable'; end if;

  select * into v_campaign from public.campagnes_maitres
  where id=v_visual.campagne_id;
  if not found then raise exception 'Campagne introuvable'; end if;

  select * into v_infra from public.infrastructures
  where support_id=p_support_id for update;
  if not found then raise exception 'Support % introuvable',p_support_id; end if;

  update public.terrain_operations set etape='Photo' where id=v_op;

  update public.support_photos
  set est_principale=false
  where support_id=p_support_id and est_principale=true;

  insert into public.support_photos(
    support_id,campagne_id,visuel_id,type_photo,nom_fichier,storage_path,
    photo_url,thumbnail_url,prise_le,utilisateur,statut_validation,
    est_principale,validee_le
  )
  values(
    p_support_id,v_campaign.id,v_visual.id,'Installation',p_nom_fichier,p_storage_path,
    p_photo_url,p_photo_url,now(),p_utilisateur,'Validée',true,now()
  )
  on conflict do nothing;

  select * into v_photo from public.support_photos
  where support_id=p_support_id and storage_path=p_storage_path
  order by id desc limit 1;
  if not found then raise exception 'Photo non confirmée'; end if;

  update public.terrain_operations set etape='Infrastructure' where id=v_op;

  update public.infrastructures
  set
    campagne_precedente = case
      when campagne_actuelle is distinct from v_campaign.nom_campagne
      then campagne_actuelle else campagne_precedente end,
    visuel_precedent = case
      when visuel_campagne is distinct from v_visual.nom_visuel
      then visuel_campagne else visuel_precedent end,
    edt_precedent_associe = case
      when edt_associe is distinct from v_campaign.no_edt
      then edt_associe else edt_precedent_associe end,
    campagne_actuelle=v_campaign.nom_campagne,
    campagne_selon_visuel=v_campaign.nom_campagne,
    visuel_campagne=v_visual.nom_visuel,
    visuel_en_expo=v_visual.nom_visuel,
    visuel_actuel_cadre=p_photo_url,
    visuel_id=v_visual.id,
    phase_campagne=v_visual.phase,
    format_visuel=v_visual.format_support,
    edt_associe=coalesce(v_campaign.no_edt,edt_associe),
    photo_principale_url=p_photo_url,
    photo_miniature_url=p_photo_url,
    date_derniere_manipulation=now()::text,
    commentaires=coalesce(nullif(p_commentaires,''),commentaires),
    updated_at=now()
  where support_id=p_support_id
  returning * into v_infra;

  if v_infra.support_id is null
     or coalesce(v_infra.campagne_actuelle,'')<>coalesce(v_campaign.nom_campagne,'')
     or coalesce(v_infra.visuel_campagne,'')<>coalesce(v_visual.nom_visuel,'')
     or coalesce(v_infra.edt_associe,'')<>coalesce(v_campaign.no_edt,'')
     or coalesce(v_infra.photo_principale_url,'')<>coalesce(p_photo_url,'')
  then raise exception 'Vérification Infrastructure échouée'; end if;

  update public.terrain_operations set etape='Historique' where id=v_op;

  insert into public.historique_des_campagnes(
    support_id,campagne,visuel,no_edt,date_installation,
    photo_installation,utilisateur,raw_data
  )
  values(
    p_support_id,v_campaign.nom_campagne,v_visual.nom_visuel,v_campaign.no_edt,
    now()::text,p_photo_url,p_utilisateur,
    jsonb_build_object('reference',v_ref,'photo_id',v_photo.id,'source','v0.12.8')
  );

  if not exists(
    select 1 from public.historique_des_campagnes
    where support_id=p_support_id and raw_data->>'reference'=v_ref
  ) then raise exception 'Historique non confirmé'; end if;

  update public.terrain_operations
  set statut='Réussie',etape='Terminée',
      details=jsonb_build_object(
        'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,
        'edt',v_campaign.no_edt,'photo_id',v_photo.id,
        'campagne_precedente',v_infra.campagne_precedente,
        'visuel_precedent',v_infra.visuel_precedent,
        'edt_precedent',v_infra.edt_precedent_associe
      ),
      completed_at=now()
  where id=v_op;

  return jsonb_build_object(
    'ok',true,'reference',v_ref,'support_id',p_support_id,
    'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,
    'edt',v_campaign.no_edt,'photo_id',v_photo.id
  );
exception when others then
  update public.terrain_operations
  set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now()
  where reference=v_ref;
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm);
end;
$$;

grant execute on function public.finaliser_installation_terrain_v01273(
  text,bigint,text,text,text,text,text,text
) to authenticated;

create or replace function public.finaliser_intervention_terrain_v01273(
  p_support_id text,
  p_action text,
  p_type_enjeu text,
  p_commentaires text,
  p_nom_fichier text,
  p_storage_path text,
  p_photo_url text,
  p_utilisateur text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_action text := lower(trim(p_action));
  v_ref text := coalesce(nullif(trim(p_idempotency_key),''),
    upper(v_action)||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;
  v_photo public.support_photos%rowtype;
  v_issue_id bigint;
begin
  if v_action not in ('inspection','enjeu','photo') then
    raise exception 'Action terrain non permise';
  end if;
  if not exists(select 1 from public.infrastructures where support_id=p_support_id) then
    raise exception 'Support introuvable';
  end if;

  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,v_action,p_support_id,p_utilisateur)
  on conflict(reference) do update set reference=excluded.reference
  returning id into v_op;

  insert into public.support_photos(
    support_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,
    prise_le,utilisateur,statut_validation,est_principale
  )
  values(
    p_support_id,
    case when v_action='inspection' then 'Inspection'
         when v_action='enjeu' then 'Enjeu' else 'Photo' end,
    p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),p_utilisateur,
    case when v_action='inspection' then 'Validée' else 'À valider' end,
    false
  )
  on conflict do nothing;

  select * into v_photo from public.support_photos
  where support_id=p_support_id and storage_path=p_storage_path
  order by id desc limit 1;
  if not found then raise exception 'Photo non confirmée'; end if;

  if v_action='enjeu' then
    insert into public.enjeux_terrain(
      reference,support_id,type_enjeu,description,photo_id,photo_url,
      storage_path,utilisateur
    )
    values(
      v_ref,p_support_id,coalesce(nullif(trim(p_type_enjeu),''),'Autre'),
      p_commentaires,v_photo.id,p_photo_url,p_storage_path,p_utilisateur
    )
    returning id into v_issue_id;

    update public.infrastructures
    set enjeux=coalesce(nullif(trim(p_commentaires),''),'Enjeu déclaré'),
        type_enjeux=coalesce(nullif(trim(p_type_enjeu),''),'Autre'),
        updated_at=now()
    where support_id=p_support_id;

    if not exists(select 1 from public.enjeux_terrain where id=v_issue_id)
       or not exists(select 1 from public.infrastructures
                     where support_id=p_support_id
                       and coalesce(type_enjeux,'')=coalesce(nullif(trim(p_type_enjeu),''),'Autre'))
    then raise exception 'Enjeu non confirmé dans toutes les tables'; end if;
  end if;

  if to_regclass('public.inspections_terrain') is not null then
    insert into public.inspections_terrain(
      support_id,source_type,emplacement,action,commentaires,
      utilisateur_courriel,statut,photo_path,photo_url,created_at
    )
    select p_support_id,'Infrastructure',
           coalesce(i.emplacement_visibilite,i.site,''),
           v_action,p_commentaires,p_utilisateur,'Terminée',
           p_storage_path,p_photo_url,now()
    from public.infrastructures i where i.support_id=p_support_id;
  end if;

  update public.terrain_operations
  set statut='Réussie',etape='Terminée',
      details=jsonb_build_object('photo_id',v_photo.id,'enjeu_id',v_issue_id),
      completed_at=now()
  where id=v_op;

  return jsonb_build_object(
    'ok',true,'reference',v_ref,'support_id',p_support_id,
    'action',v_action,'photo_id',v_photo.id,'enjeu_id',v_issue_id
  );
exception when others then
  update public.terrain_operations
  set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now()
  where reference=v_ref;
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm);
end;
$$;

grant execute on function public.finaliser_intervention_terrain_v01273(
  text,text,text,text,text,text,text,text,text
) to authenticated;

commit;
