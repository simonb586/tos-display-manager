-- TOS Display Manager v0.12.10
-- Normalisation des formats et garde-fou des installations terrain.
-- À appliquer seulement après validation en environnement Preview.

begin;

create or replace function public.tdm_normalize_display_format(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_value text;
  v_match text[];
  v_width numeric;
  v_height numeric;
begin
  v_value := lower(coalesce(p_value, ''));
  v_value := translate(
    v_value,
    'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ×✕',
    'aaaaaaceeeeiiiinooooouuuuyyxx'
  );
  v_value := replace(replace(replace(replace(v_value, '"', ''), '”', ''), '″', ''), chr(160), ' ');
  v_value := regexp_replace(v_value, '\m(pouces?|po|inches?|inch)\M', '', 'g');
  v_value := regexp_replace(v_value, '\s+', ' ', 'g');
  v_value := btrim(v_value);

  v_match := regexp_match(
    v_value,
    '([0-9]+(?:[.,][0-9]+)?)\s*x\s*([0-9]+(?:[.,][0-9]+)?)'
  );

  if v_match is not null then
    v_width := replace(v_match[1], ',', '.')::numeric;
    v_height := replace(v_match[2], ',', '.')::numeric;
    return v_width::double precision::text
      || 'x'
      || v_height::double precision::text;
  end if;

  v_value := regexp_replace(v_value, '\m(portrait|paysage|landscape)\M', '', 'g');
  return regexp_replace(v_value, '[^a-z0-9]+', '', 'g');
end;
$$;

create or replace function public.diagnostic_visuels_support_v01210(p_support_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_format text;
  v_format_key text;
  v_total_active integer := 0;
  v_matching integer := 0;
  v_published integer := 0;
  v_eligible integer := 0;
  v_formats jsonb := '[]'::jsonb;
begin
  if public.current_app_role() not in ('Administrateur', 'Coordonnateur', 'Installateur') then
    raise exception 'Permission terrain requise.';
  end if;

  select coalesce(format_affichage, type_support)
    into v_format
    from public.infrastructures
   where support_id = p_support_id;

  if not found then
    raise exception 'Support % introuvable.', p_support_id;
  end if;

  v_format_key := public.tdm_normalize_display_format(v_format);

  select
    count(*) filter (where cv.actif = true)::integer,
    count(*) filter (
      where cv.actif = true
        and public.tdm_normalize_display_format(cv.format_support) = v_format_key
    )::integer,
    count(*) filter (
      where cv.actif = true
        and public.tdm_normalize_display_format(cv.format_support) = v_format_key
        and c.publiee_terrain = true
    )::integer,
    count(*) filter (
      where cv.actif = true
        and public.tdm_normalize_display_format(cv.format_support) = v_format_key
        and c.publiee_terrain = true
        and lower(coalesce(c.statut, '')) = 'active'
    )::integer
    into v_total_active, v_matching, v_published, v_eligible
    from public.campagne_visuels_formats cv
    left join public.campagnes_maitres c on c.id = cv.campagne_id;

  select coalesce(jsonb_agg(format_support order by format_support), '[]'::jsonb)
    into v_formats
    from (
      select distinct cv.format_support
        from public.campagne_visuels_formats cv
       where cv.actif = true
         and nullif(btrim(cv.format_support), '') is not null
    ) formats;

  return jsonb_build_object(
    'support_id', p_support_id,
    'support_format', v_format,
    'support_format_key', v_format_key,
    'total_active_visuals', v_total_active,
    'matching_format', v_matching,
    'published_campaigns', v_published,
    'eligible_visuals', v_eligible,
    'available_formats', v_formats
  );
end;
$$;

create or replace function public.finaliser_installation_terrain_v01210(
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
  v_support_format text;
  v_visual_format text;
  v_visual_active boolean;
  v_campaign_published boolean;
  v_campaign_status text;
begin
  if public.current_app_role() not in ('Administrateur', 'Coordonnateur', 'Installateur') then
    raise exception 'Permission terrain requise.';
  end if;

  select coalesce(format_affichage, type_support)
    into v_support_format
    from public.infrastructures
   where support_id = p_support_id;
  if not found then raise exception 'Support % introuvable.', p_support_id; end if;

  select cv.format_support, cv.actif, c.publiee_terrain, c.statut
    into v_visual_format, v_visual_active, v_campaign_published, v_campaign_status
    from public.campagne_visuels_formats cv
    join public.campagnes_maitres c on c.id = cv.campagne_id
   where cv.id = p_visuel_id;
  if not found then raise exception 'Visuel ou campagne introuvable.'; end if;

  if v_visual_active is not true then
    raise exception 'Le visuel sélectionné est inactif.';
  end if;
  if v_campaign_published is not true then
    raise exception 'La campagne du visuel n''est pas publiée sur le terrain.';
  end if;
  if lower(coalesce(v_campaign_status, '')) <> 'active' then
    raise exception 'La campagne du visuel n''est pas active.';
  end if;
  if nullif(public.tdm_normalize_display_format(v_support_format), '') is null then
    raise exception 'Le support ne possède aucun format exploitable.';
  end if;
  if public.tdm_normalize_display_format(v_support_format)
     is distinct from public.tdm_normalize_display_format(v_visual_format) then
    raise exception 'Format incompatible : support % / visuel %.', v_support_format, v_visual_format;
  end if;

  return public.finaliser_installation_terrain_v01273(
    p_support_id,
    p_visuel_id,
    p_nom_fichier,
    p_storage_path,
    p_photo_url,
    p_utilisateur,
    p_commentaires,
    p_idempotency_key
  );
end;
$$;

grant execute on function public.diagnostic_visuels_support_v01210(text) to authenticated;
grant execute on function public.finaliser_installation_terrain_v01210(
  text, bigint, text, text, text, text, text, text
) to authenticated;

commit;
