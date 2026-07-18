-- TOS Display Manager — v0.12.7.2
-- Corrige : column reference "reference" is ambiguous.
-- Les écritures métier sont annulées en cas d'erreur, mais le diagnostic est conservé.

create table if not exists public.terrain_sync_diagnostics (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  support_id text,
  visuel_id bigint,
  utilisateur text,
  etape text not null,
  statut text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.terrain_sync_diagnostics enable row level security;

drop policy if exists "terrain_sync_diagnostics_read"
on public.terrain_sync_diagnostics;

create policy "terrain_sync_diagnostics_read"
on public.terrain_sync_diagnostics
for select
to authenticated
using (
  public.current_app_role() in (
    'Administrateur',
    'Coordonnateur',
    'Installateur'
  )
);

grant select on public.terrain_sync_diagnostics to authenticated;

create or replace function public.finaliser_installation_terrain_v0127(
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
set search_path = public
as $$
declare
  v_reference text := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'TERRAIN-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS') ||
    '-' ||
    regexp_replace(coalesce(p_support_id, ''), '[^A-Za-z0-9]', '', 'g')
  );

  v_diag_id uuid;
  v_visual public.campagne_visuels_formats%rowtype;
  v_campaign public.campagnes_maitres%rowtype;
  v_infrastructure public.infrastructures%rowtype;
  v_photo public.support_photos%rowtype;
  v_history_count bigint := 0;
  v_error_message text := null;
begin
  -- Le diagnostic est créé hors de la sous-transaction métier.
  insert into public.terrain_sync_diagnostics(
    reference,
    support_id,
    visuel_id,
    utilisateur,
    etape,
    statut,
    details
  )
  values(
    v_reference,
    p_support_id,
    p_visuel_id,
    p_utilisateur,
    'Début',
    'En cours',
    jsonb_build_object(
      'storage_path', p_storage_path,
      'photo_url', p_photo_url
    )
  )
  returning id into v_diag_id;

  begin
    select cv.*
    into v_visual
    from public.campagne_visuels_formats cv
    where cv.id = p_visuel_id
      and cv.actif = true;

    if not found then
      raise exception 'Visuel actif introuvable.';
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Visuel',
      statut = 'Réussi',
      details = jsonb_build_object(
        'nom_visuel', v_visual.nom_visuel,
        'format_support', v_visual.format_support
      ),
      created_at = now()
    where d.id = v_diag_id;

    select cm.*
    into v_campaign
    from public.campagnes_maitres cm
    where cm.id = v_visual.campagne_id;

    if not found then
      raise exception 'Campagne introuvable.';
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Campagne',
      statut = 'Réussi',
      details = jsonb_build_object(
        'nom_campagne', v_campaign.nom_campagne,
        'no_edt', v_campaign.no_edt
      ),
      created_at = now()
    where d.id = v_diag_id;

    select infra.*
    into v_infrastructure
    from public.infrastructures infra
    where infra.support_id = p_support_id
    for update;

    if not found then
      raise exception 'Support % introuvable dans Infrastructure.', p_support_id;
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Infrastructure source',
      statut = 'Réussi',
      details = jsonb_build_object(
        'support_id', v_infrastructure.support_id
      ),
      created_at = now()
    where d.id = v_diag_id;

    if exists (
      select 1
      from public.support_photos sp
      where sp.support_id = p_support_id
        and sp.storage_path = p_storage_path
    ) then
      select sp.*
      into v_photo
      from public.support_photos sp
      where sp.support_id = p_support_id
        and sp.storage_path = p_storage_path
      order by sp.id desc
      limit 1;
    else
      update public.support_photos sp
      set est_principale = false
      where sp.support_id = p_support_id
        and sp.est_principale = true;

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
        v_campaign.id,
        v_visual.id,
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
      returning * into v_photo;
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Photo principale',
      statut = 'Réussi',
      details = jsonb_build_object(
        'photo_id', v_photo.id,
        'photo_url', v_photo.photo_url
      ),
      created_at = now()
    where d.id = v_diag_id;

    update public.infrastructures infra
    set
      campagne_precedente = case
        when infra.campagne_actuelle is distinct from v_campaign.nom_campagne
        then infra.campagne_actuelle
        else infra.campagne_precedente
      end,
      campagne_actuelle = v_campaign.nom_campagne,
      campagne_selon_visuel = v_campaign.nom_campagne,
      visuel_campagne = v_visual.nom_visuel,
      visuel_en_expo = v_visual.nom_visuel,
      visuel_actuel_cadre = p_photo_url,
      visuel_id = v_visual.id,
      phase_campagne = v_visual.phase,
      format_visuel = v_visual.format_support,
      edt_associe = coalesce(v_campaign.no_edt, infra.edt_associe),
      photo_principale_url = p_photo_url,
      photo_miniature_url = p_photo_url,
      commentaires = coalesce(p_commentaires, infra.commentaires),
      updated_at = now()
    where infra.support_id = p_support_id
    returning infra.* into v_infrastructure;

    if v_infrastructure.support_id is null then
      raise exception 'Infrastructure non mise à jour.';
    end if;

    if coalesce(v_infrastructure.campagne_actuelle, '')
         <> coalesce(v_campaign.nom_campagne, '')
       or coalesce(v_infrastructure.visuel_campagne, '')
         <> coalesce(v_visual.nom_visuel, '')
       or coalesce(v_infrastructure.visuel_actuel_cadre, '')
         <> coalesce(p_photo_url, '')
       or coalesce(v_infrastructure.photo_principale_url, '')
         <> coalesce(p_photo_url, '')
    then
      raise exception 'Vérification Infrastructure échouée.';
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Vérification Infrastructure',
      statut = 'Réussi',
      details = jsonb_build_object(
        'campagne_actuelle', v_infrastructure.campagne_actuelle,
        'visuel_campagne', v_infrastructure.visuel_campagne,
        'visuel_actuel_cadre', v_infrastructure.visuel_actuel_cadre,
        'edt_associe', v_infrastructure.edt_associe
      ),
      created_at = now()
    where d.id = v_diag_id;

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
      v_campaign.nom_campagne,
      v_visual.nom_visuel,
      v_campaign.no_edt,
      now()::text,
      p_photo_url,
      p_utilisateur,
      jsonb_build_object(
        'reference', v_reference,
        'photo_id', v_photo.id,
        'phase', v_visual.phase,
        'format', v_visual.format_support,
        'source', 'Application terrain v0.12.7.2'
      )
    );

    select count(*)
    into v_history_count
    from public.historique_des_campagnes h
    where h.support_id = p_support_id
      and h.raw_data ->> 'reference' = v_reference;

    if v_history_count <> 1 then
      raise exception 'Historique non confirmé.';
    end if;

    update public.terrain_sync_diagnostics d
    set
      etape = 'Finalisation',
      statut = 'Réussi',
      details = jsonb_build_object(
        'campagne', v_campaign.nom_campagne,
        'visuel', v_visual.nom_visuel,
        'edt', v_campaign.no_edt,
        'photo_id', v_photo.id
      ),
      created_at = now()
    where d.id = v_diag_id;

  exception
    when others then
      get stacked diagnostics v_error_message = message_text;
  end;

  if v_error_message is not null then
    -- Les opérations de la sous-transaction ont été annulées,
    -- mais cette ligne de diagnostic est conservée.
    update public.terrain_sync_diagnostics d
    set
      etape = 'Finalisation',
      statut = 'Échec',
      details = jsonb_build_object(
        'erreur', v_error_message
      ),
      created_at = now()
    where d.id = v_diag_id;

    return jsonb_build_object(
      'ok', false,
      'reference', v_reference,
      'message', 'Installation annulée : ' || v_error_message
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'reference', v_reference,
    'message', 'Installation confirmée dans Infrastructure et les tables liées.',
    'support_id', p_support_id,
    'campagne', v_campaign.nom_campagne,
    'visuel', v_visual.nom_visuel,
    'edt', v_campaign.no_edt,
    'photo_id', v_photo.id
  );
end;
$$;

grant execute on function public.finaliser_installation_terrain_v0127(
  text,
  bigint,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;
