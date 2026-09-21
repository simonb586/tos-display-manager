CREATE OR REPLACE FUNCTION public.finaliser_intervention_terrain_v01273(p_support_id text, p_action text, p_type_enjeu text, p_commentaires text, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_action text := lower(trim(p_action));
  v_ref text := coalesce(nullif(trim(p_idempotency_key),''),
    upper(v_action)||'-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_prior public.terrain_operations%rowtype;
  v_photo public.support_photos%rowtype;v_infra public.infrastructures%rowtype;
  v_issue_id bigint;
begin
  if v_action not in ('inspection','enjeu','photo','retrait') then
    raise exception 'Action terrain non permise';
  end if;
  if not exists(select 1 from public.infrastructures where support_id=p_support_id) then
    raise exception 'Support introuvable';
  end if;


  if auth.uid() is null or p_storage_path is null
     or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  select * into v_infra from public.infrastructures where support_id=p_support_id for update;
  IF NOT FOUND THEN RAISE EXCEPTION 'support_not_found'; END IF;
  PERFORM tdm_private.capture_display_baseline(p_support_id);

  select * into v_prior from public.terrain_operations where reference=v_ref for update;
  if found then
    if v_prior.support_id is distinct from p_support_id or v_prior.type_operation is distinct from v_action then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
    if v_prior.statut='Réussie' then
      if not exists(select 1 from public.support_photos p where p.id=(v_prior.details->>'photo_id')::bigint and p.support_id=p_support_id and p.storage_path=p_storage_path) then raise exception 'terrain_idempotency_conflict' using errcode='40001';end if;
      return jsonb_build_object('ok',true,'reference',v_ref,'support_id',p_support_id,'action',v_action)||v_prior.details;
    end if;
  end if;
  insert into public.terrain_operations(reference,type_operation,support_id,utilisateur)
  values(v_ref,v_action,p_support_id,p_utilisateur)
  on conflict(reference) do update set reference=excluded.reference
  returning id into v_op;

  insert into public.support_photos(
    storage_bucket,client_id,support_id,type_photo,nom_fichier,storage_path,photo_url,thumbnail_url,
    prise_le,utilisateur,statut_validation,est_principale
  )
  values(
    'terrain-photos',(select client_id from public.infrastructures where support_id=p_support_id),p_support_id,
    case when v_action='inspection' then 'Inspection'
         when v_action='enjeu' then 'Enjeu' when v_action='retrait' then 'Retrait' else 'Photo' end,
    p_nom_fichier,p_storage_path,p_photo_url,p_photo_url,now(),p_utilisateur,
    case when v_action in ('inspection','retrait') then 'Validée' else 'À valider' end,
    false
  )
  on conflict do nothing;

  select * into v_photo from public.support_photos
  where support_id=p_support_id and storage_path=p_storage_path
  order by id desc limit 1;
  if not found then raise exception 'Photo non confirmée'; end if;


  if v_action='retrait' then
    -- Keep every photo/file in the support gallery. Only clear current flags.
    update public.support_photos set is_current_visual=false,est_principale=false
      where support_id=p_support_id and (is_current_visual or est_principale);
    PERFORM tdm_private.apply_display_state(p_support_id,tdm_private.display_state(p_support_id)||(SELECT jsonb_build_object('campagne_precedente',coalesce(campagne_actuelle,campagne_precedente),'visuel_precedent',coalesce(visuel_campagne,visuel_precedent),'edt_precedent_associe',coalesce(edt_associe,edt_precedent_associe),'campagne_actuelle',null,'campagne_selon_visuel',null,'visuel_campagne',null,'visuel_en_expo',null,'visuel_actuel_cadre',null,'visuel_id',null,'phase_campagne',null,'format_visuel',null,'edt_associe',null,'photo_principale_url',null,'photo_miniature_url',null,'date_visuel_actuel',null,'date_derniere_manipulation',now()::text) FROM public.infrastructures WHERE support_id=p_support_id));


    insert into public.historique_des_campagnes(
      support_id,client_id,campagne,visuel,no_edt,date_retrait,photo_installation,utilisateur,raw_data)
    values(p_support_id,v_infra.client_id,v_infra.campagne_actuelle,v_infra.visuel_campagne,
      v_infra.edt_associe,now()::text,v_infra.photo_principale_url,p_utilisateur,
      jsonb_build_object('reference',v_ref,'source','terrain_retrait','photo_id',v_photo.id,
        'photo_retrait',p_photo_url,'previous_visual_id',v_infra.visuel_id));
  end if;
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
  where reference=v_ref AND statut IS DISTINCT FROM 'Réussie';
  return jsonb_build_object('ok',false,'reference',v_ref,'message',sqlerrm,'code',sqlstate);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.finaliser_intervention_terrain_v1342(p_support_id text, p_edt_phase_id bigint, p_action text, p_type_enjeu text, p_commentaires text, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user public.utilisateurs%rowtype;v_context record;v_email text;v_result jsonb;v_issue_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_phase_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 -- An issue belongs directly to its support; historical context remains valid.
 if p_edt_phase_id is not null then
   select ep.id phase_id,ep.edt_id,ep.phase_type,e.campagne_id into v_context
   from public.edt_phases ep join public.edt_supports es on es.phase_id=ep.id and es.edt_id=ep.edt_id join public.suivi_des_edt e on e.id=ep.edt_id
   where ep.id=p_edt_phase_id and es.support_id=p_support_id and e.archived_at is null;
   if not found then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 end if;
 if p_edt_phase_id is null then
 select null::bigint as edt_id, null::text as phase_type into v_context;
 end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 v_result:=public.finaliser_intervention_terrain_v01273(p_support_id,p_action,p_type_enjeu,p_commentaires,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_idempotency_key);
 if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result;end if;
 if lower(trim(p_action))='enjeu' and p_edt_phase_id is not null then
   v_issue_id:=nullif(v_result->>'enjeu_id','')::bigint;
   if not exists(select 1 from public.enjeux_terrain where id=v_issue_id and support_id=p_support_id and edt_phase_id=p_edt_phase_id) then
     update public.enjeux_terrain set edt_phase_id=p_edt_phase_id where id=v_issue_id and support_id=p_support_id and edt_phase_id is null;
     if not found then raise exception 'issue_context_not_persisted';end if;
   end if;
 end if;
 return v_result||jsonb_build_object('edt_phase_id',p_edt_phase_id,'edt_id',case when p_edt_phase_id is null then null else v_context.edt_id end,'phase_type',case when p_edt_phase_id is null then null else v_context.phase_type end);
END;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.save_campaign_visual_with_edts(p_visual jsonb, p_links jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v public.campagne_visuels_formats%rowtype; owner_id bigint;links jsonb:=p_links;
BEGIN
 IF auth.uid() IS NULL OR public.tos_current_role() NOT IN ('Administrateur','Coordonnateur') THEN
  RAISE EXCEPTION 'visual_write_denied' USING ERRCODE='42501';END IF;
 IF p_links IS NOT NULL AND public.tos_current_role()<>'Administrateur' THEN
  RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
 SELECT client_id INTO owner_id FROM public.campagnes_maitres WHERE id=(p_visual->>'campagne_id')::bigint;
 IF owner_id IS NULL THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;
 IF nullif(p_visual->>'id','') IS NULL THEN
  INSERT INTO public.campagne_visuels_formats(campagne_id,client_id,nom_visuel,format_support)
  VALUES((p_visual->>'campagne_id')::bigint,owner_id,p_visual->>'nom_visuel',p_visual->>'format_support') RETURNING * INTO v;
 ELSE
  SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=(p_visual->>'id')::bigint FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
  IF (v.campagne_id IS DISTINCT FROM (p_visual->>'campagne_id')::bigint OR v.client_id IS DISTINCT FROM owner_id) THEN
   IF public.tos_current_role()<>'Administrateur' THEN RAISE EXCEPTION 'admin_visual_edt_assignment_required' USING ERRCODE='42501';END IF;
   IF links IS NULL THEN SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO links FROM public.visual_edt_associations a WHERE visual_id=v.id;END IF;
   -- The whole RPC is atomic: failed reattachment restores the prior links and visual.
   PERFORM public.save_visual_edt_associations(v.id,'[]');
  END IF;
 END IF;
 UPDATE public.campagne_visuels_formats SET campagne_id=(p_visual->>'campagne_id')::bigint,client_id=owner_id,
 nom_visuel=p_visual->>'nom_visuel',format_support=p_visual->>'format_support',phase=p_visual->>'phase',code_visuel=p_visual->>'code_visuel',
 quantite_prevue=coalesce((p_visual->>'quantite_prevue')::integer,0),actif=coalesce((p_visual->>'actif')::boolean,true),
 is_out_of_frame=coalesce((p_visual->>'is_out_of_frame')::boolean,false),instructions_terrain=p_visual->>'instructions_terrain',updated_at=now()
 WHERE id=v.id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;
 IF links IS NOT NULL THEN PERFORM public.save_visual_edt_associations(v.id,links);END IF;
 SELECT * INTO v FROM public.campagne_visuels_formats WHERE id=v.id;
 RETURN to_jsonb(v);
END $function$
;