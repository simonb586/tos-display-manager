CREATE OR REPLACE FUNCTION public.creer_requete_client_multi_supports_v133(p_type text, p_priorite text, p_description text, p_support_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.utilisateurs%rowtype;r public.requetes_clients%rowtype;v_ids text[];v_allowed text[];v_role text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (p_support_ids IS NOT NULL AND cardinality(p_support_ids)>0 AND NOT EXISTS(SELECT 1 FROM unnest(p_support_ids) sec_support WHERE public.tos_table_resource_scope(NULL,nullif(btrim(sec_support),''),NULL,NULL,false) IS NOT TRUE)) IS NOT TRUE THEN RAISE EXCEPTION 'supports_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select * into u from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif';if not found then raise exception 'identity_denied' using errcode='42501';end if;v_role:=u.role;
 select coalesce(array_agg(distinct trim(x)),'{}') into v_ids from unnest(coalesce(p_support_ids,'{}')) x where trim(x)<>'';
 if cardinality(v_ids)=0 then raise exception 'supports_required';end if;
 if v_role in ('Client','Client-Admin') then
   if u.client_id is null then raise exception 'client_scope_denied' using errcode='42501';end if;
   select coalesce(array_agg(i.support_id),'{}') into v_allowed from public.infrastructures i where i.support_id=any(v_ids) and i.client_id=u.client_id;
 elsif v_role in ('Administrateur','Coordonnateur') then select coalesce(array_agg(i.support_id),'{}') into v_allowed from public.infrastructures i where i.support_id=any(v_ids);
 else raise exception 'permission_denied' using errcode='42501';end if;
 if cardinality(v_allowed)<>cardinality(v_ids) then raise exception 'cross_client_support_denied' using errcode='42501';end if;
 insert into public.requetes_clients(client_id,client,demandeur_nom,demandeur_courriel,type_requete,priorite,description,statut)
 values(u.client_id,u.client_id::text,u.nom,u.courriel,coalesce(p_type,'Installation'),coalesce(p_priorite,'Normale'),nullif(trim(p_description),''),'Nouvelle') returning * into r;
 insert into public.client_request_supports(request_id,support_id) select r.id,unnest(v_allowed);
 return jsonb_build_object('request_id',r.id,'support_count',cardinality(v_allowed));
END;
END;
$function$
;
NOTIFY pgrst,'reload schema';
