-- TOS v1.3.3.2 - Admissibilité Terrain par client, contexte et format.
-- Les relations visual_id servent au classement uniquement; aucune donnée n'est modifiée.
begin;

create or replace function public.terrain_visual_is_eligible_v1331(p_support_id text,p_visual_id bigint)
returns boolean language sql stable security invoker
set search_path=pg_catalog,public,pg_temp as $$
  select exists (
    select 1 from public.campagne_visuels_formats v
    join public.campagnes_maitres c on c.id=v.campagne_id
    join public.infrastructures i on i.support_id=p_support_id
    where v.id=p_visual_id and v.actif and c.publiee_terrain
      and lower(coalesce(c.statut,''))='active'
      and c.business_context in ('marketing','operational_communication')
      and c.client_id=i.client_id and v.client_id=i.client_id
      and (coalesce(v.is_out_of_frame,false)
        or public.tdm_normalize_display_format(coalesce(i.format_affichage,i.type_support))
           is not distinct from public.tdm_normalize_display_format(v.format_support))
  );
$$;
revoke execute on function public.terrain_visual_is_eligible_v1331(text,bigint) from public,anon,authenticated;

create or replace function public.lister_visuels_installation_terrain_v1331(p_support_id text,p_edt_phase_id bigint)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp as $$
declare v_user public.utilisateurs%rowtype;v_client_id bigint;v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;
  select i.client_id into v_client_id from public.infrastructures i
  join public.edt_supports es on es.support_id=i.support_id
  join public.edt_phases ep on ep.id=es.phase_id and ep.edt_id=es.edt_id
  join public.suivi_des_edt e on e.id=ep.edt_id
  where i.support_id=p_support_id and ep.id=p_edt_phase_id and ep.phase_type='installation'
    and e.archived_at is null and i.client_id=e.client_id;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_client_id is null then raise exception 'support_client_scope_missing' using errcode='42501'; end if;
  if v_user.client_id is not null and v_user.client_id<>v_client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'campagne_id',v.campagne_id,'phase',v.phase,'nom_visuel',v.nom_visuel,'code_visuel',v.code_visuel,
    'format_support',v.format_support,'instructions_terrain',v.instructions_terrain,
    'is_out_of_frame',coalesce(v.is_out_of_frame,false),'business_context',c.business_context,
    'is_exact_relation',(exists(select 1 from public.campagnes_visuels_sites_supports a where a.support_id=p_support_id and a.campaign_id=v.campagne_id and a.visual_id=v.id)
      or exists(select 1 from public.communications_operationnelles_sites_supports a where a.support_id=p_support_id and a.campaign_id=v.campagne_id and a.visual_id=v.id)),
    'campagne',jsonb_build_object('id',c.id,'nom_campagne',c.nom_campagne,'business_context',c.business_context,'client_id',c.client_id))
    order by (exists(select 1 from public.campagnes_visuels_sites_supports a where a.support_id=p_support_id and a.campaign_id=v.campagne_id and a.visual_id=v.id)
      or exists(select 1 from public.communications_operationnelles_sites_supports a where a.support_id=p_support_id and a.campaign_id=v.campagne_id and a.visual_id=v.id)) desc,
      c.business_context,c.nom_campagne,v.nom_visuel,v.format_support),'[]'::jsonb) into v_result
  from public.campagne_visuels_formats v join public.campagnes_maitres c on c.id=v.campagne_id
  where v.actif and c.publiee_terrain and lower(coalesce(c.statut,''))='active'
    and c.business_context in ('marketing','operational_communication')
    and c.client_id=v_client_id and v.client_id=v_client_id
    and public.terrain_visual_is_eligible_v1331(p_support_id,v.id);
  return v_result;
end;
$$;
revoke execute on function public.lister_visuels_installation_terrain_v1331(text,bigint) from public,anon;
grant execute on function public.lister_visuels_installation_terrain_v1331(text,bigint) to authenticated;
commit;
