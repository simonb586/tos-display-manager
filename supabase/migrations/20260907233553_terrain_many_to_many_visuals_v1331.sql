-- TOS v1.3.3.1 - Terrain: contexte EDT/support many-to-many et visuels admissibles.
-- Migration additive préparée seulement; aucune donnée historique n'est supprimée.
begin;

create or replace function public.terrain_visual_is_eligible_v1331(
  p_support_id text,
  p_visual_id bigint
) returns boolean
language sql stable security invoker
set search_path=pg_catalog,public,pg_temp
as $$
  select exists (
    select 1
    from public.campagne_visuels_formats v
    where v.id=p_visual_id
      and (
        coalesce(v.is_out_of_frame,false)
        or exists (
          select 1 from public.campagnes_supports cs
          where cs.campagne_id=v.campagne_id and cs.support_id=p_support_id
            and lower(trim(cs.visuel_attendu))=lower(trim(v.nom_visuel))
        )
        or exists (
          select 1 from public.campagnes_visuels_sites_supports a
          where a.support_id=p_support_id and a.campaign_id=v.campagne_id
            and a.visual_id=v.id
        )
        or exists (
          select 1 from public.communications_operationnelles_sites_supports a
          where a.support_id=p_support_id and a.campaign_id=v.campagne_id
            and a.visual_id=v.id
        )
      )
  );
$$;
revoke execute on function public.terrain_visual_is_eligible_v1331(text,bigint) from public,anon,authenticated;

create or replace function public.lister_visuels_installation_terrain_v1331(
  p_support_id text,
  p_edt_phase_id bigint
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_user public.utilisateurs%rowtype;
  v_client_id bigint;
  v_campaign_id bigint;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then
    raise exception 'terrain_role_denied' using errcode='42501';
  end if;

  select i.client_id,e.campagne_id into v_client_id,v_campaign_id
  from public.infrastructures i
  join public.edt_supports es on es.support_id=i.support_id
  join public.edt_phases ep on ep.id=es.phase_id and ep.edt_id=es.edt_id
  join public.suivi_des_edt e on e.id=ep.edt_id
  where i.support_id=p_support_id and ep.id=p_edt_phase_id
    and ep.phase_type='installation' and e.archived_at is null
    and i.client_id=e.client_id;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_client_id is null then raise exception 'support_client_scope_missing' using errcode='42501'; end if;
  if v_user.client_id is not null and v_user.client_id<>v_client_id then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'campagne_id',v.campagne_id,'phase',v.phase,'nom_visuel',v.nom_visuel,
    'code_visuel',v.code_visuel,'format_support',v.format_support,
    'instructions_terrain',v.instructions_terrain,'is_out_of_frame',coalesce(v.is_out_of_frame,false),
    'business_context',c.business_context,
    'campagne',jsonb_build_object('id',c.id,'nom_campagne',c.nom_campagne,'business_context',c.business_context,'client_id',c.client_id)
  ) order by c.business_context,c.nom_campagne,v.nom_visuel,v.format_support),'[]'::jsonb)
  into v_result
  from public.campagne_visuels_formats v
  join public.campagnes_maitres c on c.id=v.campagne_id
  where v.campagne_id=v_campaign_id and v.actif and c.publiee_terrain
    and lower(coalesce(c.statut,''))='active'
    and c.business_context in ('marketing','operational_communication')
    and c.client_id=v_client_id and v.client_id=v_client_id
    and public.terrain_visual_is_eligible_v1331(p_support_id,v.id);
  return v_result;
end;
$$;
revoke execute on function public.lister_visuels_installation_terrain_v1331(text,bigint) from public,anon;
grant execute on function public.lister_visuels_installation_terrain_v1331(text,bigint) to authenticated;

create or replace function public.finaliser_installation_terrain_v1331(
  p_support_id text,p_edt_phase_id bigint,p_visuel_id bigint,p_nom_fichier text,
  p_storage_path text,p_photo_url text,p_utilisateur text default null,
  p_commentaires text default null,p_idempotency_key text default null
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_user public.utilisateurs%rowtype;
  v_ref text:=coalesce(nullif(trim(p_idempotency_key),''),'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_visual public.campagne_visuels_formats%rowtype;v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;v_photo public.support_photos%rowtype;v_edt public.suivi_des_edt%rowtype;v_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;

  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  if not found then raise exception 'support_not_found'; end if;
  select e.* into v_edt from public.edt_phases ep
  join public.edt_supports es on es.phase_id=ep.id and es.edt_id=ep.edt_id
  join public.suivi_des_edt e on e.id=ep.edt_id
  where ep.id=p_edt_phase_id and ep.phase_type='installation' and es.support_id=p_support_id and e.archived_at is null;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_infra.client_id is null or v_edt.client_id is null or v_infra.client_id<>v_edt.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  if v_user.client_id is not null and v_user.client_id<>v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select * into v_visual from public.campagne_visuels_formats where id=p_visuel_id and actif;
  if not found then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  select * into v_campaign from public.campagnes_maitres where id=v_visual.campagne_id and publiee_terrain and lower(coalesce(statut,''))='active';
  if not found or v_campaign.business_context not in ('marketing','operational_communication') then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  if v_campaign.id<>v_edt.campagne_id then raise exception 'visual_campaign_context_denied' using errcode='42501'; end if;
  if v_campaign.client_id is distinct from v_infra.client_id or v_visual.client_id is distinct from v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  if not public.terrain_visual_is_eligible_v1331(p_support_id,p_visuel_id) then raise exception 'visual_support_denied' using errcode='42501'; end if;
  v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));

  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,'installation',p_support_id,v_email)
  on conflict(reference) do update set reference=excluded.reference returning id into v_op;
  update public.support_photos set est_principale=false where support_id=p_support_id and est_principale;
  insert into public.support_photos(support_id,campagne_id,visuel_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,prise_le,utilisateur,statut_validation,est_principale,validee_le)
  values(p_support_id,v_campaign.id,v_visual.id,'Installation',p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),v_email,'Validée',true,now()) on conflict do nothing;
  select * into v_photo from public.support_photos where support_id=p_support_id and storage_path=p_storage_path order by id desc limit 1;
  if not found then raise exception 'photo_not_persisted'; end if;

  update public.infrastructures set
    campagne_precedente=case when campagne_actuelle is distinct from v_campaign.nom_campagne then campagne_actuelle else campagne_precedente end,
    visuel_precedent=case when visuel_campagne is distinct from v_visual.nom_visuel then visuel_campagne else visuel_precedent end,
    edt_precedent_associe=case when edt_associe is distinct from v_edt.no_edt then edt_associe else edt_precedent_associe end,
    campagne_actuelle=v_campaign.nom_campagne,campagne_selon_visuel=v_campaign.nom_campagne,
    visuel_campagne=v_visual.nom_visuel,visuel_en_expo=v_visual.nom_visuel,visuel_actuel_cadre=p_photo_url,
    visuel_id=v_visual.id,phase_campagne=v_visual.phase,format_visuel=v_visual.format_support,edt_associe=v_edt.no_edt,
    photo_principale_url=p_photo_url,photo_miniature_url=p_photo_url,date_derniere_manipulation=now()::text,
    commentaires=coalesce(nullif(p_commentaires,''),commentaires),updated_at=now()
  where support_id=p_support_id returning * into v_infra;

  insert into public.historique_des_campagnes(support_id,campagne,visuel,no_edt,date_installation,photo_installation,utilisateur,raw_data)
  values(p_support_id,v_campaign.nom_campagne,v_visual.nom_visuel,v_edt.no_edt,now()::text,p_photo_url,v_email,
    jsonb_build_object('reference',v_ref,'photo_id',v_photo.id,'source','v1.3.3.1','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'business_context',v_campaign.business_context));
  update public.edt_supports set statut='Terminé',progression=100,completed_at=coalesce(completed_at,now()),updated_at=now()
  where edt_id=v_edt.id and phase_id=p_edt_phase_id and support_id=p_support_id;
  perform public.refresh_edt_enterprise(v_edt.id);
  update public.terrain_operations set statut='Réussie',etape='Terminée',details=jsonb_build_object('campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id),completed_at=now() where id=v_op;
  return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id);
exception when others then
  update public.terrain_operations set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now() where reference=v_ref;
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm);
end;
$$;
revoke execute on function public.finaliser_installation_terrain_v1331(text,bigint,bigint,text,text,text,text,text,text) from public,anon;
grant execute on function public.finaliser_installation_terrain_v1331(text,bigint,bigint,text,text,text,text,text,text) to authenticated;

commit;
