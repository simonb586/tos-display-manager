-- Additive extension: canonical roles, least privilege and resource ownership.
REVOKE EXECUTE ON FUNCTION public.diagnostic_rapports_v09() FROM PUBLIC,anon;

-- diagnostic_rapports_v09: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_rapports_v09()
 RETURNS TABLE(communications_total bigint, communications_envoyees bigint, communications_echec bigint, edt_avec_rapport bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."communications_total"::bigint,sec_result."communications_envoyees"::bigint,sec_result."communications_echec"::bigint,sec_result."edt_avec_rapport"::bigint FROM (select
    (select count(*) from public.communications_finales),
    (select count(*) from public.communications_finales where statut = 'Envoyé'),
    (select count(*) from public.communications_finales where statut = 'Échec'),
    (select count(*) from public.suivi_des_edt where rapport_final_envoye = true)) AS sec_result("communications_total","communications_envoyees","communications_echec","edt_avec_rapport");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.delete_or_archive_campaign_visual(bigint) FROM PUBLIC,anon;

-- delete_or_archive_campaign_visual: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.delete_or_archive_campaign_visual(p_visual_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  used_count bigint := 0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visual_id AND public.tos_table_resource_scope(sec_visual.client_id,NULL,sec_visual.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then
    raise exception 'Accès refusé.';
  end if;

  if to_regclass('public.support_photos') is not null then
    execute
      'select count(*) from public.support_photos where visuel_id = $1'
    into used_count
    using p_visual_id;
  end if;

  if used_count > 0 then
    update public.campagne_visuels_formats
    set
      actif = false,
      updated_at = now()
    where id = p_visual_id;

    return jsonb_build_object(
      'action', 'archived',
      'used_count', used_count
    );
  end if;

  delete from public.campagne_visuels_formats
  where id = p_visual_id;

  return jsonb_build_object(
    'action', 'deleted',
    'used_count', 0
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.diagnostic_correctifs_v0111() FROM PUBLIC,anon;

-- diagnostic_correctifs_v0111: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_correctifs_v0111()
 RETURNS TABLE(tables_publiques bigint, champs_publics bigint, champs_studio bigint, relations_studio bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."tables_publiques"::bigint,sec_result."champs_publics"::bigint,sec_result."champs_studio"::bigint,sec_result."relations_studio"::bigint FROM (select
    (
      select count(distinct table_name)
      from information_schema.columns
      where table_schema = 'public'
    ),
    (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
    ),
    (select count(*) from public.relation_fields),
    (select count(*) from public.relation_rules)) AS sec_result("tables_publiques","champs_publics","champs_studio","relations_studio");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$ SELECT public.tos_current_role(); $function$;
REVOKE EXECUTE ON FUNCTION public.tdm_operations_audit() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_edt_progress(bigint) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.sync_edt_progress_from_work_order() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnostic_bloc11() FROM PUBLIC,anon;

-- diagnostic_bloc11: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_bloc11()
 RETURNS TABLE(edt_total bigint, edt_actifs bigint, bt_ouverts bigint, requetes_nouvelles bigint, assignations_actives bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."edt_total"::bigint,sec_result."edt_actifs"::bigint,sec_result."bt_ouverts"::bigint,sec_result."requetes_nouvelles"::bigint,sec_result."assignations_actives"::bigint FROM (select
    (select count(*) from public.suivi_des_edt),
    (select count(*) from public.suivi_des_edt where statut not in ('Terminé','Annulé')),
    (select count(*) from public.bons_de_travail where statut not in ('Terminée','Annulée')),
    (select count(*) from public.requetes_clients where statut = 'Nouvelle'),
    (select count(*) from public.edt_assignments where statut <> 'Retiré')) AS sec_result("edt_total","edt_actifs","bt_ouverts","requetes_nouvelles","assignations_actives");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.diagnostic_systeme_v07() FROM PUBLIC,anon;

-- diagnostic_systeme_v07: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_systeme_v07()
 RETURNS TABLE(check_key text, title text, status text, actual_value text, expected_value text, detail text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."check_key"::text,sec_result."title"::text,sec_result."status"::text,sec_result."actual_value"::text,sec_result."expected_value"::text,sec_result."detail"::text FROM (select'infrastructures','Infrastructures présentes',case when count(*)=6621 then'OK'else'Avertissement'end,count(*)::text,'6621',(6621-count(*))::text||' manquante(s)'from public.infrastructures union all select'arrets','Arrêts présents',case when count(*)>=4323 then'OK'else'Avertissement'end,count(*)::text,'4323','Total opérationnel'from public.liste_des_arrets union all select'visuels','Visuels configurés',case when count(*)>0 then'OK'else'Avertissement'end,count(*)::text,null,'Les visuels filtrent l’application terrain'from public.campagne_visuels_formats union all select'relations','Relations à confirmer',case when count(*)=0 then'OK'else'Avertissement'end,count(*)::text,'0','À confirmer dans le Studio'from public.relation_rules where validation_status<>'Validée' union all select'photos','Photos orphelines',case when count(*)=0 then'OK'else'Erreur'end,count(*)::text,'0','Support ID inexistant'from public.support_photos p where not exists(select 1 from public.infrastructures i where i.support_id=p.support_id)) AS sec_result("check_key","title","status","actual_value","expected_value","detail");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.link_auth_user_to_profile() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnostic_carte_v08() FROM PUBLIC,anon;

-- diagnostic_carte_v08: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_carte_v08()
 RETURNS TABLE(total_infrastructures bigint, infrastructures_geolocalisees bigint, infrastructures_sans_gps bigint, latitude_invalide bigint, longitude_invalide bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."total_infrastructures"::bigint,sec_result."infrastructures_geolocalisees"::bigint,sec_result."infrastructures_sans_gps"::bigint,sec_result."latitude_invalide"::bigint,sec_result."longitude_invalide"::bigint FROM (with source as (
    select
      trim(coalesce(to_jsonb(i)->>'latitude', '')) as latitude_texte,
      trim(coalesce(to_jsonb(i)->>'longitude', '')) as longitude_texte
    from public.infrastructures i
  ),
  cleaned as (
    select
      latitude_texte,
      longitude_texte,
      case
        when replace(latitude_texte, ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
        then replace(latitude_texte, ',', '.')::double precision
        else null
      end as lat,
      case
        when replace(longitude_texte, ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
        then replace(longitude_texte, ',', '.')::double precision
        else null
      end as lon
    from source
  )
  select
    count(*)::bigint,
    count(*) filter (
      where lat between -90 and 90
        and lon between -180 and 180
    )::bigint,
    count(*) filter (
      where latitude_texte = ''
         or longitude_texte = ''
    )::bigint,
    count(*) filter (
      where latitude_texte <> ''
        and (lat is null or lat not between -90 and 90)
    )::bigint,
    count(*) filter (
      where longitude_texte <> ''
        and (lon is null or lon not between -180 and 180)
    )::bigint
  from cleaned) AS sec_result("total_infrastructures","infrastructures_geolocalisees","infrastructures_sans_gps","latitude_invalide","longitude_invalide");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.tdm_audit_row_changes() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_infrastructure_photo_thumbnail() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnostic_bloc10() FROM PUBLIC,anon;

-- diagnostic_bloc10: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_bloc10()
 RETURNS TABLE(modifications_journalisees bigint, photos_a_valider bigint, photos_principales bigint, mouvements_inventaire bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."modifications_journalisees"::bigint,sec_result."photos_a_valider"::bigint,sec_result."photos_principales"::bigint,sec_result."mouvements_inventaire"::bigint FROM (select
    (select count(*) from public.admin_change_log),
    (select count(*) from public.support_photos where statut_validation = 'À valider'),
    (select count(*) from public.support_photos where est_principale = true),
    (select count(*) from public.inventory_movements)) AS sec_result("modifications_journalisees","photos_a_valider","photos_principales","mouvements_inventaire");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.list_public_schema_fields() FROM PUBLIC,anon;

-- list_public_schema_fields: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.list_public_schema_fields()
 RETURNS TABLE(table_name text, column_name text, data_type text, ordinal_position integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."table_name"::text,sec_result."column_name"::text,sec_result."data_type"::text,sec_result."ordinal_position"::integer FROM (select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.ordinal_position
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name not in (
      'schema_migrations',
      'spatial_ref_sys'
    )
  order by c.table_name, c.ordinal_position) AS sec_result("table_name","column_name","data_type","ordinal_position");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.diagnostic_bloc12() FROM PUBLIC,anon;

-- diagnostic_bloc12: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_bloc12()
 RETURNS TABLE(utilisateurs_total bigint, invitations_en_attente bigint, utilisateurs_actifs bigint, utilisateurs_desactives bigint, relations_grille bigint, visuels_actifs bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."utilisateurs_total"::bigint,sec_result."invitations_en_attente"::bigint,sec_result."utilisateurs_actifs"::bigint,sec_result."utilisateurs_desactives"::bigint,sec_result."relations_grille"::bigint,sec_result."visuels_actifs"::bigint FROM (select
    (select count(*) from public.utilisateurs),
    (
      select count(*)
      from public.utilisateurs
      where invitation_statut = 'Invitation envoyée'
    ),
    (
      select count(*)
      from public.utilisateurs
      where statut = 'Actif'
    ),
    (
      select count(*)
      from public.utilisateurs
      where statut = 'Désactivé'
    ),
    (
      select count(*)
      from public.relation_rules
      where condition_json ->> 'grid_shortcut' = 'true'
    ),
    (
      select count(*)
      from public.campagne_visuels_formats
      where actif = true
    )) AS sec_result("utilisateurs_total","invitations_en_attente","utilisateurs_actifs","utilisateurs_desactives","relations_grille","visuels_actifs");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.mark_current_user_active() FROM PUBLIC,anon;

-- mark_current_user_active: Administrateur/Coordonnateur/Installateur/Client/Client-Admin
CREATE OR REPLACE FUNCTION public.mark_current_user_active()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;

BEGIN

  update public.utilisateurs
  set statut='Actif', invitation_statut='Compte activé', premiere_connexion_le=coalesce(premiere_connexion_le,now()), compte_active_le=coalesce(compte_active_le,now()), derniere_activite_le=now(), updated_at=now()
  where auth_user_id=auth.uid();
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.diagnostic_activation_v0123() FROM PUBLIC,anon;

-- diagnostic_activation_v0123: Administrateur/Coordonnateur/Installateur (global internal scope)
CREATE OR REPLACE FUNCTION public.diagnostic_activation_v0123()
 RETURNS TABLE(invitations_en_attente bigint, comptes_actives bigint, utilisateurs_jamais_connectes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."invitations_en_attente"::bigint,sec_result."comptes_actives"::bigint,sec_result."utilisateurs_jamais_connectes"::bigint FROM (select
 (select count(*) from public.utilisateurs where invitation_statut='Invitation envoyée'),
 (select count(*) from public.utilisateurs where invitation_statut='Compte activé' or premiere_connexion_le is not null),
 (select count(*) from public.utilisateurs where premiere_connexion_le is null)) AS sec_result("invitations_en_attente","comptes_actives","utilisateurs_jamais_connectes");
END;
$function$;
ALTER FUNCTION public.tdm_try_date(text) SET search_path='';
REVOKE EXECUTE ON FUNCTION public.assigner_supports_edt_v0129(bigint,text[],bigint,text,text,date,boolean) FROM PUBLIC,anon;

-- assigner_supports_edt_v0129: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.assigner_supports_edt_v0129(p_edt_id bigint, p_support_ids text[], p_phase_id bigint DEFAULT NULL::bigint, p_priorite text DEFAULT 'Normale'::text, p_assigne_a text DEFAULT NULL::text, p_date_cible date DEFAULT NULL::date, p_generer_bt boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_edt public.suivi_des_edt%rowtype;
  v_support_id text;
  v_es public.edt_supports%rowtype;
  v_bt_id bigint;
  v_added integer := 0;
  v_skipped integer := 0;
  v_missing text[] := array[]::text[];
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF p_phase_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
END IF;
IF (p_support_ids IS NOT NULL AND cardinality(p_support_ids)>0 AND NOT EXISTS(SELECT 1 FROM unnest(p_support_ids) sec_support WHERE public.tos_table_resource_scope(NULL,nullif(btrim(sec_support),''),NULL,p_edt_id,false) IS NOT TRUE)) IS NOT TRUE THEN RAISE EXCEPTION 'supports_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then
    raise exception 'Permission insuffisante.';
  end if;

  select * into v_edt from public.suivi_des_edt where id = p_edt_id for update;
  if not found then raise exception 'EDT introuvable.'; end if;

  if p_phase_id is not null and not exists (
    select 1 from public.edt_phases where id = p_phase_id and edt_id = p_edt_id
  ) then
    raise exception 'La phase ne correspond pas à cet EDT.';
  end if;

  foreach v_support_id in array coalesce(p_support_ids, array[]::text[]) loop
    v_support_id := trim(v_support_id);
    if v_support_id = '' then continue; end if;

    if not exists (select 1 from public.infrastructures where support_id = v_support_id) then
      v_missing := array_append(v_missing, v_support_id);
      continue;
    end if;

    insert into public.edt_supports(
      edt_id, phase_id, support_id, statut, priorite, assigne_a, date_cible, updated_at
    ) values (
      p_edt_id, p_phase_id, v_support_id, 'Planifié', coalesce(p_priorite,'Normale'), p_assigne_a, p_date_cible, now()
    )
    on conflict (edt_id, support_id) do update
      set phase_id = coalesce(excluded.phase_id, edt_supports.phase_id),
          priorite = excluded.priorite,
          assigne_a = coalesce(excluded.assigne_a, edt_supports.assigne_a),
          date_cible = coalesce(excluded.date_cible, edt_supports.date_cible),
          updated_at = now()
    returning * into v_es;

    if p_generer_bt and v_es.bon_de_travail_id is null then
      insert into public.bons_de_travail(
        no_bt, type_bt, support_id, no_edt, edt_id, phase_id, edt_support_id,
        priorite, statut, assigne_a, date_cible, client, description, progression, updated_at
      ) values (
        'BT-' || regexp_replace(coalesce(v_edt.no_edt, p_edt_id::text), '[^A-Za-z0-9]', '', 'g') || '-' || v_support_id,
        'Installation', v_support_id, v_edt.no_edt, p_edt_id, p_phase_id, v_es.id,
        coalesce(p_priorite,'Normale'), 'À faire', p_assigne_a, p_date_cible, v_edt.client,
        'Travaux EDT ' || coalesce(v_edt.no_edt, p_edt_id::text) || ' — support ' || v_support_id,
        0, now()
      )
      on conflict (edt_support_id) where edt_support_id is not null do update
        set phase_id = excluded.phase_id,
            priorite = excluded.priorite,
            assigne_a = coalesce(excluded.assigne_a, bons_de_travail.assigne_a),
            date_cible = coalesce(excluded.date_cible, bons_de_travail.date_cible),
            updated_at = now()
      returning id into v_bt_id;

      update public.edt_supports set bon_de_travail_id = v_bt_id, updated_at = now() where id = v_es.id;
    end if;

    update public.infrastructures
       set prochain_edt_cible = v_edt.no_edt,
           updated_at = now()
     where support_id = v_support_id;

    v_added := v_added + 1;
  end loop;

  perform public.refresh_edt_enterprise(p_edt_id);

  return jsonb_build_object(
    'ok', true,
    'edt_id', p_edt_id,
    'supports_affectes', v_added,
    'supports_ignores', v_skipped,
    'supports_introuvables', to_jsonb(v_missing)
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.sync_edt_support_from_bt_v0129() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tableau_bord_edt_v0129(bigint) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.tdm_relation_column_exists(text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tdm_default_relation_key(text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.executer_relation_rule_v0129(bigint,jsonb,boolean,uuid) FROM PUBLIC,anon;

-- executer_relation_rule_v0129: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.executer_relation_rule_v0129(p_rule_id bigint, p_source_record jsonb, p_dry_run boolean DEFAULT false, p_operation_id uuid DEFAULT gen_random_uuid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 r public.relation_rules%rowtype;
 sec_source_owner bigint;sec_destination_conflict boolean;
 v_source_key text;
 v_destination_key text;
 v_key_value text;
 v_source_value jsonb;
 v_old_value jsonb;
 v_count integer:=0;
 v_sql text;
 v_where jsonb;
BEGIN
IF pg_trigger_depth()>0 THEN IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
 ELSE IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
 END IF;

BEGIN

 select * into r from public.relation_rules where id=p_rule_id;
 if not found then raise exception 'Relation introuvable.'; end if;
 if not r.enabled then return jsonb_build_object('ok',false,'skipped',true,'message','Relation désactivée'); end if;
 if r.requires_confirmation and not p_dry_run then
   return jsonb_build_object('ok',false,'skipped',true,'message','Confirmation requise');
 end if;
 if not public.tdm_relation_column_exists(r.source_table,r.source_field) then raise exception 'Champ source inexistant: %.%',r.source_table,r.source_field; end if;
 if not public.tdm_relation_column_exists(r.destination_table,r.destination_field) then raise exception 'Champ destination inexistant: %.%',r.destination_table,r.destination_field; end if;

 v_source_key:=coalesce(nullif(r.condition_json->>'source_key',''),public.tdm_default_relation_key(r.source_table));
 v_destination_key:=coalesce(nullif(r.condition_json->>'destination_key',''),public.tdm_default_relation_key(r.destination_table));
 if v_source_key is null or v_destination_key is null then raise exception 'Clé de correspondance absente. Configure source_key et destination_key.'; end if;
 if not public.tdm_relation_column_exists(r.source_table,v_source_key) then raise exception 'Clé source inexistante: %.%',r.source_table,v_source_key; end if;
 if not public.tdm_relation_column_exists(r.destination_table,v_destination_key) then raise exception 'Clé destination inexistante: %.%',r.destination_table,v_destination_key; end if;

 v_key_value:=p_source_record->>v_source_key;
 v_source_value:=p_source_record->r.source_field;
 if v_key_value is null then raise exception 'Valeur de clé source absente (%).',v_source_key; end if;

 sec_source_owner:=nullif(p_source_record->>'client_id','')::bigint;
IF sec_source_owner IS NULL AND r.source_table='clients' THEN sec_source_owner:=nullif(p_source_record->>'id','')::bigint;END IF;
IF sec_source_owner IS NULL THEN SELECT i.client_id INTO sec_source_owner FROM public.infrastructures i WHERE i.support_id=coalesce(p_source_record->>'support_id',p_source_record->>'related_support');END IF;
IF (public.tos_table_resource_scope(sec_source_owner,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'relation_source_scope_denied' USING ERRCODE='42501';END IF;

EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%1$I sec_destination LEFT JOIN public.infrastructures sec_owner_support ON sec_owner_support.support_id=coalesce(to_jsonb(sec_destination)->>''support_id'',to_jsonb(sec_destination)->>''related_support'') WHERE sec_destination.%2$I::text=$1 AND (public.tos_table_resource_scope(coalesce(nullif(to_jsonb(sec_destination)->>''client_id'','''')::bigint,sec_owner_support.client_id),NULL,NULL,NULL,true) IS NOT TRUE OR ($2 IS NOT NULL AND coalesce(nullif(to_jsonb(sec_destination)->>''client_id'','''')::bigint,sec_owner_support.client_id) IS NOT NULL AND $2<>coalesce(nullif(to_jsonb(sec_destination)->>''client_id'','''')::bigint,sec_owner_support.client_id))))',r.destination_table,v_destination_key) INTO sec_destination_conflict USING v_key_value,sec_source_owner;
IF sec_destination_conflict THEN RAISE EXCEPTION 'relation_destination_scope_denied' USING ERRCODE='42501';END IF;
execute format('select to_jsonb(%1$I) from public.%2$I where %3$I::text=$1 limit 1',r.destination_field,r.destination_table,v_destination_key)
 into v_old_value using v_key_value;

 if p_dry_run then
   insert into public.relation_execution_logs(operation_id,rule_id,source_table,source_field,destination_table,destination_field,source_key_value,status,message,old_value,new_value,context)
   values(p_operation_id,r.id,r.source_table,r.source_field,r.destination_table,r.destination_field,v_key_value,'Simulation','Aucune donnée modifiée',v_old_value,v_source_value,jsonb_build_object('source_key',v_source_key,'destination_key',v_destination_key));
   return jsonb_build_object('ok',true,'dry_run',true,'matches',case when v_old_value is null then 0 else 1 end,'old_value',v_old_value,'new_value',v_source_value);
 end if;

 -- jsonb_populate_record assure la conversion vers le type réel de la colonne destination.
 v_sql:=format('update public.%1$I d set %2$I = (jsonb_populate_record(null::public.%1$I, jsonb_build_object(%3$L,$1))).%2$I where d.%4$I::text=$2',r.destination_table,r.destination_field,r.destination_field,v_destination_key);
 execute v_sql using v_source_value,v_key_value;
 get diagnostics v_count=row_count;

 update public.relation_rules set last_executed_at=now(),execution_count=execution_count+1,last_error=null,updated_at=now() where id=r.id;
 insert into public.relation_execution_logs(operation_id,rule_id,source_table,source_field,destination_table,destination_field,source_key_value,status,message,old_value,new_value,context)
 values(p_operation_id,r.id,r.source_table,r.source_field,r.destination_table,r.destination_field,v_key_value,case when v_count>0 then 'Réussi' else 'Sans correspondance' end,v_count||' ligne(s) mise(s) à jour',v_old_value,v_source_value,jsonb_build_object('source_key',v_source_key,'destination_key',v_destination_key));
 return jsonb_build_object('ok',true,'updated',v_count,'operation_id',p_operation_id);
exception when others then
 update public.relation_rules set last_error=sqlerrm,updated_at=now() where id=p_rule_id;
 insert into public.relation_execution_logs(operation_id,rule_id,status,message,context) values(p_operation_id,p_rule_id,'Erreur',sqlerrm,jsonb_build_object('source_record',p_source_record));
 raise;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.tdm_relation_source_trigger_v0129() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.installer_declencheurs_relations_v0129() FROM PUBLIC,anon;

-- installer_declencheurs_relations_v0129: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.installer_declencheurs_relations_v0129()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t text; n integer:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role()<>'Administrateur' then raise exception 'Permission administrateur requise.'; end if;
 for t in select distinct source_table from public.relation_rules where enabled=true and source_table not in ('relation_rules','relation_fields','relation_execution_logs','relation_test_logs') loop
   if to_regclass('public.'||quote_ident(t)) is not null then
     execute format('drop trigger if exists tdm_relation_auto_v0129 on public.%I',t);
     execute format('create trigger tdm_relation_auto_v0129 after insert or update on public.%I for each row execute function public.tdm_relation_source_trigger_v0129()',t);
     n:=n+1;
   end if;
 end loop;
 return jsonb_build_object('ok',true,'tables_equipees',n);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.test_relation_rule(bigint) FROM PUBLIC,anon;

-- test_relation_rule: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.test_relation_rule(p_rule_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.relation_rules%rowtype; sk text; dk text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 select * into r from public.relation_rules where id=p_rule_id;
 if not found then raise exception 'Relation introuvable.'; end if;
 sk:=coalesce(nullif(r.condition_json->>'source_key',''),public.tdm_default_relation_key(r.source_table));
 dk:=coalesce(nullif(r.condition_json->>'destination_key',''),public.tdm_default_relation_key(r.destination_table));
 if not public.tdm_relation_column_exists(r.source_table,r.source_field) then raise exception 'Champ source inexistant'; end if;
 if not public.tdm_relation_column_exists(r.destination_table,r.destination_field) then raise exception 'Champ destination inexistant'; end if;
 if sk is null or dk is null then raise exception 'Clés de correspondance non configurées'; end if;
 insert into public.relation_test_logs(rule_id,status,message,details) values(r.id,'Réussi','Relation exécutable.',jsonb_build_object('source_key',sk,'destination_key',dk));
 return jsonb_build_object('status','Réussi','message','Relation valide et exécutable.','source_key',sk,'destination_key',dk);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.tos_current_role() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.sync_bt_from_edt_support_v0129() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.normaliser_edt_support_v013() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_edt_enterprise(bigint) FROM PUBLIC,anon;

-- refresh_edt_enterprise: Administrateur/Coordonnateur/Installateur
CREATE OR REPLACE FUNCTION public.refresh_edt_enterprise(p_edt_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total integer := 0;
  v_planifies integer := 0;
  v_en_cours integer := 0;
  v_bloques integer := 0;
  v_termines integer := 0;
  v_progression integer := 0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.edt_supports sec_assignment WHERE (p_edt_id IS NULL OR sec_assignment.edt_id=p_edt_id) AND public.tos_table_resource_scope(NULL,sec_assignment.support_id,NULL,sec_assignment.edt_id,false) IS NOT TRUE)) IS NOT TRUE THEN RAISE EXCEPTION 'edt_assignment_owner_inconsistent' USING ERRCODE='42501';END IF;

BEGIN

  if not exists (select 1 from public.suivi_des_edt where id = p_edt_id) then
    raise exception 'EDT % introuvable.', p_edt_id;
  end if;

  select count(*)::integer,
         count(*) filter (where statut = 'Planifié')::integer,
         count(*) filter (where statut = 'En cours')::integer,
         count(*) filter (where statut = 'Bloqué' or bloque)::integer,
         count(*) filter (where statut = 'Terminé')::integer,
         coalesce(round(avg(case when statut = 'Terminé' then 100 else progression end)),0)::integer
    into v_total, v_planifies, v_en_cours, v_bloques, v_termines, v_progression
    from public.edt_supports
   where edt_id = p_edt_id and statut <> 'Annulé';

  update public.edt_phases p
     set progression = x.progression,
         statut = x.statut,
         updated_at = now()
    from (
      select phase.id,
             coalesce(round(avg(case when es.statut = 'Terminé' then 100 else es.progression end)),0)::integer progression,
             case
               when count(es.id) = 0 then phase.statut
               when count(es.id) filter (where es.statut <> 'Terminé') = 0 then 'Terminée'
               when count(es.id) filter (where es.statut = 'Bloqué') > 0 then 'Bloquée'
               when max(es.progression) > 0 then 'En cours'
               else 'À faire'
             end statut
        from public.edt_phases phase
        left join public.edt_supports es
          on es.phase_id = phase.id and es.statut <> 'Annulé'
       where phase.edt_id = p_edt_id
       group by phase.id
    ) x
   where p.id = x.id
     and (p.progression, p.statut) is distinct from (x.progression, x.statut);

  update public.suivi_des_edt e
     set supports_prevus = v_total,
         supports_cibles = v_total,
         supports_planifies = v_planifies,
         supports_en_cours = v_en_cours,
         supports_bloques = v_bloques,
         supports_termines = v_termines,
         supports_installes = v_termines,
         supports_completes = v_termines,
         progression = v_progression,
         avancement = v_progression,
         statut = case
           when v_total > 0 and v_termines = v_total then 'Terminé'
           when v_bloques > 0 then 'Bloqué'
           when v_en_cours > 0 or v_termines > 0 then 'En cours'
           when v_total > 0 then 'Planifié'
           else e.statut
         end,
         date_fin = case
           when v_total > 0 and v_termines = v_total then coalesce(e.date_fin, current_date)
           else null
         end,
         derniere_synchro = now(),
         updated_at = now()
   where e.id = p_edt_id;

  return jsonb_build_object(
    'ok', true, 'source_de_verite', 'edt_supports', 'edt_id', p_edt_id,
    'supports_total', v_total, 'planifies', v_planifies,
    'en_cours', v_en_cours, 'bloques', v_bloques,
    'termines', v_termines, 'progression', v_progression
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.diagnostiquer_integrite_edt_v013(bigint) FROM PUBLIC,anon;

-- diagnostiquer_integrite_edt_v013: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.diagnostiquer_integrite_edt_v013(p_edt_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(code text, severite text, edt_id bigint, edt_support_id bigint, bon_de_travail_id bigint, support_id text, details jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_id IS NULL THEN IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_edt_scope_required' USING ERRCODE='42501';END IF;
 ELSE IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
 END IF;
RETURN QUERY SELECT sec_result."code"::text,sec_result."severite"::text,sec_result."edt_id"::bigint,sec_result."edt_support_id"::bigint,sec_result."bon_de_travail_id"::bigint,sec_result."support_id"::text,sec_result."details"::jsonb FROM (select 'BT_MANQUANT', 'avertissement', es.edt_id, es.id, null::bigint, es.support_id,
         jsonb_build_object('action_proposee','creer_bt')
    from public.edt_supports es
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and es.bon_de_travail_id is null and es.statut <> 'Annulé'
  union all
  select 'LIEN_BT_ASYMETRIQUE', 'critique', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('bt_edt_support_id',bt.edt_support_id,'action_proposee','retablir_lien')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and bt.edt_support_id is distinct from es.id
  union all
  select 'IDENTITE_BT_INCOHERENTE', 'critique', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('bt_edt_id',bt.edt_id,'bt_support_id',bt.support_id,'action_proposee','aligner_bt')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.edt_id is distinct from es.edt_id or bt.support_id is distinct from es.support_id)
  union all
  select 'ETAT_BT_DIVERGENT', 'avertissement', es.edt_id, es.id, bt.id, es.support_id,
         jsonb_build_object('edt_statut',es.statut,'bt_statut',bt.statut,
           'edt_progression',es.progression,'bt_progression',bt.progression,
           'action_proposee','synchroniser_depuis_edt_supports')
    from public.edt_supports es
    join public.bons_de_travail bt on bt.id = es.bon_de_travail_id
   where (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.progression is distinct from es.progression or
          bt.statut is distinct from case es.statut
            when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
            when 'Annulé' then 'Annulée' else 'À faire' end)
  union all
  select 'PHASE_HORS_EDT', 'critique', es.edt_id, es.id, es.bon_de_travail_id, es.support_id,
         jsonb_build_object('phase_id',es.phase_id,'action_proposee','retirer_phase')
    from public.edt_supports es
    join public.edt_phases p on p.id = es.phase_id
   where (p_edt_id is null or es.edt_id = p_edt_id) and p.edt_id <> es.edt_id
  order by 2, 1, 3, 4) AS sec_result("code","severite","edt_id","edt_support_id","bon_de_travail_id","support_id","details");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.reparer_integrite_edt_v013(bigint,boolean) FROM PUBLIC,anon;

-- reparer_integrite_edt_v013: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.reparer_integrite_edt_v013(p_edt_id bigint DEFAULT NULL::bigint, p_apply boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_issues integer;
  v_updated integer := 0;
  v_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF p_edt_id IS NULL THEN IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_edt_scope_required' USING ERRCODE='42501';END IF;
 ELSE IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
 END IF;
IF (NOT EXISTS(SELECT 1 FROM public.edt_supports sec_assignment WHERE (p_edt_id IS NULL OR sec_assignment.edt_id=p_edt_id) AND public.tos_table_resource_scope(NULL,sec_assignment.support_id,NULL,sec_assignment.edt_id,false) IS NOT TRUE)) IS NOT TRUE THEN RAISE EXCEPTION 'edt_assignment_owner_inconsistent' USING ERRCODE='42501';END IF;

BEGIN

  select count(*) into v_issues
    from public.diagnostiquer_integrite_edt_v013(p_edt_id);

  if not p_apply then
    return jsonb_build_object(
      'ok', true, 'dry_run', true, 'source_de_verite', 'edt_supports',
      'edt_id', p_edt_id, 'actions_proposees', v_issues
    );
  end if;

  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Validation Administrateur obligatoire pour appliquer une réparation.';
  end if;

  update public.bons_de_travail bt
     set edt_support_id = es.id, edt_id = es.edt_id, support_id = es.support_id,
         phase_id = es.phase_id, assigne_a = es.assigne_a, priorite = es.priorite,
         date_cible = es.date_cible::text, progression = es.progression,
         statut = case es.statut
           when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
           when 'Annulé' then 'Annulée' else 'À faire' end,
         updated_at = now()
    from public.edt_supports es
   where bt.id = es.bon_de_travail_id
     and (p_edt_id is null or es.edt_id = p_edt_id)
     and (bt.edt_support_id,bt.edt_id,bt.support_id,bt.phase_id,bt.assigne_a,
          bt.priorite,bt.date_cible,bt.progression,bt.statut)
         is distinct from
         (es.id,es.edt_id,es.support_id,es.phase_id,es.assigne_a,
          es.priorite,es.date_cible::text,es.progression,
          case es.statut when 'Terminé' then 'Terminée' when 'En cours' then 'En cours'
            when 'Annulé' then 'Annulée' else 'À faire' end);
  get diagnostics v_updated = row_count;

  for v_id in select distinct es.edt_id from public.edt_supports es
    where p_edt_id is null or es.edt_id = p_edt_id
  loop
    perform public.refresh_edt_enterprise(v_id);
  end loop;

  return jsonb_build_object(
    'ok', true, 'dry_run', false, 'source_de_verite', 'edt_supports',
    'edt_id', p_edt_id, 'issues_avant', v_issues, 'lignes_reparees', v_updated
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.diagnostic_visuels_support_v01210(text) FROM PUBLIC,anon;

-- diagnostic_visuels_support_v01210: Administrateur/Coordonnateur/Installateur
CREATE OR REPLACE FUNCTION public.diagnostic_visuels_support_v01210(p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_format text;
  v_format_key text;
  v_total_active integer := 0;
  v_matching integer := 0;
  v_published integer := 0;
  v_eligible integer := 0;
  v_formats jsonb := '[]'::jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

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
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.supprimer_photo_support_v0129_lot3(text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.list_public_schema_fields_v0131a() FROM PUBLIC,anon;

-- list_public_schema_fields_v0131a: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.list_public_schema_fields_v0131a()
 RETURNS TABLE(table_name text, column_name text, data_type text, udt_name text, ordinal_position integer, is_nullable boolean, column_default text, character_maximum_length integer, numeric_precision integer, numeric_scale integer, is_primary_key boolean, is_unique boolean, is_foreign_key boolean, foreign_table_name text, foreign_column_name text, is_generated boolean, generation_expression text, is_identity boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN QUERY SELECT sec_result."table_name"::text,sec_result."column_name"::text,sec_result."data_type"::text,sec_result."udt_name"::text,sec_result."ordinal_position"::integer,sec_result."is_nullable"::boolean,sec_result."column_default"::text,sec_result."character_maximum_length"::integer,sec_result."numeric_precision"::integer,sec_result."numeric_scale"::integer,sec_result."is_primary_key"::boolean,sec_result."is_unique"::boolean,sec_result."is_foreign_key"::boolean,sec_result."foreign_table_name"::text,sec_result."foreign_column_name"::text,sec_result."is_generated"::boolean,sec_result."generation_expression"::text,sec_result."is_identity"::boolean FROM (select
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.udt_name::text,
    c.ordinal_position,
    c.is_nullable = 'YES',
    c.column_default::text,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    exists (
      select 1
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
         and kcu.table_name = tc.table_name
       where tc.constraint_type = 'PRIMARY KEY'
         and tc.table_schema = c.table_schema
         and tc.table_name = c.table_name
         and kcu.column_name = c.column_name
    ),
    exists (
      select 1
        from pg_catalog.pg_index index_record
        join pg_catalog.pg_class table_record
          on table_record.oid = index_record.indrelid
        join pg_catalog.pg_namespace schema_record
          on schema_record.oid = table_record.relnamespace
        join pg_catalog.pg_attribute attribute_record
          on attribute_record.attrelid = table_record.oid
         and attribute_record.attnum = any(index_record.indkey)
       where index_record.indisunique
         and index_record.indnkeyatts = 1
         and schema_record.nspname = c.table_schema
         and table_record.relname = c.table_name
         and attribute_record.attname = c.column_name
    ),
    fk.foreign_table_name is not null,
    fk.foreign_table_name,
    fk.foreign_column_name,
    c.is_generated <> 'NEVER',
    nullif(c.generation_expression, '')::text,
    c.is_identity = 'YES'
  from information_schema.columns c
  left join lateral (
    select
      referenced_kcu.table_name::text as foreign_table_name,
      referenced_kcu.column_name::text as foreign_column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
     and kcu.table_name = tc.table_name
    join information_schema.referential_constraints rc
      on rc.constraint_schema = tc.constraint_schema
     and rc.constraint_name = tc.constraint_name
    join information_schema.key_column_usage referenced_kcu
      on referenced_kcu.constraint_schema = rc.unique_constraint_schema
     and referenced_kcu.constraint_name = rc.unique_constraint_name
     and referenced_kcu.ordinal_position = kcu.position_in_unique_constraint
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = c.table_schema
      and tc.table_name = c.table_name
      and kcu.column_name = c.column_name
    order by tc.constraint_name
    limit 1
  ) fk on true
  where c.table_schema = 'public'
    and c.table_name not in ('schema_migrations', 'spatial_ref_sys')
  order by c.table_name, c.ordinal_position) AS sec_result("table_name","column_name","data_type","udt_name","ordinal_position","is_nullable","column_default","character_maximum_length","numeric_precision","numeric_scale","is_primary_key","is_unique","is_foreign_key","foreign_table_name","foreign_column_name","is_generated","generation_expression","is_identity");
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.refresh_relation_field_physical_metadata_v0131a() FROM PUBLIC,anon;

-- refresh_relation_field_physical_metadata_v0131a: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.refresh_relation_field_physical_metadata_v0131a()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  metadata_record record;
  affected_count integer := 0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  for metadata_record in
    select * from public.list_public_schema_fields_v0131a()
  loop
    insert into public.relation_fields(
      module_name,
      table_name,
      field_name,
      field_label,
      is_primary_source,
      triggers_updates,
      visible_terrain,
      terrain_roles,
      terrain_readonly,
      validation_status,
      physical_data_type,
      physical_udt_name,
      physical_is_nullable,
      physical_column_default,
      physical_maximum_length,
      physical_numeric_precision,
      physical_numeric_scale,
      physical_ordinal_position,
      physical_is_primary_key,
      physical_is_unique,
      physical_is_foreign_key,
      physical_foreign_table,
      physical_foreign_column,
      physical_is_generated,
      physical_generation_expression,
      physical_is_identity,
      updated_at
    )
    values(
      initcap(replace(metadata_record.table_name, '_', ' ')),
      metadata_record.table_name,
      metadata_record.column_name,
      initcap(replace(metadata_record.column_name, '_', ' ')),
      true,
      false,
      false,
      '{}'::text[],
      true,
      'À confirmer',
      metadata_record.data_type,
      metadata_record.udt_name,
      metadata_record.is_nullable,
      metadata_record.column_default,
      metadata_record.character_maximum_length,
      metadata_record.numeric_precision,
      metadata_record.numeric_scale,
      metadata_record.ordinal_position,
      metadata_record.is_primary_key,
      metadata_record.is_unique,
      metadata_record.is_foreign_key,
      metadata_record.foreign_table_name,
      metadata_record.foreign_column_name,
      metadata_record.is_generated,
      metadata_record.generation_expression,
      metadata_record.is_identity,
      now()
    )
    on conflict(table_name, field_name) do update
      set physical_data_type = excluded.physical_data_type,
          physical_udt_name = excluded.physical_udt_name,
          physical_is_nullable = excluded.physical_is_nullable,
          physical_column_default = excluded.physical_column_default,
          physical_maximum_length = excluded.physical_maximum_length,
          physical_numeric_precision = excluded.physical_numeric_precision,
          physical_numeric_scale = excluded.physical_numeric_scale,
          physical_ordinal_position = excluded.physical_ordinal_position,
          physical_is_primary_key = excluded.physical_is_primary_key,
          physical_is_unique = excluded.physical_is_unique,
          physical_is_foreign_key = excluded.physical_is_foreign_key,
          physical_foreign_table = excluded.physical_foreign_table,
          physical_foreign_column = excluded.physical_foreign_column,
          physical_is_generated = excluded.physical_is_generated,
          physical_generation_expression = excluded.physical_generation_expression,
          physical_is_identity = excluded.physical_is_identity,
          updated_at = now();

    affected_count := affected_count + 1;
  end loop;

  return affected_count;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_permission_draft_v0131a6: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_permission_draft_v0131a6(p_table_name text, p_field_name text, p_contract_version text, p_permission_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.relation_fields%rowtype;v_old_config jsonb;v_new_config jsonb;v_changed text[]:=array[]::text[];v_key text;v_actor uuid:=auth.uid();v_role text;v_updated_at timestamptz;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 v_role:=public.current_app_role();if v_actor is null then raise exception using message='Authentification requise.',detail='{"code":"unauthorized"}';end if;if v_role<>'Administrateur' then raise exception using message='Permission administrateur requise.',detail='{"code":"administrator_required"}';end if;
 if p_contract_version is distinct from '1.0.0' then raise exception using message='Version non supportée.',detail='{"code":"unsupported_contract_version"}';end if;if p_expected_updated_at is null then raise exception using message='Horodatage obligatoire.',detail='{"code":"invalid_payload","field":"expectedUpdatedAt"}';end if;
 select * into v_old from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using message='Champ inconnu.',detail='{"code":"field_not_found"}';end if;if v_old.updated_at is distinct from p_expected_updated_at then raise exception using message='Brouillon obsolète.',detail='{"code":"stale_draft"}';end if;
 if coalesce(v_old.physical_is_primary_key,false)or coalesce(v_old.physical_is_foreign_key,false)or coalesce(v_old.physical_is_generated,false)or coalesce(v_old.physical_is_identity,false)or v_old.field_type='calculated'or lower(v_old.field_name)in('id','support_id','created_at','updated_at','deleted_at','auth_user_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre')or lower(v_old.field_name)like '%\_id' escape '\' then raise exception using message='Champ protégé.',detail='{"code":"field_protected"}';end if;
 v_new_config:=public.normalize_permission_config_v0131a6(p_permission_config);v_old_config:=public.normalize_permission_config_v0131a6(case when v_old.role_permissions='{}'::jsonb then '{}'::jsonb else v_old.role_permissions end);
 if v_old_config=v_new_config and v_old.configuration_status='draft' then return pg_catalog.jsonb_build_object('ok',true,'changed',false,'code','no_change','permissionConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at);end if;
 foreach v_key in array array['generalRule','roleRules','priorityStrategy','conservativeDeny'] loop if v_old_config->v_key is distinct from v_new_config->v_key then v_changed:=pg_catalog.array_append(v_changed,v_key);end if;end loop;
 update public.relation_fields set role_permissions=v_new_config,configuration_status='draft',updated_at=pg_catalog.now() where id=v_old.id returning updated_at into v_updated_at;
 insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(v_old.id,v_old.table_name,v_old.field_name,pg_catalog.jsonb_build_object('permissionConfig',v_old_config,'configuration_status',v_old.configuration_status),pg_catalog.jsonb_build_object('permissionConfig',v_new_config,'configuration_status','draft'),v_actor,pg_catalog.now(),'draft','1.0.0','permission','PermissionConfig','1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,v_role,'permission_draft_saved');
 return pg_catalog.jsonb_build_object('ok',true,'changed',true,'code','saved','permissionConfig',v_new_config,'contractVersion','1.0.0','updatedAt',v_updated_at,'changedProperties',pg_catalog.to_jsonb(v_changed));
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_terrain_draft_v0131a7(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_terrain_draft_v0131a7: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_terrain_draft_v0131a7(p_table_name text, p_field_name text, p_contract_version text, p_terrain_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.relation_fields%rowtype;v_old_config jsonb;v_new_config jsonb;v_changed text[]:=array[]::text[];v_key text;v_actor uuid:=auth.uid();v_role text;v_updated_at timestamptz;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN
 v_role:=public.current_app_role();if v_actor is null then raise exception using message='Authentification requise.',detail='{"code":"unauthorized"}';end if;if v_role<>'Administrateur'then raise exception using message='Permission administrateur requise.',detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'then raise exception using message='Version non supportée.',detail='{"code":"unsupported_contract_version"}';end if;if p_expected_updated_at is null then raise exception using message='Horodatage obligatoire.',detail='{"code":"invalid_payload","field":"expectedUpdatedAt"}';end if;
 select*into v_old from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using message='Champ inconnu.',detail='{"code":"field_not_found"}';end if;if v_old.updated_at is distinct from p_expected_updated_at then raise exception using message='Brouillon obsolète.',detail='{"code":"stale_draft"}';end if;
 v_new_config:=public.normalize_terrain_config_v0131a7(p_terrain_config);v_old_config:=public.normalize_terrain_config_v0131a7(case when v_old.terrain_config='{}'::jsonb then'{}'::jsonb else v_old.terrain_config end);
 if lower(v_old.field_name)in('support_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre')and v_new_config->'visibleOnTerrain'='false'::jsonb then raise exception using message='Champ critique non masquable.',detail='{"code":"critical_field_hidden"}';end if;
 if coalesce(v_old.physical_is_primary_key,false)or coalesce(v_old.physical_is_foreign_key,false)or coalesce(v_old.physical_is_generated,false)or coalesce(v_old.physical_is_identity,false)or v_old.field_type='calculated'or lower(v_old.field_name)in('id','created_at','updated_at','deleted_at','auth_user_id')or lower(v_old.field_name)like'%\_id'escape'\'then raise exception using message='Champ protégé.',detail='{"code":"field_protected"}';end if;
 if v_old_config=v_new_config and v_old.configuration_status='draft'then return pg_catalog.jsonb_build_object('ok',true,'changed',false,'code','no_change','terrainConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at);end if;
 foreach v_key in array array['visibleOnTerrain','readonlyOnTerrain','terrainRoles','terrainSection','terrainDisplayOrder','criticalFields']loop if v_old_config->v_key is distinct from v_new_config->v_key then v_changed:=pg_catalog.array_append(v_changed,v_key);end if;end loop;
 update public.relation_fields set terrain_config=v_new_config,configuration_status='draft',updated_at=pg_catalog.now()where id=v_old.id returning updated_at into v_updated_at;
 insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(v_old.id,v_old.table_name,v_old.field_name,pg_catalog.jsonb_build_object('terrainConfig',v_old_config,'configuration_status',v_old.configuration_status),pg_catalog.jsonb_build_object('terrainConfig',v_new_config,'configuration_status','draft'),v_actor,pg_catalog.now(),'draft','1.0.0','terrain','TerrainConfig','1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,v_role,'terrain_draft_saved');return pg_catalog.jsonb_build_object('ok',true,'changed',true,'code','saved','terrainConfig',v_new_config,'contractVersion','1.0.0','updatedAt',v_updated_at,'changedProperties',pg_catalog.to_jsonb(v_changed));END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_general_draft_v0131a3(text,text,text,text,text,integer) FROM PUBLIC,anon;

-- save_relation_field_general_draft_v0131a3: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_general_draft_v0131a3(p_table_name text, p_field_name text, p_field_label text, p_field_type text, p_help_text text, p_display_order integer)
 RETURNS public.relation_fields
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

  if auth.uid() is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if nullif(trim(p_table_name), '') is null or nullif(trim(p_field_name), '') is null then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.technical_name_locked, true) = false then
    raise exception 'Le nom technique doit demeurer verrouillé.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at', 'auth_user_id',
       'photo_principale_url', 'photo_miniature_url', 'visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if nullif(trim(p_field_label), '') is null or char_length(trim(p_field_label)) > 160 then
    raise exception 'Le libellé doit contenir entre 1 et 160 caractères.';
  end if;

  if p_field_type is null or p_field_type not in (
    'short_text', 'long_text', 'number', 'currency', 'date', 'datetime',
    'boolean', 'single_select', 'multi_select', 'photo', 'file',
    'relation', 'calculated'
  ) then
    raise exception 'Type fonctionnel invalide.';
  end if;

  if char_length(coalesce(p_help_text, '')) > 4000 then
    raise exception 'Le texte d''aide dépasse 4 000 caractères.';
  end if;

  if p_display_order is not null and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  v_old_values := jsonb_build_object(
    'field_label', v_old.field_label,
    'field_type', v_old.field_type,
    'help_text', v_old.help_text,
    'display_order', v_old.display_order,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set field_label = trim(p_field_label),
         field_type = p_field_type,
         help_text = nullif(trim(coalesce(p_help_text, '')), ''),
         display_order = p_display_order,
         configuration_status = 'draft',
         technical_name_locked = true,
         updated_at = now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := jsonb_build_object(
    'field_label', v_updated.field_label,
    'field_type', v_updated.field_type,
    'help_text', v_updated.help_text,
    'display_order', v_updated.display_order,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    auth.uid(),
    now(),
    'draft'
  );

  return v_updated;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_display_draft_v0131a42(text,text,text,boolean,boolean,boolean,integer,boolean) FROM PUBLIC,anon;

-- save_relation_field_display_draft_v0131a42: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_display_draft_v0131a42(p_table_name text, p_field_name text, p_contract_version text, p_show_in_grid boolean, p_show_in_form boolean, p_show_in_360 boolean, p_display_order integer, p_readonly_override boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.relation_fields%rowtype;
  v_updated public.relation_fields%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_changed_properties text[] := array[]::text[];
  v_actor uuid;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

  v_actor := auth.uid();
  if v_actor is null or public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  if p_contract_version is distinct from '1.0.0' then
    raise exception 'Version DisplayConfig non supportée.';
  end if;

  if p_table_name is null or pg_catalog.btrim(p_table_name) = ''
     or p_field_name is null or pg_catalog.btrim(p_field_name) = '' then
    raise exception 'La table et le nom technique sont obligatoires.';
  end if;

  if p_display_order is not null
     and (p_display_order < 0 or p_display_order > 100000) then
    raise exception 'L''ordre d''affichage doit être compris entre 0 et 100 000.';
  end if;

  select *
    into v_old
    from public.relation_fields
   where table_name = p_table_name
     and field_name = p_field_name
   for update;

  if not found then
    raise exception 'Champ ou table inconnu dans relation_fields.';
  end if;

  if coalesce(v_old.physical_is_primary_key, false)
     or coalesce(v_old.physical_is_foreign_key, false)
     or coalesce(v_old.physical_is_generated, false)
     or coalesce(v_old.physical_is_identity, false)
     or pg_catalog.lower(v_old.field_name) in (
       'id', 'support_id', 'created_at', 'updated_at', 'deleted_at',
       'auth_user_id', 'photo_principale_url', 'photo_miniature_url',
       'visuel_actuel_cadre'
     )
     or pg_catalog.lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception 'Ce champ système ou identifiant technique est protégé.';
  end if;

  if v_old.show_in_grid is not distinct from p_show_in_grid
     and v_old.show_in_form is not distinct from p_show_in_form
     and v_old.show_in_360 is not distinct from p_show_in_360
     and v_old.display_order is not distinct from p_display_order
     and v_old.readonly_override is not distinct from p_readonly_override
     and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'changed', false,
      'status', 'no_change',
      'contractName', 'DisplayConfig',
      'contractVersion', '1.0.0'
    );
  end if;

  if v_old.show_in_grid is distinct from p_show_in_grid then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_grid');
  end if;
  if v_old.show_in_form is distinct from p_show_in_form then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_form');
  end if;
  if v_old.show_in_360 is distinct from p_show_in_360 then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'show_in_360');
  end if;
  if v_old.display_order is distinct from p_display_order then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'display_order');
  end if;
  if v_old.readonly_override is distinct from p_readonly_override then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'readonly_override');
  end if;
  if v_old.configuration_status is distinct from 'draft' then
    v_changed_properties := pg_catalog.array_append(v_changed_properties, 'configuration_status');
  end if;

  v_old_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_old.show_in_grid,
    'show_in_form', v_old.show_in_form,
    'show_in_360', v_old.show_in_360,
    'display_order', v_old.display_order,
    'readonly_override', v_old.readonly_override,
    'configuration_status', v_old.configuration_status
  );

  update public.relation_fields
     set show_in_grid = p_show_in_grid,
         show_in_form = p_show_in_form,
         show_in_360 = p_show_in_360,
         display_order = p_display_order,
         readonly_override = p_readonly_override,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning * into v_updated;

  v_new_values := pg_catalog.jsonb_build_object(
    'show_in_grid', v_updated.show_in_grid,
    'show_in_form', v_updated.show_in_form,
    'show_in_360', v_updated.show_in_360,
    'display_order', v_updated.display_order,
    'readonly_override', v_updated.readonly_override,
    'configuration_status', v_updated.configuration_status
  );

  insert into public.relation_field_config_audit(
    relation_field_id,
    table_name,
    field_name,
    old_values,
    new_values,
    changed_by,
    changed_at,
    configuration_status,
    audit_schema_version,
    configuration_type,
    contract_name,
    contract_version,
    changed_properties,
    actor_user_id,
    occurred_at,
    transaction_id
  )
  values(
    v_updated.id,
    v_updated.table_name,
    v_updated.field_name,
    v_old_values,
    v_new_values,
    v_actor,
    pg_catalog.now(),
    'draft',
    '1.0.0',
    'display',
    'DisplayConfig',
    '1.0.0',
    v_changed_properties,
    v_actor,
    pg_catalog.now(),
    pg_catalog.txid_current()::text
  );

  return pg_catalog.jsonb_build_object(
    'changed', true,
    'status', 'draft_saved',
    'contractName', 'DisplayConfig',
    'contractVersion', '1.0.0',
    'changedProperties', pg_catalog.to_jsonb(v_changed_properties)
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_validation_draft_v0131a53(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_validation_draft_v0131a53: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_validation_draft_v0131a53(p_table_name text, p_field_name text, p_contract_version text, p_validation_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old public.relation_fields%rowtype;
  v_old_config jsonb;
  v_new_config jsonb;
  v_changed text[] := array[]::text[];
  v_key text;
  v_actor uuid := auth.uid();
  v_role text;
  v_updated_at timestamptz;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

  v_role := public.current_app_role();
  if v_actor is null then
    raise exception using message = 'Authentification requise.', detail = '{"code":"unauthorized"}';
  end if;
  if v_role <> 'Administrateur' then
    raise exception using message = 'Permission administrateur requise.', detail = '{"code":"administrator_required"}';
  end if;
  if p_contract_version is distinct from '1.0.0' then
    raise exception using message = 'Version ValidationConfig non supportée.', detail = '{"code":"unsupported_contract_version"}';
  end if;
  if p_expected_updated_at is null then
    raise exception using message = 'Horodatage attendu obligatoire.', detail = '{"code":"invalid_payload","field":"expectedUpdatedAt"}';
  end if;

  select * into v_old
    from public.relation_fields
   where table_name = p_table_name and field_name = p_field_name
   for update;
  if not found then
    raise exception using message = 'Champ inconnu dans relation_fields.', detail = '{"code":"field_not_found"}';
  end if;
  if v_old.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'Ce brouillon a été modifié par un autre administrateur.', detail = '{"code":"stale_draft"}';
  end if;
  if coalesce(v_old.physical_is_primary_key,false)
     or coalesce(v_old.physical_is_foreign_key,false)
     or coalesce(v_old.physical_is_generated,false)
     or coalesce(v_old.physical_is_identity,false)
     or v_old.field_type = 'calculated'
     or lower(v_old.field_name) in (
       'id','support_id','created_at','updated_at','deleted_at','auth_user_id',
       'photo_principale_url','photo_miniature_url','visuel_actuel_cadre'
     )
     or lower(v_old.field_name) like '%\_id' escape '\'
  then
    raise exception using message = 'Ce champ est protégé.', detail = '{"code":"field_protected"}';
  end if;

  v_new_config := public.normalize_validation_config_v0131a5(p_validation_config);
  v_old_config := public.normalize_validation_config_v0131a5(
    case when v_old.validation_rules = '{}'::jsonb then '{}'::jsonb else v_old.validation_rules end
  );

  if v_old.field_type in ('number','currency')
     and (v_new_config->'minimumLength' <> 'null'::jsonb or v_new_config->'maximumLength' <> 'null'::jsonb)
     or v_old.field_type in ('short_text','long_text')
     and (v_new_config->'minimumValue' <> 'null'::jsonb or v_new_config->'maximumValue' <> 'null'::jsonb)
     or v_old.field_type in ('date','datetime','boolean','single_select','multi_select','photo','file','relation')
     and (
       v_new_config->'minimumLength' <> 'null'::jsonb
       or v_new_config->'maximumLength' <> 'null'::jsonb
       or v_new_config->'minimumValue' <> 'null'::jsonb
       or v_new_config->'maximumValue' <> 'null'::jsonb
     )
  then
    raise exception using message = 'Règle incompatible avec le type du champ.', detail = '{"code":"incompatible_field_type"}';
  end if;

  if v_old_config = v_new_config and v_old.configuration_status = 'draft' then
    return pg_catalog.jsonb_build_object(
      'ok',true,'changed',false,'code','no_change',
      'validationConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at
    );
  end if;

  foreach v_key in array array[
    'requiredOverride','minimumLength','maximumLength','minimumValue',
    'maximumValue','allowedValues','errorMessages'
  ] loop
    if v_old_config->v_key is distinct from v_new_config->v_key then
      v_changed := pg_catalog.array_append(v_changed,v_key);
    end if;
  end loop;

  update public.relation_fields
     set validation_rules = v_new_config,
         configuration_status = 'draft',
         updated_at = pg_catalog.now()
   where id = v_old.id
   returning updated_at into v_updated_at;

  insert into public.relation_field_config_audit(
    relation_field_id,table_name,field_name,old_values,new_values,changed_by,
    changed_at,configuration_status,audit_schema_version,configuration_type,
    contract_name,contract_version,changed_properties,actor_user_id,occurred_at,
    transaction_id,actor_app_role,event_type
  ) values (
    v_old.id,v_old.table_name,v_old.field_name,
    pg_catalog.jsonb_build_object('validationConfig',v_old_config,'configuration_status',v_old.configuration_status),
    pg_catalog.jsonb_build_object('validationConfig',v_new_config,'configuration_status','draft'),
    v_actor,pg_catalog.now(),'draft','1.0.0','validation','ValidationConfig',
    '1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,
    v_role,'validation_draft_saved'
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'changed',true,'code','saved','validationConfig',v_new_config,
    'contractVersion','1.0.0','updatedAt',v_updated_at,
    'changedProperties',pg_catalog.to_jsonb(v_changed)
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_admin_invite_member_v120(text,text) FROM PUBLIC,anon;

-- client_admin_invite_member_v120: Client-Admin
CREATE OR REPLACE FUNCTION public.client_admin_invite_member_v120(p_email text, p_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role='Client-Admin';
 if v_client is null then raise exception 'client_admin_required' using errcode='42501'; end if;
 if p_email is null or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'invalid_email'; end if;
 insert into public.client_member_invitations(client_id,email,display_name) values(v_client,lower(trim(p_email)),nullif(trim(p_name),'')) returning id into v_id;
 return jsonb_build_object('invitation_id',v_id,'status','pending');
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_admin_deactivate_member_v120(bigint) FROM PUBLIC,anon;

-- client_admin_deactivate_member_v120: Client-Admin
CREATE OR REPLACE FUNCTION public.client_admin_deactivate_member_v120(p_member_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role='Client-Admin';
 if v_client is null then raise exception 'client_admin_required' using errcode='42501'; end if;
 update public.utilisateurs set statut='Inactif',updated_at=now() where id=p_member_id and client_id=v_client and role='Client';
 return found;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_import_export_draft_v0131a8(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_import_export_draft_v0131a8: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_import_export_draft_v0131a8(p_table_name text, p_field_name text, p_contract_version text, p_import_export_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare o public.relation_fields%rowtype;n jsonb;old jsonb;actor uuid:=auth.uid();app_role text;ts timestamptz;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN
 app_role:=public.current_app_role();if actor is null then raise exception using detail='{"code":"unauthorized"}';end if;if app_role<>'Administrateur'then raise exception using detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'or p_expected_updated_at is null then raise exception using detail='{"code":"invalid_payload"}';end if;select*into o from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using detail='{"code":"field_not_found"}';end if;if o.updated_at is distinct from p_expected_updated_at then raise exception using detail='{"code":"stale_draft"}';end if;n:=public.normalize_import_export_config_v0131a8(p_import_export_config);old:=public.normalize_import_export_config_v0131a8(case when o.import_export_config='{}'::jsonb then'{}'::jsonb else o.import_export_config end);if old=n and o.configuration_status='draft'then return pg_catalog.jsonb_build_object('changed',false,'code','no_change','importExportConfig',old,'updatedAt',o.updated_at);end if;update public.relation_fields set import_export_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(o.id,o.table_name,o.field_name,pg_catalog.jsonb_build_object('importExportConfig',old),pg_catalog.jsonb_build_object('importExportConfig',n),actor,pg_catalog.now(),'draft','1.0.0','import_export','ImportExportConfig','1.0.0',array['importExportConfig'],actor,pg_catalog.now(),pg_catalog.txid_current()::text,app_role,'import_export_draft_saved');return pg_catalog.jsonb_build_object('changed',true,'code','saved','importExportConfig',n,'updatedAt',ts);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_a9_draft_v0131a9(text,text,text,jsonb,timestamp with time zone,text) FROM PUBLIC,anon;

-- save_relation_field_a9_draft_v0131a9: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_a9_draft_v0131a9(p_table_name text, p_field_name text, p_contract_version text, p_config jsonb, p_expected_updated_at timestamp with time zone, p_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare o public.relation_fields%rowtype;n jsonb;old jsonb;actor uuid:=auth.uid();app_role text;ts timestamptz;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN
 app_role:=public.current_app_role();if actor is null or app_role<>'Administrateur'then raise exception using detail='{"code":"administrator_required"}';end if;if p_contract_version is distinct from'1.0.0'or p_expected_updated_at is null or p_type not in('relation','calculation')then raise exception using detail='{"code":"invalid_payload"}';end if;select*into o from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using detail='{"code":"field_not_found"}';end if;if o.updated_at is distinct from p_expected_updated_at then raise exception using detail='{"code":"stale_draft"}';end if;n:=public.normalize_a9_config_v0131a9(p_config,p_type);old:=public.normalize_a9_config_v0131a9(case when p_type='relation'then o.relation_config else o.calculation_config end,p_type);if old=n and o.configuration_status='draft'then return pg_catalog.jsonb_build_object('changed',false,'code','no_change','updatedAt',o.updated_at);end if;if p_type='relation'then update public.relation_fields set relation_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;else update public.relation_fields set calculation_config=n,configuration_status='draft',updated_at=pg_catalog.now()where id=o.id returning updated_at into ts;end if;insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(o.id,o.table_name,o.field_name,old,n,actor,pg_catalog.now(),'draft','1.0.0',p_type,case when p_type='relation'then'RelationConfig'else'CalculationConfig'end,'1.0.0',array[p_type],actor,pg_catalog.now(),pg_catalog.txid_current()::text,app_role,p_type||'_draft_saved');return pg_catalog.jsonb_build_object('changed',true,'code','saved','updatedAt',ts);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_relation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_relation_draft_v0131a9: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_relation_draft_v0131a9(p_table_name text, p_field_name text, p_contract_version text, p_relation_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN (select public.save_relation_field_a9_draft_v0131a9(p_table_name,p_field_name,p_contract_version,p_relation_config,p_expected_updated_at,'relation'));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.save_relation_field_calculation_draft_v0131a9(text,text,text,jsonb,timestamp with time zone) FROM PUBLIC,anon;

-- save_relation_field_calculation_draft_v0131a9: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.save_relation_field_calculation_draft_v0131a9(p_table_name text, p_field_name text, p_contract_version text, p_calculation_config jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;
RETURN (select public.save_relation_field_a9_draft_v0131a9(p_table_name,p_field_name,p_contract_version,p_calculation_config,p_expected_updated_at,'calculation'));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.prepare_automation_definition_v0131() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_photo_current_visual_v132p0() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_photo_current_visual_v132p0() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.tdm_edt_audit_v132p1(bigint,bigint,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.initialiser_cycle_edt_v132p1(bigint,bigint) FROM PUBLIC,anon;

-- initialiser_cycle_edt_v132p1: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.initialiser_cycle_edt_v132p1(p_edt_id bigint, p_campagne_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;i public.edt_phases%rowtype;r public.edt_phases%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagnes_maitres sec_campaign WHERE sec_campaign.id=p_campagne_id AND public.tos_table_resource_scope(sec_campaign.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501'; end if;
  select * into e from public.suivi_des_edt where id=p_edt_id for update;if not found then raise exception 'EDT introuvable.';end if;
  select * into c from public.campagnes_maitres where id=p_campagne_id;if not found then raise exception 'Campagne introuvable.';end if;
  if c.date_fin is null then raise exception 'La campagne doit avoir une date de fin.';end if;
  update public.suivi_des_edt set campagne_id=c.id,campagne=c.nom_campagne,retrait_date_proposee=coalesce(retrait_date_proposee,c.date_fin),lifecycle_status=case when lifecycle_status='brouillon' then 'planifie' else lifecycle_status end,updated_at=now() where id=p_edt_id;
  insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(p_edt_id,'Installation',1,'installation','planifiee',coalesce(e.date_debut,public.tdm_try_date(e.date_debut_prevue::text)),0) on conflict(edt_id,phase_type) where phase_type is not null do nothing returning * into i;
  insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(p_edt_id,'Retrait',2,'retrait','planifie',null,0) on conflict(edt_id,phase_type) where phase_type is not null do nothing returning * into r;
  perform public.tdm_edt_audit_v132p1(p_edt_id,null,'INITIALISATION',to_jsonb(e),jsonb_build_object('campagne_id',c.id,'retrait_date_proposee',c.date_fin),'Deux phases garanties; date de retrait proposée, non imposée.');
  return jsonb_build_object('ok',true,'edt_id',p_edt_id,'campagne_id',c.id,'retrait_date_proposee',c.date_fin);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.transition_phase_edt_v132p1(bigint,text,text,jsonb,text,text) FROM PUBLIC,anon;

-- transition_phase_edt_v132p1: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.transition_phase_edt_v132p1(p_phase_id bigint, p_action text, p_commentaire text DEFAULT NULL::text, p_anomalies jsonb DEFAULT '[]'::jsonb, p_photo_exception text DEFAULT NULL::text, p_exception_date text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;oldp jsonb;open_count int;blocked_count int;photo_count int;next_status text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501';end if;
  select * into p from public.edt_phases where id=p_phase_id for update;if not found or p.phase_type not in ('installation','retrait') then raise exception 'Phase EDT P1 introuvable.';end if;
  select * into e from public.suivi_des_edt where id=p.edt_id for update;select * into c from public.campagnes_maitres where id=e.campagne_id;
  oldp:=to_jsonb(p);
  if p_action='demarrer' then
    if p.phase_type='retrait' and not exists(select 1 from public.edt_phases where edt_id=p.edt_id and phase_type='installation' and statut='fermee') then raise exception 'Installation non fermée.';end if;
    next_status:='en_cours';update public.edt_phases set statut=next_status,date_debut_reelle=coalesce(date_debut_reelle,now()),updated_at=now() where id=p.id;
  elsif p_action='terminer' then
    next_status:=case when p.phase_type='installation' then 'terminee' else 'termine' end;update public.edt_phases set statut=next_status,progression=100,date_fin_reelle=coalesce(date_fin_reelle,now()),commentaire=p_commentaire,anomalies=coalesce(p_anomalies,'[]'),updated_at=now() where id=p.id;
  elsif p_action='fermer' then
    select count(*) into open_count from public.edt_supports where edt_id=p.edt_id and phase_id=p.id and statut not in ('Terminé','Terminée','Complété','Complétée','Annulé');
    select count(*) into blocked_count from public.edt_supports where edt_id=p.edt_id and phase_id=p.id and (bloque or statut='Bloqué');
    select count(*) into photo_count from public.support_photos where edt_id=p.edt_id::text and lower(type_photo)=p.phase_type and coalesce(status,'active')='active';
    if p.progression<100 or open_count>0 then raise exception 'Éléments obligatoires incomplets.';end if;
    if photo_count=0 and coalesce(trim(p_photo_exception),'')='' then raise exception 'Photo requise ou exception documentée.';end if;
    if blocked_count>0 and jsonb_array_length(coalesce(p_anomalies,'[]'))=0 then raise exception 'Anomalies bloquantes non documentées.';end if;
    next_status:=case when p.phase_type='installation' then 'fermee' else 'ferme' end;
    update public.edt_phases set statut=next_status,closed_at=now(),closed_by=auth.uid(),report_ready_at=now(),commentaire=p_commentaire,anomalies=coalesce(p_anomalies,'[]'),photo_exception=p_photo_exception,updated_at=now() where id=p.id;
    insert into public.edt_phase_reports(edt_id,phase_id,phase_type,version,status,report_snapshot,generated_at,generated_by)
    select p.edt_id,p.id,p.phase_type,coalesce(max(version),0)+1,'brouillon',jsonb_build_object('edt_id',p.edt_id,'phase',p.phase_type,'closed_at',now()),now(),auth.uid() from public.edt_phase_reports where phase_id=p.id;
  elsif p_action='rouvrir' then
    if coalesce(trim(p_commentaire),'')='' then raise exception 'Motif de réouverture obligatoire.';end if;
    if p.closed_at is null then raise exception 'La phase n’est pas fermée.';end if;
    next_status:=case when p.phase_type='installation' then 'terminee' else 'termine' end;
    update public.edt_phases set statut=next_status,reopened_at=now(),reopened_by=auth.uid(),reopen_reason=p_commentaire,closed_at=null,closed_by=null,updated_at=now() where id=p.id;
    update public.edt_phase_reports set archived=true where phase_id=p.id and archived=false;
    update public.suivi_des_edt set lifecycle_status=case when p.phase_type='installation' then 'installation_terminee' else 'retrait_termine' end,lifecycle_closed_at=null,lifecycle_closed_by=null,updated_at=now() where id=p.edt_id;
  else raise exception 'Action de phase invalide.';end if;
  update public.suivi_des_edt set lifecycle_status=case when p.phase_type='installation' then case next_status when 'en_cours' then 'installation_en_cours' when 'terminee' then 'installation_terminee' when 'fermee' then 'attente_fin_campagne' else lifecycle_status end else case next_status when 'en_cours' then 'retrait_en_cours' when 'termine' then 'retrait_termine' when 'ferme' then 'retrait_termine' else lifecycle_status end end,updated_at=now() where id=p.edt_id;
  perform public.tdm_edt_audit_v132p1(p.edt_id,p.id,upper(p_action),oldp,(select to_jsonb(x) from public.edt_phases x where x.id=p.id),coalesce(p_commentaire,p_exception_date));
  return jsonb_build_object('ok',true,'phase_id',p.id,'statut',next_status);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.planifier_retrait_edt_v132p1(bigint,date,text) FROM PUBLIC,anon;

-- planifier_retrait_edt_v132p1: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.planifier_retrait_edt_v132p1(p_phase_id bigint, p_date date, p_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;i public.edt_phases%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501';end if;
  select * into p from public.edt_phases where id=p_phase_id and phase_type='retrait' for update;if not found then raise exception 'Phase Retrait introuvable.';end if;
  select * into e from public.suivi_des_edt where id=p.edt_id;select * into c from public.campagnes_maitres where id=e.campagne_id;select * into i from public.edt_phases where edt_id=p.edt_id and phase_type='installation';
  if i.closed_at is not null and p_date<i.closed_at::date then raise exception 'Retrait avant fermeture Installation interdit.';end if;
  if p_date<c.date_fin and coalesce(trim(p_justification),'')='' then raise exception 'Justification obligatoire avant la fin de campagne.';end if;
  update public.edt_phases set date_debut_prevue=p_date,statut=case when p_date<c.date_fin then 'planifie' else 'planifie' end,commentaire=coalesce(p_justification,commentaire),updated_at=now() where id=p.id;
  update public.suivi_des_edt set lifecycle_status='retrait_planifie',lifecycle_exception=case when p_date<c.date_fin then p_justification else lifecycle_exception end,updated_at=now() where id=p.edt_id;
  perform public.tdm_edt_audit_v132p1(p.edt_id,p.id,'PLANIFICATION_RETRAIT',to_jsonb(p),(select to_jsonb(x) from public.edt_phases x where x.id=p.id),p_justification);
  return jsonb_build_object('ok',true,'date',p_date,'avant_fin_campagne',p_date<c.date_fin);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.fermer_edt_v132p1(bigint,text) FROM PUBLIC,anon;

-- fermer_edt_v132p1: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.fermer_edt_v132p1(p_edt_id bigint, p_motif text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.suivi_des_edt%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501';end if;
  select * into e from public.suivi_des_edt where id=p_edt_id for update;if not found then raise exception 'EDT introuvable.';end if;
  if not exists(select 1 from public.edt_phases where edt_id=p_edt_id and phase_type='installation' and statut='fermee') or not exists(select 1 from public.edt_phases where edt_id=p_edt_id and phase_type='retrait' and statut='ferme') then raise exception 'Les deux phases doivent être fermées.';end if;
  if exists(select 1 from public.edt_supports where edt_id=p_edt_id and (bloque or statut='Bloqué')) and coalesce(trim(p_motif),'')='' then raise exception 'Blocage critique non documenté.';end if;
  update public.suivi_des_edt set lifecycle_status='ferme',statut='Fermé',lifecycle_closed_at=now(),lifecycle_closed_by=auth.uid(),lifecycle_exception=p_motif,date_fin=current_date,progression=100,updated_at=now() where id=p_edt_id;
  perform public.tdm_edt_audit_v132p1(p_edt_id,null,'FERMETURE_EDT',to_jsonb(e),(select to_jsonb(x) from public.suivi_des_edt x where x.id=p_edt_id),p_motif);
  return jsonb_build_object('ok',true,'edt_id',p_edt_id,'statut','ferme');
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_portal_list_v120(text,integer,integer,jsonb) FROM PUBLIC,anon;

-- client_portal_list_v120: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.client_portal_list_v120(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

  select client_id,role into v_client,v_role from public.utilisateurs
   where auth_user_id=v_uid and statut='Actif' and role in ('Client','Client-Admin');
  if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
  if p_section not in ('dashboard','campaigns','communications','supports','photos','reports','edt','issues','history','members') then raise exception 'invalid_section'; end if;
  if p_section='members' and v_role<>'Client-Admin' then raise exception 'client_admin_required' using errcode='42501'; end if;
  v_limit:=least(case when p_section='photos' then 50 else 100 end,greatest(1,coalesce(p_page_size,25)));
  v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section in ('campaigns','communications') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut
      from public.campagnes_maitres c where c.client_id=v_client and c.client_published
       and c.business_context=case when p_section='campaigns' then 'marketing' else 'operational_communication' end
       and (v_role='Client-Admin' or public.client_can_access_campaign_v120(c.id))
      order by c.date_fin desc nulls last,c.id desc limit v_limit offset v_offset) q;
  elsif p_section='supports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select i.site,i.support_id,i.type_support,i.emplacement_visibilite,cs.statut,cs.no_edt,c.id campaign_id,c.nom_campagne,c.business_context,cs.visuel_attendu visual
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id
      join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id)
      order by i.site,i.support_id,c.id limit v_limit offset v_offset) q;
  elsif p_section='photos' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select p.id,p.support_id,p.campagne_id,p.visuel_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.prise_le,p.statut_validation
      from public.support_photos p join public.campagnes_maitres c on c.id=p.campagne_id
      where c.client_id=v_client and c.client_published and p.client_visible and public.client_can_access_campaign_v120(c.id)
      order by p.prise_le desc,p.id desc limit v_limit offset v_offset) q;
  elsif p_section='reports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select r.id,r.numero_edt,r.campagne,r.objet,r.report_path,r.sent_at,r.created_at
      from public.communications_finales r where r.client_id=v_client and r.client_published and r.statut in ('Envoyé','Publié')
      order by r.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='edt' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.rapport_final_envoye,e.rapport_final_path,e.campagne_id
      from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id
      where c.client_id=v_client and c.client_published and e.client_visible and public.client_can_access_campaign_v120(c.id)
      order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset) q;
  elsif p_section='issues' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and public.client_can_access_campaign_v120(c.id))
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='history' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status
      from public.activity_events a where a.client_visible and a.client_id=v_client::text
       and a.action in ('campagne_publiee','photo_ajoutee','edt_termine','rapport_disponible','enjeu_ouvert','communication_publiee')
      order by a.occurred_at desc,a.id desc limit v_limit offset v_offset) q;
  elsif p_section='members' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select u.id,u.nom,u.courriel,u.role,u.statut,u.updated_at from public.utilisateurs u
      where u.client_id=v_client and u.role in ('Client','Client-Admin') order by u.nom,u.id limit v_limit offset v_offset) q;
  else
    return jsonb_build_object('section','dashboard','organization_id',v_client,'role',v_role);
  end if;
  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.marquer_rapport_phase_envoye_v132p1(bigint,text,text) FROM PUBLIC,anon;

-- marquer_rapport_phase_envoye_v132p1: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.marquer_rapport_phase_envoye_v132p1(p_report_id bigint, p_recipient text, p_provider_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.edt_phase_reports%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phase_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501';end if;
  if coalesce(trim(p_recipient),'')='' then raise exception 'Destinataire obligatoire.';end if;
  select * into r from public.edt_phase_reports where id=p_report_id for update;if not found then raise exception 'Rapport introuvable.';end if;
  update public.edt_phase_reports set status='envoye',recipient=p_recipient,sent_at=now(),sent_by=auth.uid(),provider_message_id=p_provider_message_id where id=r.id;
  perform public.tdm_edt_audit_v132p1(r.edt_id,r.phase_id,'ENVOI_RAPPORT',to_jsonb(r),(select to_jsonb(x) from public.edt_phase_reports x where x.id=r.id),p_recipient);
  return jsonb_build_object('ok',true,'report_id',r.id,'sent_at',now());
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.delete_or_archive_master_campaign_v111(bigint) FROM PUBLIC,anon;

-- delete_or_archive_master_campaign_v111: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.delete_or_archive_master_campaign_v111(p_campaign_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.campagnes_maitres%rowtype; dependency_count bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagnes_maitres sec_campaign WHERE sec_campaign.id=p_campaign_id AND public.tos_table_resource_scope(sec_campaign.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.'; end if;
  select * into c from public.campagnes_maitres where id=p_campaign_id for update;
  if not found then raise exception 'Campagne introuvable.'; end if;
  select
    (select count(*) from public.campagne_visuels_formats where campagne_id=c.id)+
    (select count(*) from public.support_photos where campagne_id=c.id)+
    (select count(*) from public.suivi_des_edt where campagne_id=c.id)+
    (select count(*) from public.historique_des_campagnes where campagne=c.nom_campagne)
  into dependency_count;
  if dependency_count>0 then
    update public.campagnes_maitres set statut='Archivée',publiee_terrain=false,updated_at=now() where id=c.id;
    return jsonb_build_object('action','archived','dependencies',dependency_count);
  end if;
  delete from public.campagnes_maitres where id=c.id;
  return jsonb_build_object('action','deleted','dependencies',0);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.capture_activity_source_v113() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.edt_email_status_v131(bigint) FROM PUBLIC,anon;

-- edt_email_status_v131: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.edt_email_status_v131(p_edt_id bigint)
 RETURNS TABLE(status text, recipient_email text, sent_at timestamp with time zone, last_error text, report_version integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501'; end if;
 return query select o.status,l.recipient_email,l.sent_at,coalesce(o.last_error,l.last_error),coalesce(o.report_version,l.report_version) from public.email_outbox o left join lateral(select * from public.email_delivery_log d where d.outbox_id=o.id order by d.created_at desc limit 1)l on true where o.edt_id=p_edt_id order by o.created_at desc limit 1;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_portal_identity_v120() FROM PUBLIC,anon;

-- client_portal_identity_v120: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.client_portal_identity_v120()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;
RETURN (select case when u.role in ('Client','Client-Admin') and u.statut='Actif' and u.client_id is not null
    then jsonb_build_object('user_id',auth.uid(),'role',u.role,'organization_id',u.client_id,'name',u.nom)
    else null end
  from public.utilisateurs u where u.auth_user_id=auth.uid() limit 1);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.client_can_access_campaign_v120(bigint) FROM PUBLIC,anon;
CREATE OR REPLACE FUNCTION public.client_can_access_campaign_v120(p_campaign_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1 from public.utilisateurs u join public.campagnes_maitres c on c.client_id=u.client_id
    where public.tos_current_role() IN ('Client','Client-Admin') AND EXISTS(SELECT 1 FROM public.clients owner_client WHERE owner_client.id=u.client_id) AND u.auth_user_id=auth.uid() and u.statut='Actif' and u.role in ('Client','Client-Admin')
      and c.id=p_campaign_id and c.client_published
      and (u.role='Client-Admin' or exists(select 1 from public.client_campaign_access a
        where a.client_id=u.client_id and a.campaign_id=c.id and (a.user_id is null or a.user_id=auth.uid())))
  );
$function$
;
REVOKE EXECUTE ON FUNCTION public.resolve_terrain_sync_v113(uuid,text) FROM PUBLIC,anon;

-- resolve_terrain_sync_v113: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.resolve_terrain_sync_v113(p_id uuid, p_resolution text)
 RETURNS public.terrain_sync_diagnostics
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result public.terrain_sync_diagnostics;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.terrain_sync_diagnostics sec_diag WHERE sec_diag.id=p_id AND public.tos_table_resource_scope(NULL,sec_diag.support_id,sec_diag.campagne_id,sec_diag.edt_id,true))) IS NOT TRUE THEN RAISE EXCEPTION 'diagnostic_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 update public.terrain_sync_diagnostics set statut='resolved',resolved_at=now(),resolved_by=auth.uid(),resolution=nullif(trim(p_resolution),'') where id=p_id and lower(statut) in ('Ã©chec','echec','error','erreur','failed') returning * into result;
 if result.id is null then raise exception 'diagnostic_not_resolvable';end if;return result;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_admin_set_campaign_access_v120(bigint,bigint,boolean) FROM PUBLIC,anon;

-- client_admin_set_campaign_access_v120: Client-Admin
CREATE OR REPLACE FUNCTION public.client_admin_set_campaign_access_v120(p_member_id bigint, p_campaign_id bigint, p_allowed boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_member_uid uuid;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagnes_maitres sec_campaign WHERE sec_campaign.id=p_campaign_id AND public.tos_table_resource_scope(sec_campaign.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role='Client-Admin';
 if v_client is null then raise exception 'client_admin_required' using errcode='42501'; end if;
 select auth_user_id into v_member_uid from public.utilisateurs where id=p_member_id and client_id=v_client and role='Client';
 if v_member_uid is null or not exists(select 1 from public.campagnes_maitres where id=p_campaign_id and client_id=v_client) then raise exception 'cross_client_denied' using errcode='42501'; end if;
 if p_allowed then insert into public.client_campaign_access(client_id,campaign_id,user_id) values(v_client,p_campaign_id,v_member_uid) on conflict do nothing;
 else delete from public.client_campaign_access where client_id=v_client and campaign_id=p_campaign_id and user_id=v_member_uid; end if;
 return true;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.module15_report_activity_v130() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_search_client_users_v136(text) FROM PUBLIC,anon;

-- admin_search_client_users_v136: Administrateur
CREATE OR REPLACE FUNCTION public.admin_search_client_users_v136(p_query text DEFAULT ''::text)
 RETURNS TABLE(id bigint, nom text, courriel text, role text, client_id bigint, client_name text, statut text, auth_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 return query select u.id,u.nom,u.courriel,u.role,u.client_id,c.nom_client,u.statut,u.auth_user_id from public.utilisateurs u left join public.clients c on c.id=u.client_id
 where public.tos_table_resource_scope(u.client_id,NULL,NULL,NULL,true) AND (p_query=''or u.nom ilike'%'||p_query||'%'or u.courriel ilike'%'||p_query||'%')order by u.nom,u.courriel limit 50;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.module15_generate_report_v130(uuid,jsonb) FROM PUBLIC,anon;

-- module15_generate_report_v130: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.module15_generate_report_v130(p_report_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS public.reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports%rowtype; n public.reports%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.reports sec_report WHERE sec_report.id=p_report_id AND public.tos_table_resource_scope(sec_report.client_id,sec_report.support_id,sec_report.campaign_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found or r.status not in ('draft','generated','published','error') then raise exception 'Transition non autorisée'; end if;
 if r.status='published' then
  insert into public.reports(report_type,title,client_id,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,client_published,created_by,updated_by,metadata,template_key,version,parent_report_id)
  values(r.report_type,r.title,r.client_id,r.campaign_id,r.communication_id,r.site,r.support_id,r.no_edt,r.period_start,r.period_end,'generated',false,auth.uid(),auth.uid(),coalesce(p_metadata,r.metadata),r.template_key,r.version+1,r.id) returning * into n;
 else
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,metadata=coalesce(p_metadata,metadata),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into n;
 end if;
 return n;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.module15_transition_report_v130(uuid,text) FROM PUBLIC,anon;

-- module15_transition_report_v130: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.module15_transition_report_v130(p_report_id uuid, p_action text)
 RETURNS public.reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.reports sec_report WHERE sec_report.id=p_report_id AND public.tos_table_resource_scope(sec_report.client_id,sec_report.support_id,sec_report.campaign_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found then raise exception 'Rapport introuvable'; end if;
 if p_action='publish' and r.status='generated' then
  update public.reports set status='published',client_published=true,published_by=auth.uid(),published_at=now(),archived_by=null,archived_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='unpublish' and r.status='published' then
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='archive' and r.status in ('draft','generated','published','error') then
  update public.reports set status='archived',client_published=false,published_by=null,published_at=null,archived_by=auth.uid(),archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 else raise exception 'Transition non autorisée'; end if;
 return r;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.module15_client_reports_v130(integer,integer) FROM PUBLIC,anon;

-- module15_client_reports_v130: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.module15_client_reports_v130(p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_role text;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'Accès refusé'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,report_type,title,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,published_at,template_key,version,metadata from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id)) order by published_at desc limit v_limit offset v_offset)q),'[]'::jsonb),'total',(select count(*) from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id))),'page',greatest(coalesce(p_page,1),1),'page_size',v_limit);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.module15_client_edt_reports_v130(integer,integer) FROM PUBLIC,anon;

-- module15_client_edt_reports_v130: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.module15_client_edt_reports_v130(p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
   select r.id,r.edt_id,e.no_edt,r.report_version,r.status,r.report_path,r.generated_at
   from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id
   where c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready'
     and public.client_can_access_campaign_v120(c.id)
   order by r.generated_at desc limit v_limit offset v_offset)q),'[]'::jsonb),
   'total',(select count(*) from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready' and public.client_can_access_campaign_v120(c.id)),
   'page',greatest(coalesce(p_page,1),1),'page_size',v_limit);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.validate_edt_report_requester_v1301() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.edt_report_activity_v130() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_edt_requester_v131() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_edt_report_v1301(bigint,text,text,boolean) FROM PUBLIC,anon;

-- create_edt_report_v1301: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.create_edt_report_v1301(p_edt_id bigint, p_report_path text, p_storage_bucket text DEFAULT 'final-reports'::text, p_client_visible boolean DEFAULT false)
 RETURNS public.edt_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_edt public.suivi_des_edt%rowtype;v_requester public.utilisateurs%rowtype;v_client bigint;v_report public.edt_reports%rowtype;v_version integer;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501'; end if;
 if nullif(btrim(p_report_path),'') is null or coalesce(p_storage_bucket,'')<>'final-reports' then raise exception 'invalid_report_file'; end if;
 select * into v_edt from public.suivi_des_edt where id=p_edt_id for update;
 if not found or v_edt.statut<>'Complété' or v_edt.requester_contact_id is null then raise exception 'invalid_completed_edt'; end if;
 select c.client_id into v_client from public.campagnes_maitres c where c.id=v_edt.campagne_id;
 select * into v_requester from public.utilisateurs u where u.id=v_edt.requester_contact_id;
 if v_client is null or v_requester.client_id is null or v_requester.client_id<>v_client then raise exception 'requester_client_mismatch' using errcode='23514'; end if;
 select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=v_edt.id;
 insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible)
 values(v_edt.id,v_version,'ready','final-reports',btrim(p_report_path),v_requester.id,now(),auth.uid(),coalesce(p_client_visible,false)) returning * into v_report;
 return v_report;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.enqueue_edt_completion_email_v131() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.request_edt_email_retry_v131(bigint,boolean) FROM PUBLIC,anon;

-- request_edt_email_retry_v131: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.request_edt_email_retry_v131(p_edt_id bigint, p_resend boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501'; end if;
 if not exists(select 1 from public.suivi_des_edt where id=p_edt_id and statut='Complété') then raise exception 'edt_not_completed'; end if;
 if (select count(*) from public.email_outbox where edt_id=p_edt_id and requested_by=auth.uid() and created_at>now()-interval '1 hour')>=3 then raise exception 'email_rate_limit'; end if;
 if p_resend then
  insert into public.email_outbox(event_type,edt_id,idempotency_key,status,manual_resend,requested_by) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id::text||':manual:'||gen_random_uuid()::text,'pending',true,auth.uid()) returning id into v_id;
 else
  update public.email_outbox set status='pending',attempt_count=0,next_attempt_at=now(),last_error=null,requested_by=auth.uid(),updated_at=now() where edt_id=p_edt_id and event_type='edt_completed_report_sent' and not manual_resend and status='failed' returning id into v_id;
  if v_id is null and not exists(select 1 from public.email_outbox where edt_id=p_edt_id and event_type='edt_completed_report_sent') then insert into public.email_outbox(event_type,edt_id,idempotency_key,status,manual_resend,requested_by) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id::text||':manual:'||gen_random_uuid()::text,'pending',true,auth.uid()) returning id into v_id; end if;
 end if;
 if v_id is null then raise exception 'retry_not_available'; end if;
 return v_id;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.edt_email_activity_v131() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.save_edt_report_draft_v132(bigint,text,text,text,jsonb,integer,boolean,uuid) FROM PUBLIC,anon;

-- save_edt_report_draft_v132: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.save_edt_report_draft_v132(p_edt_id bigint, p_title text, p_summary text, p_conclusion text, p_content_snapshot jsonb, p_support_count integer, p_client_visible boolean DEFAULT false, p_report_id uuid DEFAULT NULL::uuid)
 RETURNS public.edt_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.edt_reports;v_source_count integer;v_requester bigint;v_version integer;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF p_report_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)) AND sec_report.edt_id=p_edt_id)) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;
END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';if v_requester is null then raise exception 'completed_edt_requester_required';end if;
 select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,requester_contact_id,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'draft',v_requester,auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.finalize_edt_report_v132(bigint,uuid,text,text,text,text,text,jsonb,integer,boolean) FROM PUBLIC,anon;

-- finalize_edt_report_v132: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.finalize_edt_report_v132(p_edt_id bigint, p_report_id uuid, p_report_path text, p_storage_bucket text, p_title text, p_summary text, p_conclusion text, p_content_snapshot jsonb, p_support_count integer, p_client_visible boolean DEFAULT false)
 RETURNS public.edt_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.edt_reports;v_source_count integer;v_requester bigint;v_version integer;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF p_report_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)) AND sec_report.edt_id=p_edt_id)) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;
END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_requester is null or v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set status='ready',report_path=p_report_path,storage_bucket=p_storage_bucket,title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,generated_at=now(),updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'ready',p_storage_bucket,p_report_path,v_requester,now(),auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.request_edt_report_email_v132(bigint,uuid,text[],text,boolean) FROM PUBLIC,anon;

-- request_edt_report_email_v132: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.request_edt_report_email_v132(p_edt_id bigint, p_report_id uuid, p_recipients text[], p_message text DEFAULT ''::text, p_resend boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint;v_report public.edt_reports;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)) AND sec_report.edt_id=p_edt_id)) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select * into v_report from public.edt_reports where id=p_report_id and edt_id=p_edt_id and status in ('generated','ready');if v_report.id is null then raise exception 'final_report_required';end if;
 if coalesce(array_length(p_recipients,1),0)=0 or exists(select 1 from unnest(p_recipients)e where e!~*'^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then raise exception 'invalid_recipient_email';end if;
 insert into public.email_outbox(event_type,edt_id,idempotency_key,report_id,report_version,status,manual_resend,requested_by,recipient_emails,accompaniment_message) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id||':manual:'||gen_random_uuid(),v_report.id,v_report.report_version,'pending',p_resend,auth.uid(),p_recipients,p_message) returning id into v_id;return v_id;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.creer_edt_v133(bigint,text,date,boolean,date,text,text,text) FROM PUBLIC,anon;

-- creer_edt_v133: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.creer_edt_v133(p_campagne_id bigint, p_no_edt text, p_date_installation date, p_creer_retrait boolean DEFAULT false, p_date_retrait date DEFAULT NULL::date, p_client text DEFAULT NULL::text, p_priorite text DEFAULT 'Normale'::text, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.campagnes_maitres%rowtype;e public.suivi_des_edt%rowtype;i public.edt_phases%rowtype;r public.edt_phases%rowtype;v_no text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagnes_maitres sec_campaign WHERE sec_campaign.id=p_campagne_id AND public.tos_table_resource_scope(sec_campaign.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'campaign_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 if p_date_installation is null then raise exception 'installation_date_required';end if;
 if p_creer_retrait and p_date_retrait is null then raise exception 'removal_date_required';end if;
 if p_date_retrait is not null and p_date_retrait<p_date_installation then raise exception 'removal_before_installation';end if;
 select * into c from public.campagnes_maitres where id=p_campagne_id;if not found then raise exception 'campaign_not_found';end if;
 v_no:=coalesce(nullif(trim(p_no_edt),''),'EDT-TOS-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS'));
 insert into public.suivi_des_edt(no_edt,nom,campagne_id,campagne,client,statut,priorite,date_debut,date_debut_prevue,lifecycle_status,description,updated_at)
 values(v_no,c.nom_campagne,c.id,c.nom_campagne,nullif(trim(p_client),''),'Planifie',coalesce(p_priorite,'Normale'),p_date_installation,p_date_installation::text,'planifie',nullif(trim(p_description),''),now()) returning * into e;
 insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,v_no||' Installation',1,'installation','planifiee',p_date_installation,0) returning * into i;
 if p_creer_retrait then insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,v_no||' Retrait',2,'retrait','planifie',p_date_retrait,0) returning * into r;end if;
 return jsonb_build_object('parent',to_jsonb(e),'installation',to_jsonb(i),'retrait',case when r.id is null then null else to_jsonb(r) end);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.transition_edt_phase_v133(bigint,text) FROM PUBLIC,anon;

-- transition_edt_phase_v133: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.transition_edt_phase_v133(p_phase_id bigint, p_target_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;v_current text;v_target text;v_parent text;v_updated public.edt_phases%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='28000';end if;
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into p from public.edt_phases where id=p_phase_id for update;
 if not found or p.phase_type not in ('installation','retrait') then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id for update;if not found or e.archived_at is not null then raise exception 'edt_not_available';end if;
 v_current:=case lower(p.statut) when 'planifie' then 'planifiee' when 'termine' then 'terminee' when 'ferme' then 'fermee' else lower(p.statut) end;
 v_target:=case lower(p_target_status) when 'planifie' then 'planifiee' when 'termine' then 'terminee' when 'ferme' then 'fermee' else lower(p_target_status) end;
 if not ((v_current='planifiee' and v_target='en_cours') or (v_current='en_cours' and v_target='terminee') or (v_current='terminee' and v_target='fermee') or (v_current='fermee' and v_target='terminee')) then
   raise exception 'invalid_phase_transition:%->%',v_current,v_target using errcode='22023';
 end if;
 update public.edt_phases set statut=v_target,
   date_debut_reelle=case when v_target='en_cours' then coalesce(date_debut_reelle,now()) else date_debut_reelle end,
   date_fin_reelle=case when v_target='terminee' and v_current='en_cours' then coalesce(date_fin_reelle,now()) when v_current='fermee' then null else date_fin_reelle end,
   closed_at=case when v_target='fermee' then now() when v_current='fermee' then null else closed_at end,
   closed_by=case when v_target='fermee' then auth.uid() when v_current='fermee' then null else closed_by end,
   progression=case v_target when 'planifiee' then 0 when 'en_cours' then greatest(progression,1) else 100 end,updated_at=now()
 where id=p.id returning * into v_updated;
 v_parent:=case when not exists(select 1 from public.edt_phases x where x.edt_id=p.edt_id and x.phase_type in ('installation','retrait') and x.statut<>'fermee')
                       and exists(select 1 from public.edt_phases x where x.edt_id=p.edt_id and x.phase_type='installation' and x.statut='fermee')
                       and exists(select 1 from public.edt_phases x where x.edt_id=p.edt_id and x.phase_type='retrait' and x.statut='fermee')
                  then 'Termine'
                  when exists(select 1 from public.edt_phases x where x.edt_id=p.edt_id and x.statut in ('en_cours','terminee','fermee')) then 'En cours'
                  else 'Planifie' end;
 update public.suivi_des_edt set statut=v_parent,lifecycle_status=case when v_parent='Termine' then 'ferme' when v_parent='En cours' then 'actif' else 'planifie' end,updated_at=now() where id=p.edt_id;
 insert into public.operations_history(entity_type,entity_id,entity_reference,action,old_data,new_data,details,user_id)
 values('edt_lifecycle',p.edt_id::text,e.no_edt,'TRANSITION_PHASE_'||upper(p.phase_type),to_jsonb(p),to_jsonb(v_updated),v_current||' -> '||v_target,auth.uid());
 return to_jsonb(v_updated);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.creer_phase_retrait_v133(bigint,date) FROM PUBLIC,anon;

-- creer_phase_retrait_v133: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.creer_phase_retrait_v133(p_edt_id bigint, p_date_retrait date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.suivi_des_edt%rowtype;i public.edt_phases%rowtype;r public.edt_phases%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into e from public.suivi_des_edt where id=p_edt_id for update;if not found then raise exception 'edt_not_found';end if;
 select * into i from public.edt_phases where edt_id=e.id and phase_type='installation';if not found then raise exception 'installation_phase_missing';end if;
 if p_date_retrait is null then raise exception 'removal_date_required';end if;
 if p_date_retrait<i.date_debut_prevue then raise exception 'removal_before_installation';end if;
 insert into public.edt_phases(edt_id,nom,ordre,phase_type,statut,date_debut_prevue,progression) values(e.id,e.no_edt||' Retrait',2,'retrait','planifie',p_date_retrait,0) returning * into r;
 insert into public.edt_supports(edt_id,phase_id,support_id,statut,priorite,assigne_a,date_cible,progression,bloque,motif_blocage)
 select e.id,r.id,s.support_id,'Planifie',s.priorite,s.assigne_a,p_date_retrait,0,false,null from public.edt_supports s where s.edt_id=e.id and s.phase_id=i.id on conflict do nothing;
 return to_jsonb(r);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.convertir_phase_en_bt_v133(bigint) FROM PUBLIC,anon;

-- convertir_phase_en_bt_v133: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.convertir_phase_en_bt_v133(p_phase_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;b public.bons_de_travail%rowtype;v_type text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into p from public.edt_phases where id=p_phase_id for update;if not found or p.phase_type not in ('installation','retrait') then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;
 select * into b from public.bons_de_travail where phase_id=p.id and phase_conversion_v133;if found then return jsonb_build_object('created',false,'work_order',to_jsonb(b));end if;
 v_type:=case p.phase_type when 'installation' then 'Installation' else 'Retrait' end;
 insert into public.bons_de_travail(no_bt,type_bt,no_edt,edt_id,phase_id,phase_conversion_v133,priorite,statut,date_cible,client,description,updated_at)
 values('BT-'||e.no_edt||'-'||upper(left(p.phase_type,3)),v_type,e.no_edt,e.id,p.id,true,e.priorite,'A faire',p.date_debut_prevue,e.client,e.description,now()) returning * into b;
 update public.edt_supports set bon_de_travail_id=b.id,updated_at=now() where phase_id=p.id;
 return jsonb_build_object('created',true,'work_order',to_jsonb(b),'support_count',(select count(*) from public.edt_supports where phase_id=p.id));
exception when unique_violation then select * into b from public.bons_de_travail where phase_id=p_phase_id and phase_conversion_v133;return jsonb_build_object('created',false,'work_order',to_jsonb(b));
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.creer_requete_client_multi_supports_v133(text,text,text,text[]) FROM PUBLIC,anon;

-- creer_requete_client_multi_supports_v133: Administrateur/Coordonnateur/Client/Client-Admin
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
   select coalesce(array_agg(distinct cs.support_id),'{}') into v_allowed from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=any(v_ids) and c.client_id=u.client_id and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id);
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
REVOKE EXECUTE ON FUNCTION public.source_rapport_phase_v133(bigint) FROM PUBLIC,anon;

-- source_rapport_phase_v133: Administrateur/Coordonnateur/Installateur/Client/Client-Admin
CREATE OR REPLACE FUNCTION public.source_rapport_phase_v133(p_phase_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select * into p from public.edt_phases where id=p_phase_id;if not found then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;select * into c from public.campagnes_maitres where id=e.campagne_id;
 if public.current_app_role() in ('Client','Client-Admin') and not public.client_can_access_campaign_v120(c.id) then raise exception 'phase_client_scope_denied' using errcode='42501';end if;
 return jsonb_build_object('phase_id',p.id,'edt_id',e.id,'no_edt',e.no_edt,'phase_type',p.phase_type,'intervention_type',case p.phase_type when 'installation' then 'Installation' else 'Retrait' end,'status',p.statut,'scheduled_date',p.date_debut_prevue,'supports',(select coalesce(jsonb_agg(jsonb_build_object('assignment_id',s.id,'support_id',s.support_id,'status',s.statut) order by s.support_id),'[]') from public.edt_supports s where s.phase_id=p.id AND public.tos_table_resource_scope(NULL,s.support_id,NULL,s.edt_id,false)),'reports',(select coalesce(jsonb_agg(to_jsonb(r) order by r.version desc),'[]') from public.edt_phase_reports r where r.phase_id=p.id AND (public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur') OR (r.client_visible AND NOT coalesce(r.archived,false)))));
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.edt_deletion_impact_v133(bigint) FROM PUBLIC,anon;

-- edt_deletion_impact_v133: Administrateur
CREATE OR REPLACE FUNCTION public.edt_deletion_impact_v133(p_edt_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.suivi_des_edt%rowtype;v_phases bigint;v_supports bigint;v_bt bigint;v_reports bigint;v_emails bigint;v_history bigint;v_completed bigint;v_visuals bigint;v_decision text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'permission_denied' using errcode='42501';end if;
 select * into e from public.suivi_des_edt where id=p_edt_id;if not found then raise exception 'edt_not_found';end if;
 select count(*) into v_phases from public.edt_phases where edt_id=e.id;
 select count(*) into v_supports from public.edt_supports where edt_id=e.id;
 select count(*) into v_bt from public.bons_de_travail where edt_id=e.id or no_edt=e.no_edt;
 select (select count(*) from public.edt_reports where edt_id=e.id)+(select count(*) from public.edt_phase_reports where edt_id=e.id) into v_reports;
 select (select count(*) from public.email_outbox where edt_id=e.id)+(select count(*) from public.email_delivery_log where edt_id=e.id) into v_emails;
 select (select count(*) from public.operations_history where entity_id=e.id::text or entity_reference=e.no_edt)+(select count(*) from public.activity_events where edt_id=e.id::text or (entity_type='suivi_des_edt' and entity_id=e.id::text)) into v_history;
 select count(*) into v_completed from public.edt_phases where edt_id=e.id and (closed_at is not null or progression>=100 or lower(statut) like 'termin%' or lower(statut) like 'ferm%');
 select count(*) into v_visuals from public.campagne_visuels_formats where edt_phase_id in(select id from public.edt_phases where edt_id=e.id);
 v_decision:=case when v_bt+v_reports+v_emails+v_history+v_completed=0 then 'deleted' else 'archived' end;
 return jsonb_build_object('edt_id',e.id,'no_edt',e.no_edt,'client',e.client,'campagne',e.campagne,'phase_count',v_phases,'support_count',v_supports,'work_order_count',v_bt,'report_count',v_reports,'email_count',v_emails,'history_count',v_history,'completed_phase_count',v_completed,'visual_count',v_visuals,'decision',v_decision);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.delete_or_archive_edt_v133(bigint) FROM PUBLIC,anon;

-- delete_or_archive_edt_v133: Administrateur
CREATE OR REPLACE FUNCTION public.delete_or_archive_edt_v133(p_edt_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.suivi_des_edt%rowtype;impact jsonb;v_result text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'permission_denied' using errcode='42501';end if;
 select * into e from public.suivi_des_edt where id=p_edt_id for update;if not found then raise exception 'edt_not_found';end if;
 if e.archived_at is not null then return jsonb_build_object('result','archived','message','Cet EDT est deja archive.');end if;
 impact:=public.edt_deletion_impact_v133(e.id);v_result:=impact->>'decision';
 if v_result='deleted' then
   update public.campagne_visuels_formats set edt_phase_id=null where edt_phase_id in(select id from public.edt_phases where edt_id=e.id);
   delete from public.edt_supports where edt_id=e.id;
   delete from public.edt_assignments where edt_id=e.id;
   delete from public.edt_phases where edt_id=e.id;
   delete from public.suivi_des_edt where id=e.id;
   return jsonb_build_object('result','deleted','message','EDT supprime definitivement.','impact',impact);
 end if;
 update public.suivi_des_edt set archived_at=now(),archived_by=auth.uid(),archive_reason='Suppression demandee; historique operationnel preserve',statut='Annule',lifecycle_status='annule',updated_at=now() where id=e.id;
 insert into public.operations_history(entity_type,entity_id,entity_reference,action,old_data,new_data,details,user_id)
 values('suivi_des_edt',e.id::text,e.no_edt,'ARCHIVAGE_EDT',to_jsonb(e),(select to_jsonb(x) from public.suivi_des_edt x where x.id=e.id),'Suppression logique V1.3.3: historique protege.',auth.uid());
 return jsonb_build_object('result','archived','message','EDT archive; rapports et operations preserves.','impact',impact);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text) FROM PUBLIC,anon;

-- finaliser_installation_terrain_v01210: Administrateur/Coordonnateur/Installateur
CREATE OR REPLACE FUNCTION public.finaliser_installation_terrain_v01210(p_support_id text, p_visuel_id bigint, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_commentaires text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user public.utilisateurs%rowtype;v_phase_id bigint;v_campaign_id bigint;v_email text;v_support_format text;v_visual_format text;v_out_of_frame boolean;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visuel_id AND public.tos_table_resource_scope(sec_visual.client_id,p_support_id,sec_visual.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 select cv.edt_phase_id,cv.campagne_id,cv.format_support,cv.is_out_of_frame into v_phase_id,v_campaign_id,v_visual_format,v_out_of_frame from public.campagne_visuels_formats cv join public.campagnes_maitres c on c.id=cv.campagne_id where cv.id=p_visuel_id and cv.actif and c.publiee_terrain and lower(coalesce(c.statut,''))='active';
 if not found then raise exception 'visual_campaign_denied' using errcode='42501';end if;
 if v_phase_id is null or not exists(select 1 from public.edt_supports es join public.edt_phases ep on ep.id=es.phase_id join public.suivi_des_edt e on e.id=ep.edt_id where es.support_id=p_support_id and es.phase_id=v_phase_id and es.edt_id=ep.edt_id and e.campagne_id=v_campaign_id and ep.phase_type='installation' and e.archived_at is null) then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 select coalesce(i.format_affichage,i.type_support) into v_support_format from public.infrastructures i where i.support_id=p_support_id;
 if not found then raise exception 'support_not_found';end if;
 if not coalesce(v_out_of_frame,false) and public.tdm_normalize_display_format(v_support_format) is distinct from public.tdm_normalize_display_format(v_visual_format) then raise exception 'visual_format_mismatch' using errcode='23514';end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 return public.finaliser_installation_terrain_v01273(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_commentaires,p_idempotency_key);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.finaliser_intervention_terrain_v1342(text,bigint,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;

-- finaliser_intervention_terrain_v1342: Administrateur/Coordonnateur/Installateur
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
 if lower(trim(p_action))='enjeu' and p_edt_phase_id is null then raise exception 'issue_phase_required' using errcode='23502';end if;
 if p_edt_phase_id is not null then
   select ep.id phase_id,ep.edt_id,ep.phase_type,e.campagne_id into v_context
   from public.edt_phases ep join public.edt_supports es on es.phase_id=ep.id and es.edt_id=ep.edt_id join public.suivi_des_edt e on e.id=ep.edt_id
   where ep.id=p_edt_phase_id and es.support_id=p_support_id and e.archived_at is null;
   if not found then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 v_result:=public.finaliser_intervention_terrain_v01273(p_support_id,p_action,p_type_enjeu,p_commentaires,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_idempotency_key);
 if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result;end if;
 if lower(trim(p_action))='enjeu' then
   v_issue_id:=nullif(v_result->>'enjeu_id','')::bigint;
   update public.enjeux_terrain set edt_phase_id=p_edt_phase_id where id=v_issue_id and support_id=p_support_id;
   if not found then raise exception 'issue_context_not_persisted';end if;
 end if;
 return v_result||jsonb_build_object('edt_phase_id',p_edt_phase_id,'edt_id',case when p_edt_phase_id is null then null else v_context.edt_id end,'phase_type',case when p_edt_phase_id is null then null else v_context.phase_type end);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.lister_contextes_terrain_v1342(text) FROM PUBLIC,anon;

-- lister_contextes_terrain_v1342: Administrateur/Coordonnateur/Installateur
CREATE OR REPLACE FUNCTION public.lister_contextes_terrain_v1342(p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user public.utilisateurs%rowtype;v_result jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('phase_id',p.id,'phase_name',p.nom,'phase_type',p.phase_type,'phase_status',p.statut,'edt_id',e.id,'edt_number',e.no_edt,'campaign_id',e.campagne_id) order by e.id,p.ordre),'[]'::jsonb)
 into v_result
 from public.edt_supports es join public.edt_phases p on p.id=es.phase_id join public.suivi_des_edt e on e.id=p.edt_id
 where es.support_id=p_support_id and es.edt_id=p.edt_id and e.archived_at is null;
 return v_result;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.request_terrain_sync_retry_v113(uuid) FROM PUBLIC,anon;

-- request_terrain_sync_retry_v113: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.request_terrain_sync_retry_v113(p_id uuid)
 RETURNS public.terrain_sync_diagnostics
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare original public.terrain_sync_diagnostics;result public.terrain_sync_diagnostics;v_email text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.terrain_sync_diagnostics sec_diag WHERE sec_diag.id=p_id AND public.tos_table_resource_scope(NULL,sec_diag.support_id,sec_diag.campagne_id,sec_diag.edt_id,true))) IS NOT TRUE THEN RAISE EXCEPTION 'diagnostic_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into original from public.terrain_sync_diagnostics where id=p_id;if not found then raise exception 'diagnostic_not_found';end if;
 select email into v_email from auth.users where id=auth.uid();
 insert into public.terrain_sync_diagnostics(reference,support_id,visuel_id,utilisateur,etape,statut,details,device_id,operation,campagne_id,edt_id,attempt,last_attempt_at,source) values(original.reference,original.support_id,original.visuel_id,v_email,'Nouvelle tentative demandÃ©e','pending',jsonb_build_object('retry_of',original.id),original.device_id,original.operation,original.campagne_id,original.edt_id,original.attempt+1,now(),'manual_retry_request') returning * into result;
 return result;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.inherit_campaign_client_v1364() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.inherit_edt_client_v1364() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_client_v135(jsonb) FROM PUBLIC,anon;

-- admin_create_client_v135: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.admin_create_client_v135(p_payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v bigint;n text:=btrim(p_payload->>'nom_client');s text:=coalesce(nullif(btrim(p_payload->>'statut'),''),'Actif');BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN
 if auth.uid()is null or public.current_app_role()<>'Administrateur'then raise exception 'client_admin_write_denied'using errcode='42501';end if;if n is null or length(n)<2 or s not in('Actif','Désactivé')then raise exception 'invalid_client';end if;insert into public.clients(nom_client,type_client,statut,notes,courriels_rapport,courriels_cc,logo_url,couleur_rapport,mention_legale)values(n,nullif(btrim(p_payload->>'type_client'),''),s,nullif(btrim(p_payload->>'notes'),''),nullif(btrim(p_payload->>'courriels_rapport'),''),nullif(btrim(p_payload->>'courriels_cc'),''),nullif(btrim(p_payload->>'logo_url'),''),nullif(btrim(p_payload->>'couleur_rapport'),''),nullif(btrim(p_payload->>'mention_legale'),''))returning id into v;return v;END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.current_user_visible_views_v136() FROM PUBLIC,anon;

-- current_user_visible_views_v136: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.current_user_visible_views_v136()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_role text;v_client bigint;v_tables text[];
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 if v_uid is null then raise exception 'authentication_required' using errcode='42501';end if;
 select u.role,u.client_id into v_role,v_client from public.utilisateurs u where u.auth_user_id=v_uid and u.statut='Actif' limit 1;
 if v_role not in('Client','Client-Admin')or v_client is null then raise exception 'client_scope_denied' using errcode='42501';end if;
 select p.visible_tables into v_tables from public.role_ui_permissions p where p.role=v_role;
 return jsonb_build_object('role',v_role,'client_id',v_client,'visible_tables',coalesce(v_tables,'{}'::text[]));
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_client_access_overview_v135() FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_client_v135(bigint,jsonb) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.admin_link_user_to_client_v136(bigint,bigint,text) FROM PUBLIC,anon;

-- admin_link_user_to_client_v136: Administrateur
CREATE OR REPLACE FUNCTION public.admin_link_user_to_client_v136(p_user_id bigint, p_client_id bigint, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.utilisateurs%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(p_client_id,NULL,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'client_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,true))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;
IF (p_role IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'target_role_invalid' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id for update;if not found then raise exception 'user_not_found';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 if u.role not in('Client','Client-Admin')and u.client_id is not null then raise exception 'internal_role_link_denied'using errcode='42501';end if;
 if u.client_id is not null and u.client_id<>p_client_id then raise exception 'user_already_linked_use_transfer'using errcode='23514';end if;
 update public.utilisateurs set client_id=p_client_id,role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136(case when u.client_id=p_client_id then'CLIENT_USER_ROLE_CHANGED'else'USER_LINKED_TO_CLIENT'end,p_user_id,u.client_id,p_client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',p_client_id,'role',p_role,'auth_user_id',u.auth_user_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_unlink_user_from_client_v136(bigint) FROM PUBLIC,anon;

-- admin_unlink_user_from_client_v136: Administrateur
CREATE OR REPLACE FUNCTION public.admin_unlink_user_from_client_v136(p_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.utilisateurs%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,true))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 select*into u from public.utilisateurs where id=p_user_id and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 delete from public.client_campaign_access where user_id=u.auth_user_id;
 update public.utilisateurs set client_id=null,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('USER_UNLINKED_FROM_CLIENT',p_user_id,u.client_id,null,u.role,u.role);
 return jsonb_build_object('id',p_user_id,'client_id',null,'role',u.role,'auth_user_id',u.auth_user_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_transfer_user_client_v136(bigint,bigint,text) FROM PUBLIC,anon;

-- admin_transfer_user_client_v136: Administrateur
CREATE OR REPLACE FUNCTION public.admin_transfer_user_client_v136(p_user_id bigint, p_client_id bigint, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.utilisateurs%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(p_client_id,NULL,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'client_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,true))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;
IF (p_role IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'target_role_invalid' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 if u.client_id is null or u.client_id=p_client_id then raise exception 'transfer_requires_distinct_source_and_target';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 delete from public.client_campaign_access where user_id=u.auth_user_id;
 update public.utilisateurs set client_id=p_client_id,role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('USER_TRANSFERRED_CLIENT',p_user_id,u.client_id,p_client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',p_client_id,'role',p_role,'auth_user_id',u.auth_user_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_change_client_user_role_v136(bigint,text) FROM PUBLIC,anon;

-- admin_change_client_user_role_v136: Administrateur
CREATE OR REPLACE FUNCTION public.admin_change_client_user_role_v136(p_user_id bigint, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u public.utilisateurs%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,true))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;
IF (p_role IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'target_role_invalid' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id and client_id is not null and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 update public.utilisateurs set role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('CLIENT_USER_ROLE_CHANGED',p_user_id,u.client_id,u.client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',u.client_id,'role',p_role,'auth_user_id',u.auth_user_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_client_access_detail_v135(bigint) FROM PUBLIC,anon;

-- admin_client_access_detail_v135: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.admin_client_access_detail_v135(p_client_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(p_client_id,NULL,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'client_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role in('Administrateur','Coordonnateur'))then raise exception 'client_admin_read_denied'using errcode='42501';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 select jsonb_build_object(
 'organisation',(select to_jsonb(c)from public.clients c where c.id=p_client_id),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'nom',u.nom,'courriel',u.courriel,'role',u.role,'statut',u.statut,'auth_user_id',u.auth_user_id,'client_id',u.client_id,'client_name',c.nom_client,'derniere_activite_le',u.derniere_activite_le,'visible_views',coalesce(p.visible_tables,'{}'::text[])))from public.utilisateurs u join public.clients c on c.id=u.client_id left join public.role_ui_permissions p on p.role=u.role where u.client_id=p_client_id and u.role in('Client','Client-Admin')),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i))from public.client_member_invitations i where i.client_id=p_client_id),'[]'::jsonb),
 'campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'nom_campagne',c.nom_campagne,'access_mode','Module 17'))from public.campagnes_maitres c where c.client_id=p_client_id and c.client_published),'[]'::jsonb))into v;
 return v;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_portal_list_v1361(text,integer,integer,jsonb) FROM PUBLIC,anon;

-- client_portal_list_v1361: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.client_portal_list_v1361(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select u.client_id,u.role into v_client,v_role from public.utilisateurs u where u.auth_user_id=v_uid and u.statut='Actif' and u.role in('Client','Client-Admin') limit 1;
  if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
  if p_section not in ('poster_directory','information_centers','information_centers_issues','stops','vehicles_trains') then raise exception 'invalid_section'; end if;
  v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));
  v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section='poster_directory' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct c.id campaign_id,c.nom_campagne,c.business_context,cs.support_id,cs.visuel_attendu visual,cs.statut,cs.no_edt
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id)
      order by c.nom_campagne,cs.support_id limit v_limit offset v_offset) q;
  elsif p_section='information_centers' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select i.site,i.type_site,count(*) nombre_de_cadres,max(i.date_derniere_manipulation) derniere_intervention
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and coalesce(i.site,'')<>''
      group by i.site,i.type_site
      order by i.site limit v_limit offset v_offset) q;
  elsif p_section='information_centers_issues' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.site,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at
      from public.enjeux_terrain e join public.infrastructures i on i.support_id=e.support_id
      where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id))
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='stops' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.support_id no_arret,i.emplacement_visibilite,i.type_support,i.site
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%arret%' or i.type_site ilike '%arrêt%' or i.support_id ilike 'A%')
      order by i.support_id limit v_limit offset v_offset) q;
  elsif p_section='vehicles_trains' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.support_id,i.site voiture_train,i.type_support,i.emplacement_visibilite
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible and public.client_can_access_campaign_v120(c.id) and (i.type_site ilike '%voiture%' or i.type_site ilike '%train%' or i.type_support ilike '%voiture%' or i.type_support ilike '%train%')
      order by i.site,i.support_id limit v_limit offset v_offset) q;
  end if;

  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_preview_client_portal_context_v1361(bigint) FROM PUBLIC,anon;

-- admin_preview_client_portal_context_v1361: Administrateur
CREATE OR REPLACE FUNCTION public.admin_preview_client_portal_context_v1361(p_target_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_client jsonb;v_tables text[];v_sections jsonb:='{}'::jsonb;v_section text;v_role text;v_client_id bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_target_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if v_admin is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.utilisateurs a where a.auth_user_id=v_admin and a.statut='Actif' and a.role='Administrateur') then raise exception 'admin_required' using errcode='42501'; end if;
  select * into v_target from public.utilisateurs u where u.id=p_target_user_id and u.statut='Actif' and u.role in('Client','Client-Admin');
  if not found or v_target.client_id is null then raise exception 'target_client_user_not_found' using errcode='42501'; end if;
  v_role:=v_target.role;v_client_id:=v_target.client_id;
  select to_jsonb(c) into v_client from public.clients c where c.id=v_client_id;
  select p.visible_tables into v_tables from public.role_ui_permissions p where p.role=v_role;

  foreach v_section in array array['campaigns','communications','supports','poster_directory','information_centers','information_centers_issues','stops','vehicles_trains','photos','reports','edt','issues','history','members'] loop
    v_sections:=jsonb_set(v_sections,array[v_section],public.admin_preview_client_portal_section_v1361(p_target_user_id,v_section,1,10),true);
  end loop;

  return jsonb_build_object(
    'target_user',jsonb_build_object('id',v_target.id,'nom',v_target.nom,'courriel',v_target.courriel,'role',v_role,'client_id',v_client_id,'statut',v_target.statut,'visible_tables',coalesce(v_tables,'{}'::text[])),
    'client',v_client,
    'visible_tables',coalesce(v_tables,'{}'::text[]),
    'campaign_access_status','Module 17 recalculé côté serveur',
    'sections',v_sections
  );
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_preview_client_portal_section_v1361(bigint,text,integer,integer) FROM PUBLIC,anon;

-- admin_preview_client_portal_section_v1361: Administrateur
CREATE OR REPLACE FUNCTION public.admin_preview_client_portal_section_v1361(p_target_user_id bigint, p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_client bigint;v_role text;v_offset integer;v_limit integer;v_rows jsonb:='[]';v_total bigint:=0;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_target_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if v_admin is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from public.utilisateurs a where a.auth_user_id=v_admin and a.statut='Actif' and a.role='Administrateur') then raise exception 'admin_required' using errcode='42501'; end if;
  select * into v_target from public.utilisateurs u where u.id=p_target_user_id and u.statut='Actif' and u.role in('Client','Client-Admin');
  if not found or v_target.client_id is null then raise exception 'target_client_user_not_found' using errcode='42501'; end if;
  v_client:=v_target.client_id;v_role:=v_target.role;v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;

  if p_section in('campaigns','communications') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut from public.campagnes_maitres c
      where c.client_id=v_client and c.client_published and c.business_context=case when p_section='campaigns' then 'marketing' else 'operational_communication' end
      and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id and (a.user_id is null or a.user_id=v_target.auth_user_id)))
      order by c.date_fin desc nulls last,c.id desc limit v_limit offset v_offset) q;
  elsif p_section in('supports','poster_directory','information_centers','stops','vehicles_trains') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select distinct i.site,i.support_id,i.type_support,i.emplacement_visibilite,cs.statut,cs.no_edt,c.id campaign_id,c.nom_campagne,c.business_context,cs.visuel_attendu visual
      from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id join public.infrastructures i on i.support_id=cs.support_id
      where c.client_id=v_client and c.client_published and cs.client_visible
      and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id and (a.user_id is null or a.user_id=v_target.auth_user_id)))
      order by i.site,i.support_id,c.id limit v_limit offset v_offset) q;
  elsif p_section in('issues','information_centers_issues') then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at from public.enjeux_terrain e
      where e.client_visible and exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=e.support_id and c.client_id=v_client and c.client_published and cs.client_visible)
      order by e.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='photos' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select p.id,p.support_id,p.campagne_id,p.visuel_id,p.type_photo,p.nom_fichier,p.prise_le,p.statut_validation from public.support_photos p join public.campagnes_maitres c on c.id=p.campagne_id
      where c.client_id=v_client and c.client_published and p.client_visible order by p.prise_le desc,p.id desc limit v_limit offset v_offset) q;
  elsif p_section='reports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select r.id,r.numero_edt,r.campagne,r.objet,r.sent_at,r.created_at from public.communications_finales r where r.client_id=v_client and r.client_published and r.statut in('Envoyé','Publié') order by r.created_at desc limit v_limit offset v_offset) q;
  elsif p_section='edt' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset) q;
  elsif p_section='history' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_visible and a.client_id=v_client::text order by a.occurred_at desc,a.id desc limit v_limit offset v_offset) q;
  elsif p_section='members' and v_role='Client-Admin' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from (
      select u.id,u.nom,u.courriel,u.role,u.statut,u.updated_at from public.utilisateurs u where u.client_id=v_client and u.role in('Client','Client-Admin') order by u.nom,u.id limit v_limit offset v_offset) q;
  end if;

  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.require_direct_client_v1364() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_preview_client_portal_context_v1362(bigint) FROM PUBLIC,anon;

-- admin_preview_client_portal_context_v1362: Administrateur
CREATE OR REPLACE FUNCTION public.admin_preview_client_portal_context_v1362(p_target_user_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_base jsonb;v_total bigint;v_rows jsonb;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_user WHERE sec_user.id=p_target_user_id AND public.tos_table_resource_scope(sec_user.client_id,NULL,NULL,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'target_user_scope_denied' USING ERRCODE='42501';END IF;

BEGIN
 if v_admin is null or not exists(select 1 from public.utilisateurs where auth_user_id=v_admin and statut='Actif'and role='Administrateur')then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;select*into v_target from public.utilisateurs where id=p_target_user_id and statut='Actif'and role in('Client','Client-Admin');if not found or v_target.client_id is null then raise exception 'TARGET_CLIENT_USER_NOT_FOUND';end if;v_base:=public.admin_preview_client_portal_context_v1361(p_target_user_id);select count(*)into v_total from public.infrastructures where client_id=v_target.client_id;select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select support_id,site,type_site,type_support,emplacement_visibilite,client_id from public.infrastructures where client_id=v_target.client_id order by site nulls last,support_id limit 10)q;v_base:=jsonb_set(v_base,'{sections,supports}',jsonb_build_object('section','supports','page',1,'page_size',10,'total',v_total,'rows',v_rows),true);return v_base||jsonb_build_object('scope_version','v1362','diagnostic','OK','auth_uid_changed',false,'target_session_created',false);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_portal_list_v1362(text,integer,integer,jsonb) FROM PUBLIC,anon;

-- client_portal_list_v1362: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.client_portal_list_v1362(p_section text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_limit integer;v_offset integer;v_total bigint;v_rows jsonb;v_search text:=trim(coalesce(p_filters->>'search',''));
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
 if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501';end if;
 v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;
 if p_section in('supports','infrastructures')then
  select count(*)into v_total from public.infrastructures i where i.client_id=v_client and(v_search=''or concat_ws(' ',i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(
   select i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite,i.latitude,i.longitude,i.coordonnees_gps
   from public.infrastructures i where i.client_id=v_client and(v_search=''or concat_ws(' ',i.support_id,i.site,i.type_site,i.type_support,i.emplacement_visibilite)ilike'%'||v_search||'%')
   order by i.site nulls last,i.support_id limit v_limit offset v_offset)q;
 elsif p_section='campaigns'then
  select count(*)into v_total from public.campagnes_maitres c where c.client_id=v_client and c.client_published and(v_search=''or concat_ws(' ',c.nom_campagne,c.statut,c.business_context)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select c.id,c.nom_campagne,c.business_context,c.date_debut,c.date_fin,c.statut from public.campagnes_maitres c where c.client_id=v_client and c.client_published and(v_search=''or concat_ws(' ',c.nom_campagne,c.statut,c.business_context)ilike'%'||v_search||'%')order by c.date_debut desc nulls last,c.id desc limit v_limit offset v_offset)q;
 elsif p_section='photos'then
  select count(*)into v_total from public.support_photos p where p.client_id=v_client and p.client_visible and p.deleted_at is null and(v_search=''or concat_ws(' ',p.support_id,p.nom_fichier,p.type_photo,p.statut_validation)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select p.id,p.support_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.thumbnail_url,p.prise_le,p.statut_validation from public.support_photos p where p.client_id=v_client and p.client_visible and p.deleted_at is null and(v_search=''or concat_ws(' ',p.support_id,p.nom_fichier,p.type_photo,p.statut_validation)ilike'%'||v_search||'%')order by p.prise_le desc nulls last,p.id desc limit v_limit offset v_offset)q;
 elsif p_section='edt'then
  select count(*)into v_total from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and(v_search=''or concat_ws(' ',e.no_edt,e.statut)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and(v_search=''or concat_ws(' ',e.no_edt,e.statut)ilike'%'||v_search||'%')order by e.date_fin_prevue desc nulls last,e.id desc limit v_limit offset v_offset)q;
 elsif p_section='issues'then
  select count(*)into v_total from public.enjeux_terrain e where e.client_id=v_client and e.client_visible and(v_search=''or concat_ws(' ',e.support_id,e.reference,e.type_enjeu,e.description,e.statut)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select e.id,e.reference,e.support_id,e.type_enjeu,e.description,e.statut,e.priorite,e.created_at,e.resolved_at from public.enjeux_terrain e where e.client_id=v_client and e.client_visible and(v_search=''or concat_ws(' ',e.support_id,e.reference,e.type_enjeu,e.description,e.statut)ilike'%'||v_search||'%')order by e.created_at desc,e.id desc limit v_limit offset v_offset)q;
 elsif p_section='history'then
  select count(*)into v_total from public.activity_events a where a.client_id=v_client::text and a.client_visible and(v_search=''or concat_ws(' ',a.action,a.module,a.entity_type,a.support_id,a.status)ilike'%'||v_search||'%');
  select coalesce(jsonb_agg(to_jsonb(q)),'[]')into v_rows from(select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_id=v_client::text and a.client_visible and(v_search=''or concat_ws(' ',a.action,a.module,a.entity_type,a.support_id,a.status)ilike'%'||v_search||'%')order by a.occurred_at desc,a.id desc limit v_limit offset v_offset)q;
 else return public.client_portal_list_v1361(p_section,p_page,p_page_size,p_filters);end if;
 return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows,'client_id',v_client,'role',v_role);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.client_ownership_summary_v1362(text) FROM PUBLIC,anon;

-- client_ownership_summary_v1362: Administrateur
CREATE OR REPLACE FUNCTION public.client_ownership_summary_v1362(p_domain text DEFAULT NULL::text)
 RETURNS TABLE(client_id bigint, client_name text, domain text, total bigint, assigned bigint, without_client bigint, ambiguous bigint, other_client bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;

BEGIN
 if auth.uid()is null or not exists(select 1 from public.utilisateurs where auth_user_id=auth.uid()and statut='Actif'and role='Administrateur')then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;return query with d as(select i.client_id,'infrastructures'::text domain,count(*)::bigint total from public.infrastructures i group by i.client_id union all select c.client_id,'campaigns',count(*)from public.campagnes_maitres c group by c.client_id union all select p.client_id,'photos',count(*)from public.support_photos p group by p.client_id union all select e.client_id,'edt',count(*)from public.suivi_des_edt e group by e.client_id union all select p.client_id,'edt_phases',count(*)from public.edt_phases p group by p.client_id union all select e.client_id,'issues',count(*)from public.enjeux_terrain e group by e.client_id union all select r.client_id,'requests',count(*)from public.requetes_clients r group by r.client_id union all select v.client_id,'visuals',count(*)from public.campagne_visuels_formats v group by v.client_id union all select b.client_id,'work_orders',count(*)from public.bons_de_travail b group by b.client_id)select d.client_id,c.nom_client,d.domain,d.total,case when d.client_id is null then 0 else d.total end,case when d.client_id is null then d.total else 0 end,0::bigint,0::bigint from d left join public.clients c on c.id=d.client_id where (p_domain is null or d.domain=p_domain) AND public.tos_table_resource_scope(d.client_id,NULL,NULL,NULL,true);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_transfer_data_client_v1362(text,text,bigint,boolean) FROM PUBLIC,anon;

-- admin_transfer_data_client_v1362: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.admin_transfer_data_client_v1362(p_domain text, p_entity_id text, p_new_client_id bigint, p_confirmation boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v_actor uuid:=auth.uid();v_old bigint;v_changed integer;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN
 if v_actor is null or not exists(select 1 from public.utilisateurs where auth_user_id=v_actor and statut='Actif'and role='Administrateur')then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;if not coalesce(p_confirmation,false)then raise exception 'TRANSFER_CONFIRMATION_REQUIRED';end if;if not exists(select 1 from public.clients where id=p_new_client_id and statut='Actif')then raise exception 'TARGET_CLIENT_NOT_FOUND';end if;if p_domain='infrastructures'then select client_id into v_old from public.infrastructures where support_id=p_entity_id for update;update public.infrastructures set client_id=p_new_client_id where support_id=p_entity_id;get diagnostics v_changed=row_count;elsif p_domain='campaigns'then select client_id into v_old from public.campagnes_maitres where id=p_entity_id::bigint for update;update public.campagnes_maitres set client_id=p_new_client_id where id=p_entity_id::bigint;get diagnostics v_changed=row_count;update public.campagnes_supports set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;update public.campagne_visuels_formats set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;update public.support_photos set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;update public.suivi_des_edt set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;delete from public.client_campaign_access where campaign_id=p_entity_id::bigint;else raise exception 'UNSUPPORTED_TRANSFER_DOMAIN';end if;if v_changed<>1 then raise exception 'TRANSFER_ENTITY_NOT_FOUND';end if;insert into public.activity_events(occurred_at,actor_id,action,module,entity_type,entity_id,old_value,new_value,client_id,source,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence,status)values(now(),v_actor,'DATA_TRANSFERRED_CLIENT','client_ownership',p_domain,p_entity_id,jsonb_build_object('client_id',v_old),jsonb_build_object('client_id',p_new_client_id),p_new_client_id::text,'admin','admin',p_entity_id,now(),'direct','exact','success');return jsonb_build_object('ok',true,'domain',p_domain,'entity_id',p_entity_id,'old_client_id',v_old,'new_client_id',p_new_client_id);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.derive_terrain_issue_client_v138() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.client_portal_support_context_v139(text,text) FROM PUBLIC,anon;

-- client_portal_support_context_v139: Client/Client-Admin
CREATE OR REPLACE FUNCTION public.client_portal_support_context_v139(p_section text, p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();v_client bigint;v_support text:=btrim(p_support_id);v_rows jsonb:='[]';
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select client_id into v_client from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
 if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501';end if;
 if not exists(select 1 from public.infrastructures where support_id=v_support and client_id=v_client) then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;
 if p_section='photos' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select p.id,p.support_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.thumbnail_url,p.prise_le,p.statut_validation from public.support_photos p where p.support_id=v_support and p.client_id=v_client and p.client_visible and p.deleted_at is null order by p.prise_le desc nulls last,p.id desc)q;
 elsif p_section='edt' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select distinct e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.edt_supports es on es.edt_id=e.id join public.campagnes_maitres c on c.id=e.campagne_id where es.support_id=v_support and c.client_id=v_client and c.client_published and e.client_visible order by e.date_fin_prevue desc nulls last,e.id desc)q;
 elsif p_section='history' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_id=v_client::text and a.client_visible and(a.support_id=v_support or exists(select 1 from public.edt_supports es where es.edt_id::text=a.edt_id and es.support_id=v_support))order by a.occurred_at desc,a.id desc)q;
 else raise exception 'INVALID_SUPPORT_SECTION';end if;
 return jsonb_build_object('section',p_section,'page',1,'page_size',jsonb_array_length(v_rows),'total',jsonb_array_length(v_rows),'rows',v_rows,'support_id',v_support);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.tdm_automation_source_trigger_v1310() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.set_automation_status_v1310(uuid,text) FROM PUBLIC,anon;

-- set_automation_status_v1310: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.set_automation_status_v1310(p_automation_id uuid, p_status text)
 RETURNS public.automation_definitions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.automation_definitions%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_status not in ('active','inactive','paused') then raise exception 'INVALID_AUTOMATION_STATUS'; end if;
 select * into v_row from public.automation_definitions where id=p_automation_id for update;
 if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;
 if p_status='active' and (v_row.approved_by is null or v_row.approved_at is null) then
   raise exception 'AUTOMATION_APPROVAL_REQUIRED';
 end if;
 update public.automation_definitions set status=p_status,updated_by=auth.uid(),updated_at=now()
 where id=p_automation_id returning * into v_row;
 return v_row;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.set_automation_binding_status_v1310(bigint,text) FROM PUBLIC,anon;

-- set_automation_binding_status_v1310: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.set_automation_binding_status_v1310(p_binding_id bigint, p_status text)
 RETURNS public.automation_bindings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.automation_bindings%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_status not in ('active','inactive','paused') then raise exception 'INVALID_RELATION_STATUS'; end if;
 update public.automation_bindings set status=p_status,updated_at=now() where id=p_binding_id returning * into v_row;
 if not found then raise exception 'AUTOMATION_BINDING_NOT_FOUND'; end if;
 return v_row;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.set_automation_resource_status_v1310(bigint,text) FROM PUBLIC,anon;

-- set_automation_resource_status_v1310: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.set_automation_resource_status_v1310(p_resource_id bigint, p_status text)
 RETURNS public.automation_resource_states
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.automation_resource_states%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'ADMIN_REQUIRED'; end if;
 if p_status not in ('active','inactive') then raise exception 'INVALID_RESOURCE_STATUS'; end if;
 update public.automation_resource_states set status=p_status,updated_by=auth.uid(),updated_at=now()
 where id=p_resource_id returning * into v_row;
 if not found then raise exception 'AUTOMATION_RESOURCE_NOT_FOUND'; end if;
 return v_row;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.test_automation_definition_v1310(uuid,jsonb) FROM PUBLIC,anon;

-- test_automation_definition_v1310: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.test_automation_definition_v1310(p_automation_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.automation_definitions%rowtype; v_bindings jsonb; v_result jsonb;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

 if auth.uid() is null or public.current_app_role()<>'Administrateur' then raise exception 'ADMIN_REQUIRED'; end if;
 select * into a from public.automation_definitions where id=p_automation_id;
 if not found then raise exception 'AUTOMATION_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('binding_id',b.id,'trigger',b.trigger_type,'source',b.source_table,
  'destination',b.target_resource_key,'relation_status',b.status,'would_execute',a.status='active' and b.status='active' and r.status='active')),'[]')
 into v_bindings from public.automation_bindings b left join public.automation_resource_states r
  on r.resource_type='module' and r.resource_key=b.target_resource_key and r.client_id is null
 where b.automation_definition_id=p_automation_id;
 v_result:=jsonb_build_object('dry_run',true,'automation_status',a.status,'bindings',v_bindings,'business_changes',0);
 insert into public.relation_test_logs(automation_definition_id,status,message,details,initiated_by,payload,result)
 values(p_automation_id,'Réussi','Simulation sans effet métier permanent.',v_result,auth.uid(),p_payload,v_result);
 return v_result;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.approve_automation_definition_v0131(uuid) FROM PUBLIC,anon;

-- approve_automation_definition_v0131: Administrateur (global internal scope)
CREATE OR REPLACE FUNCTION public.approve_automation_definition_v0131(p_automation_id uuid)
 RETURNS public.automation_definitions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_definition public.automation_definitions%rowtype;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) IS NOT TRUE THEN RAISE EXCEPTION 'global_internal_scope_required' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() <> 'Administrateur' then
    raise exception 'Permission administrateur requise.';
  end if;

  select * into v_definition
    from public.automation_definitions
   where id = p_automation_id
   for update;
  if not found then raise exception 'Automatisation introuvable.'; end if;

  if jsonb_typeof(v_definition.definition->'triggers') <> 'array'
     or jsonb_array_length(v_definition.definition->'triggers') = 0 then
    raise exception 'Au moins un déclencheur est requis.';
  end if;
  if jsonb_typeof(v_definition.definition->'targets') <> 'array'
     or jsonb_array_length(v_definition.definition->'targets') = 0 then
    raise exception 'Au moins un module cible est requis.';
  end if;

  update public.automation_definitions
     set status = 'active',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_automation_id
   returning * into v_definition;

  return v_definition;
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.finalize_photo_review_assignment(bigint,text) FROM PUBLIC,anon;

-- finalize_photo_review_assignment: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.finalize_photo_review_assignment(p_photo_id bigint, p_expected_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.support_photos%rowtype;actor uuid:=auth.uid();actor_role text;actor_client bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.support_photos sec_photo WHERE sec_photo.id=p_photo_id AND (public.tos_table_resource_scope(sec_photo.client_id,sec_photo.support_id,sec_photo.campagne_id,NULL,false) OR (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true) AND sec_photo.client_id IS NULL AND sec_photo.support_id IS NULL)) AND (sec_photo.target_client_id IS NULL OR public.tos_table_resource_scope(sec_photo.target_client_id,sec_photo.target_support_id,NULL,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'photo_review_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select u.role,u.client_id into actor_role,actor_client from public.utilisateurs u where u.auth_user_id=actor and u.statut='Actif' limit 1;
 if actor is null or actor_role not in('Administrateur','Coordonnateur') then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;
 select * into p from public.support_photos where id=p_photo_id for update;if not found or not p.assignment_pending or p.target_storage_path is distinct from p_expected_path then raise exception 'PHOTO_ASSIGNMENT_STATE_MISMATCH';end if;
 if actor_role='Coordonnateur' and actor_client is not null and (p.target_client_id<>actor_client or (p.client_id is not null and p.client_id<>actor_client)) then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;
 insert into public.photo_review_audit(photo_id,actor_id,action,original_filename,ocr_text,ocr_confidence,proposed_support_id,previous_support_id,final_support_id,old_filename,new_filename,old_storage_path,new_storage_path,client_id)values(p.id,actor,case when p.review_status='manually_validated'then'corrected'else'manually_validated'end,p.original_filename,p.ocr_text,p.ocr_confidence,p.proposed_support_id,p.support_id,p.target_support_id,p.nom_fichier,p.target_filename,p.storage_path,p.target_storage_path,p.target_client_id);
 update public.support_photos set support_id=target_support_id,client_id=target_client_id,storage_path=target_storage_path,normalized_filename=target_filename,nom_fichier=target_filename,review_status='manually_validated',statut_validation='ValidÃ©e manuellement',validee_le=now(),uploaded_by=coalesce(uploaded_by,actor::text),assignment_pending=false,target_storage_path=null,target_filename=null,target_support_id=null,target_client_id=null where id=p.id;
 return jsonb_build_object('ok',true,'photo_id',p.id,'old_filename',p.nom_fichier,'new_filename',p.target_filename,'support_id',p.target_support_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.cancel_photo_review_assignment(bigint) FROM PUBLIC,anon;

-- cancel_photo_review_assignment: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.cancel_photo_review_assignment(p_photo_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare p public.support_photos%rowtype;actor uuid:=auth.uid();actor_role text;actor_client bigint;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.support_photos sec_photo WHERE sec_photo.id=p_photo_id AND (public.tos_table_resource_scope(sec_photo.client_id,sec_photo.support_id,sec_photo.campagne_id,NULL,false) OR (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true) AND sec_photo.client_id IS NULL AND sec_photo.support_id IS NULL)) AND (sec_photo.target_client_id IS NULL OR public.tos_table_resource_scope(sec_photo.target_client_id,sec_photo.target_support_id,NULL,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'photo_review_scope_denied' USING ERRCODE='42501';END IF;

BEGIN
 select u.role,u.client_id into actor_role,actor_client from public.utilisateurs u where u.auth_user_id=actor and u.statut='Actif' limit 1;if actor is null or actor_role not in('Administrateur','Coordonnateur')then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;select*into p from public.support_photos where id=p_photo_id for update;if not found then raise exception 'PHOTO_NOT_FOUND';end if;if actor_role='Coordonnateur' and actor_client is not null and coalesce(p.target_client_id,p.client_id) is distinct from actor_client then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;update public.support_photos set assignment_pending=false,target_storage_path=null,target_filename=null,target_support_id=null,target_client_id=null where id=p.id;END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.ignore_photo_review_item(bigint) FROM PUBLIC,anon;

-- ignore_photo_review_item: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.ignore_photo_review_item(p_photo_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare p public.support_photos%rowtype;actor uuid:=auth.uid();actor_role text;actor_client bigint;BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.support_photos sec_photo WHERE sec_photo.id=p_photo_id AND (public.tos_table_resource_scope(sec_photo.client_id,sec_photo.support_id,sec_photo.campagne_id,NULL,false) OR (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true) AND sec_photo.client_id IS NULL AND sec_photo.support_id IS NULL)) AND (sec_photo.target_client_id IS NULL OR public.tos_table_resource_scope(sec_photo.target_client_id,sec_photo.target_support_id,NULL,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'photo_review_scope_denied' USING ERRCODE='42501';END IF;

BEGIN
 select u.role,u.client_id into actor_role,actor_client from public.utilisateurs u where u.auth_user_id=actor and u.statut='Actif' limit 1;if actor is null or actor_role not in('Administrateur','Coordonnateur')then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;select*into p from public.support_photos where id=p_photo_id for update;if not found or p.review_status not in('needs_review','unmatched')then raise exception 'PHOTO_NOT_REVIEWABLE';end if;if actor_role='Coordonnateur' and actor_client is not null and p.client_id is distinct from actor_client then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;update public.support_photos set review_status='ignored',statut_validation='IgnorÃ©e',validee_le=now()where id=p.id;insert into public.photo_review_audit(photo_id,actor_id,action,original_filename,ocr_text,ocr_confidence,proposed_support_id,previous_support_id,old_filename,old_storage_path,client_id)values(p.id,actor,'ignored',p.original_filename,p.ocr_text,p.ocr_confidence,p.proposed_support_id,p.support_id,p.nom_fichier,p.storage_path,p.client_id);return jsonb_build_object('ok',true,'photo_id',p.id);END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.prepare_photo_review_assignment(bigint,text) FROM PUBLIC,anon;

-- prepare_photo_review_assignment: Administrateur/Coordonnateur
CREATE OR REPLACE FUNCTION public.prepare_photo_review_assignment(p_photo_id bigint, p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 p public.support_photos%rowtype;
 i public.infrastructures%rowtype;
 seq integer;
 ext text;
 ymd text;
 canonical_support text;
 canonical_prefix text;
 family_key text;
 name text;
 path text;
 actor uuid:=auth.uid();
 actor_role text;
 actor_client bigint;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,NULL,false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.support_photos sec_photo WHERE sec_photo.id=p_photo_id AND (public.tos_table_resource_scope(sec_photo.client_id,sec_photo.support_id,sec_photo.campagne_id,NULL,false) OR (public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true) AND sec_photo.client_id IS NULL AND sec_photo.support_id IS NULL)) AND (sec_photo.target_client_id IS NULL OR public.tos_table_resource_scope(sec_photo.target_client_id,sec_photo.target_support_id,NULL,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'photo_review_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select u.role,u.client_id into actor_role,actor_client
 from public.utilisateurs u
 where u.auth_user_id=actor and u.statut='Actif'
 limit 1;
 if actor is null or actor_role not in('Administrateur','Coordonnateur') then
  raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';
 end if;

 select * into p from public.support_photos where id=p_photo_id for update;
 if not found then raise exception 'PHOTO_NOT_FOUND';end if;
 if p.review_status not in('needs_review','unmatched','manually_validated') or p.assignment_pending then
  raise exception 'PHOTO_NOT_REVIEWABLE';
 end if;

 select * into i from public.infrastructures where support_id=trim(p_support_id);
 if not found or i.client_id is null then raise exception 'SUPPORT_NOT_FOUND_OR_UNOWNED';end if;
 if actor_role='Coordonnateur' and actor_client is not null and (i.client_id<>actor_client or (p.client_id is not null and p.client_id<>actor_client)) then
  raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';
 end if;

 ymd:=to_char(coalesce(p.captured_at,p.prise_le,p.uploaded_at,p.created_at,now()) at time zone 'America/Toronto','YYYYMMDD');
 ext:=lower(coalesce(nullif(substring(coalesce(p.original_filename,p.nom_fichier) from '\.([A-Za-z0-9]{2,5})$'),''),'jpg'));
 if ext='jpeg'then ext:='jpg';end if;
 canonical_support:=regexp_replace(upper(i.support_id),'[^A-Z0-9_-]+','-','g');
 canonical_prefix:=canonical_support||'-'||ymd||'-INSPECTION-NONE-NONE';
 family_key:=canonical_support||'|'||ymd||'|INSPECTION|NONE|NONE';

 perform pg_advisory_xact_lock(hashtextextended(family_key,0));
 select coalesce(max(substring(candidate_filename from '-([0-9]+)\.[A-Za-z0-9]+$')::integer),0)+1
 into seq
 from (
  select coalesce(s.normalized_filename,s.nom_fichier) candidate_filename
  from public.support_photos s
  where s.support_id=i.support_id
    and coalesce(s.captured_at,s.prise_le)::date=coalesce(p.captured_at,p.prise_le,now())::date
  union all
  select s.target_filename
  from public.support_photos s
  where s.assignment_pending and s.target_support_id=i.support_id
    and coalesce(s.captured_at,s.prise_le)::date=coalesce(p.captured_at,p.prise_le,now())::date
 ) reserved
 where candidate_filename like canonical_prefix||'-%';

 name:=canonical_prefix||'-'||lpad(seq::text,3,'0')||'.'||ext;
 path:='supports/'||canonical_support||'/'||left(ymd,4)||'/NONE/INSPECTION/'||name;
 update public.support_photos
 set assignment_pending=true,target_storage_path=path,target_filename=name,target_support_id=i.support_id,target_client_id=i.client_id
 where id=p.id;
 return jsonb_build_object('photo_id',p.id,'storage_path',path,'filename',name,'support_id',i.support_id);
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.finaliser_installation_terrain_v1331(text,bigint,bigint,text,text,text,text,text,text) FROM PUBLIC,anon;

-- finaliser_installation_terrain_v1331: Administrateur/Coordonnateur/Installateur
CREATE OR REPLACE FUNCTION public.finaliser_installation_terrain_v1331(p_support_id text, p_edt_phase_id bigint, p_visuel_id bigint, p_nom_fichier text, p_storage_path text, p_photo_url text, p_utilisateur text DEFAULT NULL::text, p_commentaires text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user public.utilisateurs%rowtype;
  v_ref text:=coalesce(nullif(trim(p_idempotency_key),''),'INSTALL-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||regexp_replace(p_support_id,'[^A-Za-z0-9]','','g'));
  v_op uuid;v_visual public.campagne_visuels_formats%rowtype;v_campaign public.campagnes_maitres%rowtype;
  v_infra public.infrastructures%rowtype;v_photo public.support_photos%rowtype;v_edt public.suivi_des_edt%rowtype;v_email text;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.campagne_visuels_formats sec_visual WHERE sec_visual.id=p_visuel_id AND public.tos_table_resource_scope(sec_visual.client_id,p_support_id,sec_visual.campagne_id,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false))) IS NOT TRUE THEN RAISE EXCEPTION 'visual_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

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
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.lister_visuels_installation_terrain_v1331(text,bigint) FROM PUBLIC,anon;

-- lister_visuels_installation_terrain_v1331: Administrateur/Coordonnateur/Installateur
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
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_edt_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;
IF (public.tos_table_resource_scope(NULL,p_support_id,NULL,(SELECT sec_phase.edt_id FROM public.edt_phases sec_phase WHERE sec_phase.id=p_edt_phase_id),false)) IS NOT TRUE THEN RAISE EXCEPTION 'support_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

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
END;
END;
$function$
;
REVOKE EXECUTE ON FUNCTION public.appliquer_campagne_support(text,bigint,text,text,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.retirer_support_edt_v0129(bigint,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.tos_table_resource_scope(bigint,text,bigint,bigint,boolean) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.tos_legacy_work_order_scope(bigint,bigint,text,bigint) FROM PUBLIC,anon;
