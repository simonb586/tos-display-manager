-- Canonical authorization; preserve signatures, calculations and output projections.
CREATE OR REPLACE FUNCTION public.tableau_bord_edt_v0129(p_edt_id bigint DEFAULT NULL::bigint)
 RETURNS TABLE(edt_id bigint, no_edt text, nom text, statut text, date_fin_prevue date, total integer, planifies integer, en_cours integer, bloques integer, termines integer, progression integer, en_retard boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
IF auth.uid() IS NULL OR (public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'rpc_role_denied' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif' AND u.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=u.client_id)) THEN RAISE EXCEPTION 'rpc_actor_client_invalid' USING ERRCODE='42501'; END IF;
IF p_edt_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suivi_des_edt e WHERE e.id=p_edt_id AND public.tos_table_resource_scope(e.client_id,NULL,e.campagne_id,NULL,false)) THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
RETURN QUERY
select e.id, e.no_edt::text, e.nom::text, e.statut::text,
         public.tdm_try_date(e.date_fin_prevue::text),
         coalesce(e.supports_prevus,0)::integer, coalesce(e.supports_planifies,0)::integer,
         coalesce(e.supports_en_cours,0)::integer, coalesce(e.supports_bloques,0)::integer,
         coalesce(e.supports_termines,0)::integer, coalesce(e.progression,0)::integer,
         (public.tdm_try_date(e.date_fin_prevue::text) < current_date and coalesce(e.progression,0) < 100)
  from public.suivi_des_edt e
  where (p_edt_id is null or e.id = p_edt_id) AND public.tos_table_resource_scope(e.client_id,NULL,e.campagne_id,NULL,false)
  order by public.tdm_try_date(e.date_fin_prevue::text) nulls last, e.id desc;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.tableau_bord_edt_v0129(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tableau_bord_edt_v0129(bigint) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.refresh_edt_progress(p_edt_id bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  computed integer;
  installed integer;
BEGIN
IF auth.uid() IS NULL OR (public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur')) IS NOT TRUE THEN RAISE EXCEPTION 'rpc_role_denied' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif' AND u.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=u.client_id)) THEN RAISE EXCEPTION 'rpc_actor_client_invalid' USING ERRCODE='42501'; END IF;
PERFORM 1 FROM public.suivi_des_edt e WHERE e.id=p_edt_id AND public.tos_table_resource_scope(e.client_id,NULL,e.campagne_id,NULL,false) FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF EXISTS(SELECT 1 FROM public.bons_de_travail b WHERE b.edt_id=p_edt_id AND public.tos_table_resource_scope(b.client_id,b.support_id,NULL,b.edt_id,false) IS NOT TRUE) THEN RAISE EXCEPTION 'work_order_scope_inconsistent' USING ERRCODE='42501';END IF;
select coalesce(round(avg(
    case
      when statut = 'Terminée' then 100
      else coalesce(progression, 0)
    end
  )), 0)::integer,
  count(*) filter (where statut = 'Terminée')
  into computed, installed
  from public.bons_de_travail
  where edt_id = p_edt_id;

  update public.suivi_des_edt
  set
    progression = computed,
    supports_installes = installed,
    updated_at = now()
  where id = p_edt_id;

  return computed;
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.refresh_edt_progress(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.refresh_edt_progress(bigint) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_client_access_overview_v135()
 RETURNS TABLE(client_id bigint, nom_client text, type_client text, statut_client text, notes text, courriels_rapport text, courriels_cc text, logo_url text, couleur_rapport text, mention_legale text, client_admins text, client_admin_count bigint, active_member_count bigint, active_authenticated_count bigint, inconsistent_member_count bigint, pending_invitation_count bigint, accepted_invitation_count bigint, accessible_campaign_count bigint, latest_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$BEGIN IF auth.uid() IS NULL OR (public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'rpc_role_denied' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif' AND u.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=u.client_id)) THEN RAISE EXCEPTION 'rpc_actor_client_invalid' USING ERRCODE='42501'; END IF;return query select c.id,c.nom_client,c.type_client,c.statut,c.notes,c.courriels_rapport,c.courriels_cc,c.logo_url,c.couleur_rapport,c.mention_legale,coalesce(string_agg(distinct case when u.role='Client-Admin'then concat_ws(' — ',nullif(u.nom,''),u.courriel)end,'; '),'')::text,count(distinct u.id)filter(where u.role='Client-Admin'),count(distinct u.id)filter(where u.role in('Client','Client-Admin')and coalesce(u.statut,'Actif')='Actif'),count(distinct u.id)filter(where u.role in('Client','Client-Admin')and u.statut='Actif'and u.auth_user_id is not null),count(distinct u.id)filter(where u.role in('Client','Client-Admin')and u.statut='Actif'and u.auth_user_id is null),count(distinct i.id)filter(where i.status='pending'),count(distinct i.id)filter(where i.status='accepted'),count(distinct cm.id)filter(where cm.client_published and(exists(select 1 from public.utilisateurs ca where ca.client_id=c.id and ca.role='Client-Admin'and ca.statut='Actif'and ca.auth_user_id is not null)or exists(select 1 from public.client_campaign_access a join public.utilisateurs cu on cu.auth_user_id=a.user_id where a.client_id=c.id and a.campaign_id=cm.id and cu.client_id=c.id and cu.statut='Actif'))),max(coalesce(u.derniere_activite_le,u.premiere_connexion_le,u.compte_active_le))from public.clients c left join public.utilisateurs u on u.client_id=c.id left join public.client_member_invitations i on i.client_id=c.id left join public.campagnes_maitres cm on cm.client_id=c.id WHERE public.tos_table_resource_scope(c.id,NULL,NULL,NULL,false) group by c.id;end$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_client_access_overview_v135() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_client_access_overview_v135() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_update_client_v135(p_client_id bigint, p_payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare n text:=btrim(p_payload->>'nom_client');s text:=coalesce(nullif(btrim(p_payload->>'statut'),''),'Actif');BEGIN IF auth.uid() IS NULL OR (public.tos_current_role() IN ('Administrateur')) IS NOT TRUE THEN RAISE EXCEPTION 'rpc_role_denied' USING ERRCODE='42501'; END IF;
IF EXISTS(SELECT 1 FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif' AND u.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=u.client_id)) THEN RAISE EXCEPTION 'rpc_actor_client_invalid' USING ERRCODE='42501'; END IF;
IF p_client_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND public.tos_table_resource_scope(c.id,NULL,NULL,NULL,false)) THEN RAISE EXCEPTION 'client_scope_denied' USING ERRCODE='42501';END IF;
IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'nom_client') IS DISTINCT FROM 'string' OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) x WHERE x.key IN ('statut','type_client','notes','courriels_rapport','courriels_cc','logo_url','couleur_rapport','mention_legale') AND jsonb_typeof(x.value) NOT IN ('string','null')) THEN RAISE EXCEPTION 'invalid_client_payload' USING ERRCODE='22023';END IF;
if n is null or length(n)<2 or s not in('Actif','Désactivé')then raise exception 'invalid_client';end if;update public.clients set nom_client=n,type_client=nullif(btrim(p_payload->>'type_client'),''),statut=s,notes=nullif(btrim(p_payload->>'notes'),''),courriels_rapport=nullif(btrim(p_payload->>'courriels_rapport'),''),courriels_cc=nullif(btrim(p_payload->>'courriels_cc'),''),logo_url=nullif(btrim(p_payload->>'logo_url'),''),couleur_rapport=nullif(btrim(p_payload->>'couleur_rapport'),''),mention_legale=nullif(btrim(p_payload->>'mention_legale'),'')where id=p_client_id;if not found then raise exception 'client_not_found';end if;return p_client_id;end$function$
;
REVOKE EXECUTE ON FUNCTION public.admin_update_client_v135(bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_client_v135(bigint,jsonb) TO authenticated,service_role;

