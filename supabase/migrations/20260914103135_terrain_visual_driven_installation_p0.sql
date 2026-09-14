-- Installation chooses a visual. Its optional canonical EDT comes from the visual.
-- No edt_supports association is created; existing administrative assignments survive.
-- Existing v1331 writer remains available for audited historical callers.
BEGIN;
CREATE OR REPLACE FUNCTION public.lister_visuels_installation_terrain_v1331(p_support_id text, p_edt_phase_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user public.utilisateurs%rowtype;v_client_id bigint;v_result jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;
  if p_edt_phase_id is null then
    select i.client_id into v_client_id from public.infrastructures i where i.support_id=p_support_id;
    if not found then raise exception 'support_scope_denied' using errcode='42501';end if;
  else
  select i.client_id into v_client_id from public.infrastructures i
  join public.edt_supports es on es.support_id=i.support_id
  join public.edt_phases ep on ep.id=es.phase_id and ep.edt_id=es.edt_id
  join public.suivi_des_edt e on e.id=ep.edt_id
  where i.support_id=p_support_id and ep.id=p_edt_phase_id and ep.phase_type='installation'
    and e.archived_at is null and i.client_id=e.client_id;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  end if;
  if v_client_id is null then raise exception 'support_client_scope_missing' using errcode='42501'; end if;
  if v_user.client_id is not null and v_user.client_id<>v_client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',v.id,'campagne_id',v.campagne_id,'phase',v.phase,'nom_visuel',v.nom_visuel,'code_visuel',v.code_visuel,
    'format_support',v.format_support,'instructions_terrain',v.instructions_terrain,
    'edt_phase_id',v.edt_phase_id,'edt_number',(select e.no_edt from public.edt_phases ep join public.suivi_des_edt e on e.id=ep.edt_id where ep.id=v.edt_phase_id and ep.client_id is not distinct from v.client_id and e.client_id=v.client_id and e.campagne_id=v.campagne_id),'is_out_of_frame',coalesce(v.is_out_of_frame,false),'business_context',c.business_context,
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
END;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.finaliser_installation_terrain_v1343(p_support_id text, p_visuel_id bigint, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_commentaires text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p_edt_phase_id bigint;
  v_user public.utilisateurs%rowtype;v_prior public.terrain_operations%rowtype;
  v_ref text:=coalesce(nullif(trim(p_idempotency_key),''),'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_visual public.campagne_visuels_formats%rowtype;v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;v_photo public.support_photos%rowtype;v_edt public.suivi_des_edt%rowtype;v_email text;
BEGIN
SELECT v.edt_phase_id INTO p_edt_phase_id FROM public.campagne_visuels_formats v WHERE v.id=p_visuel_id FOR SHARE;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visuel_id AND public.tos_table_resource_scope(sec_visual.client_id,p_support_id,sec_visual.campagne_id,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
  if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501'; end if;

  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  if not found then raise exception 'support_not_found'; end if;
  if p_edt_phase_id is not null then
  select e.* into v_edt from public.edt_phases ep
  join public.suivi_des_edt e on e.id=ep.edt_id
  where ep.id=p_edt_phase_id and ep.phase_type='installation' and e.archived_at is null;
  if not found then raise exception 'cross_context_support_denied' using errcode='42501'; end if;
  if v_infra.client_id is null or v_edt.client_id is null or v_infra.client_id<>v_edt.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  end if;
  if v_user.client_id is not null and v_user.client_id<>v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;

  select * into v_visual from public.campagne_visuels_formats where id=p_visuel_id and actif;
  if not found then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  select * into v_campaign from public.campagnes_maitres where id=v_visual.campagne_id and publiee_terrain and lower(coalesce(statut,''))='active';
  if not found or v_campaign.business_context not in ('marketing','operational_communication') then raise exception 'visual_campaign_denied' using errcode='42501'; end if;
  if v_campaign.id<>v_edt.campagne_id then raise exception 'visual_campaign_context_denied' using errcode='42501'; end if;
  if v_campaign.client_id is distinct from v_infra.client_id or v_visual.client_id is distinct from v_infra.client_id then raise exception 'cross_client_denied' using errcode='42501'; end if;
  if not public.terrain_visual_is_eligible_v1331(p_support_id,p_visuel_id) then raise exception 'visual_support_denied' using errcode='42501'; end if;
  v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));

  if p_storage_path is null or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  select * into v_prior from public.terrain_operations where reference=v_ref for update;
  if found then
    if v_prior.support_id is distinct from p_support_id or v_prior.type_operation is distinct from 'installation' then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
    if v_prior.statut='Réussie' then
      if (v_prior.details->>'edt_phase_id')::bigint is distinct from p_edt_phase_id or not exists(select 1 from public.support_photos p where p.id=(v_prior.details->>'photo_id')::bigint and p.support_id=p_support_id and p.storage_path=p_storage_path and p.visuel_id=p_visuel_id) then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
      return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_prior.details->>'campagne','visuel',v_prior.details->>'visuel','edt',v_prior.details->>'edt','edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_prior.details->'photo_id');
    end if;
  end if;
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,'installation',p_support_id,v_email)
  on conflict(reference) do update set reference=excluded.reference returning id into v_op;
  update public.support_photos set est_principale=false where support_id=p_support_id and est_principale;
  insert into public.support_photos(storage_bucket,client_id,support_id,campagne_id,visuel_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,prise_le,utilisateur,statut_validation,est_principale,validee_le)
  values('terrain-photos',v_infra.client_id,p_support_id,v_campaign.id,v_visual.id,'Installation',p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),v_email,'Validée',true,now()) on conflict do nothing;
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
  if v_edt.id is not null then perform public.refresh_edt_enterprise(v_edt.id);end if;
  update public.terrain_operations set statut='Réussie',etape='Terminée',details=jsonb_build_object('campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id),completed_at=now() where id=v_op;
  return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'campagne',v_campaign.nom_campagne,'visuel',v_visual.nom_visuel,'edt',v_edt.no_edt,'edt_id',v_edt.id,'edt_phase_id',p_edt_phase_id,'photo_id',v_photo.id);
exception when others then
  update public.terrain_operations set statut='Échouée',erreur=sqlerrm,etape='Annulée',completed_at=now() where reference=v_ref AND statut IS DISTINCT FROM 'Réussie';
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm,'code',sqlstate);
END;
END;
$function$
;
REVOKE ALL ON FUNCTION public.finaliser_installation_terrain_v1343(text,bigint,text,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finaliser_installation_terrain_v1343(text,bigint,text,text,text,text,text,text) TO authenticated;
COMMIT;
