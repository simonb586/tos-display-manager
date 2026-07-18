-- TOS Display Manager — v0.12.6
-- Finalisation atomique des installations terrain et rafraîchissement en temps réel.

create or replace function public.finaliser_installation_terrain(
  p_support_id text,
  p_visuel_id bigint,
  p_nom_fichier text,
  p_storage_path text,
  p_photo_url text,
  p_utilisateur text default null,
  p_commentaires text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.campagne_visuels_formats%rowtype;
  c public.campagnes_maitres%rowtype;
  i public.infrastructures%rowtype;
  photo_row public.support_photos%rowtype;
  operation_id uuid := gen_random_uuid();
begin
  select *
  into v
  from public.campagne_visuels_formats
  where id = p_visuel_id
    and actif = true;

  if not found then
    raise exception 'Visuel actif introuvable.';
  end if;

  select *
  into c
  from public.campagnes_maitres
  where id = v.campagne_id
    and publiee_terrain = true;

  if not found then
    raise exception 'Campagne publiée introuvable.';
  end if;

  select *
  into i
  from public.infrastructures
  where support_id = p_support_id
  for update;

  if not found then
    raise exception 'Support % introuvable dans Infrastructure.', p_support_id;
  end if;

  if lower(trim(coalesce(i.format_affichage, i.format, i.type_support, '')))
     <> lower(trim(coalesce(v.format_support, ''))) then
    raise exception 'Format incompatible : support %, visuel %.',
      coalesce(i.format_affichage, i.format, i.type_support),
      v.format_support;
  end if;

  update public.support_photos
  set est_principale = false
  where support_id = p_support_id
    and est_principale = true;

  insert into public.support_photos(
    support_id,
    campagne_id,
    visuel_id,
    type_photo,
    nom_fichier,
    storage_path,
    photo_url,
    thumbnail_url,
    prise_le,
    utilisateur,
    statut_validation,
    est_principale,
    validee_le
  )
  values(
    p_support_id,
    c.id,
    v.id,
    'Installation',
    p_nom_fichier,
    p_storage_path,
    p_photo_url,
    p_photo_url,
    now(),
    p_utilisateur,
    'Validée',
    true,
    now()
  )
  returning * into photo_row;

  update public.infrastructures
  set
    campagne_precedente = case
      when campagne_actuelle is distinct from c.nom_campagne
      then campagne_actuelle
      else campagne_precedente
    end,
    edt_precedent_associe = case
      when edt_associe is distinct from c.no_edt
      then edt_associe
      else edt_precedent_associe
    end,
    campagne_actuelle = c.nom_campagne,
    campagne_selon_visuel = c.nom_campagne,
    visuel_campagne = v.nom_visuel,
    visuel_en_expo = v.nom_visuel,
    visuel_actuel_cadre = p_photo_url,
    visuel_id = v.id,
    phase_campagne = v.phase,
    format_visuel = v.format_support,
    edt_associe = coalesce(c.no_edt, edt_associe),
    photo_principale_url = p_photo_url,
    photo_miniature_url = p_photo_url,
    date_derniere_manipulation = now()::text,
    commentaires = coalesce(p_commentaires, commentaires),
    updated_at = now()
  where support_id = p_support_id
  returning * into i;

  insert into public.historique_des_campagnes(
    support_id,
    campagne,
    visuel,
    no_edt,
    date_installation,
    photo_installation,
    utilisateur,
    raw_data
  )
  values(
    p_support_id,
    c.nom_campagne,
    v.nom_visuel,
    c.no_edt,
    now()::text,
    p_photo_url,
    p_utilisateur,
    jsonb_build_object(
      'operation_id', operation_id,
      'phase', v.phase,
      'format', v.format_support,
      'photo_path', p_storage_path,
      'support_photo_id', photo_row.id,
      'source', 'Application terrain v0.12.6'
    )
  );

  update public.campagne_visuels_formats
  set
    quantite_installee = coalesce(quantite_installee, 0) + 1,
    updated_at = now()
  where id = v.id;

  if to_regclass('public.inspections_terrain') is not null then
    insert into public.inspections_terrain(
      support_id,
      source_type,
      emplacement,
      campagne_id,
      campagne,
      visuel,
      no_edt,
      action,
      commentaires,
      utilisateur_courriel,
      statut,
      photo_path,
      photo_url,
      created_at
    )
    values(
      p_support_id,
      'Infrastructure',
      coalesce(i.emplacement_visibilite, i.site, ''),
      c.id,
      c.nom_campagne,
      v.nom_visuel,
      c.no_edt,
      'installation',
      p_commentaires,
      p_utilisateur,
      'Terminée',
      p_storage_path,
      p_photo_url,
      now()
    );
  end if;

  if to_regclass('public.journal_propagations') is not null then
    insert into public.journal_propagations(
      operation_id,
      campagne_id,
      support_id,
      declencheur,
      statut,
      details,
      utilisateur
    )
    values(
      operation_id,
      c.id,
      p_support_id,
      'Installation terrain atomique',
      'Réussi',
      jsonb_build_object(
        'visuel', v.nom_visuel,
        'phase', v.phase,
        'format', v.format_support,
        'photo_id', photo_row.id
      ),
      p_utilisateur
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Infrastructure, historique et photo mis à jour.',
    'support_id', p_support_id,
    'campagne', c.nom_campagne,
    'visuel', v.nom_visuel,
    'photo_id', photo_row.id,
    'infrastructure', to_jsonb(i)
  );
exception
  when others then
    raise exception 'Finalisation terrain annulée : %', sqlerrm;
end;
$$;

grant execute on function public.finaliser_installation_terrain(
  text, bigint, text, text, text, text, text
) to authenticated;

-- Activer les événements temps réel, sans erreur si déjà activés.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'infrastructures'
  ) then
    alter publication supabase_realtime add table public.infrastructures;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_photos'
  ) then
    alter publication supabase_realtime add table public.support_photos;
  end if;
end $$;

create or replace function public.diagnostic_sync_terrain_v0126()
returns table(
  installations_total bigint,
  infrastructures_avec_photo bigint,
  historiques_avec_photo bigint,
  photos_principales bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (
      select count(*)
      from public.inspections_terrain
      where lower(action) = 'installation'
    ),
    (
      select count(*)
      from public.infrastructures
      where photo_principale_url is not null
         or visuel_actuel_cadre ~ '^https?://'
    ),
    (
      select count(*)
      from public.historique_des_campagnes
      where photo_installation is not null
    ),
    (
      select count(*)
      from public.support_photos
      where est_principale = true
        and statut_validation = 'Validée'
    );
$$;

grant execute on function public.diagnostic_sync_terrain_v0126()
to authenticated;
