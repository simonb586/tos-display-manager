-- Canonical identity lookup bypasses utilisateurs RLS without recursive policies.
-- Internal NULL client_id is the explicitly approved global operational scope.
CREATE OR REPLACE FUNCTION public.tos_table_resource_scope(
  p_client bigint, p_support text, p_campaign bigint, p_edt bigint,
  p_allow_unassigned boolean DEFAULT false
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  actor_role text := public.tos_current_role();
  actor_client bigint;
  owner_client bigint := p_client;
  linked_client bigint;
  edt_campaign bigint;
BEGIN
  IF auth.uid() IS NULL OR actor_role IS NULL THEN RETURN false; END IF;
  SELECT u.client_id INTO actor_client FROM public.utilisateurs u
  WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif';
  IF actor_client IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=actor_client) THEN RETURN false; END IF;
  IF nullif(btrim(p_support),'') IS NOT NULL THEN
    SELECT i.client_id INTO linked_client FROM public.infrastructures i WHERE i.support_id=p_support;
    IF NOT FOUND OR linked_client IS NULL THEN RETURN false; END IF;
    IF owner_client IS NOT NULL AND owner_client<>linked_client THEN RETURN false; END IF;
    owner_client:=linked_client;
  END IF;
  IF p_edt IS NOT NULL THEN
    SELECT e.client_id,e.campagne_id INTO linked_client,edt_campaign FROM public.suivi_des_edt e WHERE e.id=p_edt;
    IF NOT FOUND OR linked_client IS NULL THEN RETURN false; END IF;
    IF owner_client IS NOT NULL AND owner_client<>linked_client THEN RETURN false; END IF;
    owner_client:=linked_client;
    IF edt_campaign IS NOT NULL THEN
      SELECT c.client_id INTO linked_client FROM public.campagnes_maitres c WHERE c.id=edt_campaign;
      IF NOT FOUND OR linked_client IS DISTINCT FROM owner_client THEN RETURN false; END IF;
    END IF;
  END IF;
  IF p_campaign IS NOT NULL THEN
    SELECT c.client_id INTO linked_client FROM public.campagnes_maitres c WHERE c.id=p_campaign;
    IF NOT FOUND OR linked_client IS NULL THEN RETURN false; END IF;
    IF owner_client IS NOT NULL AND owner_client<>linked_client THEN RETURN false; END IF;
    owner_client:=linked_client;
  END IF;
  IF owner_client IS NULL THEN
    RETURN coalesce(p_allow_unassigned,false) AND actor_client IS NULL
      AND actor_role IN ('Administrateur','Coordonnateur','Installateur');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=owner_client) THEN RETURN false; END IF;
  RETURN (actor_role IN ('Administrateur','Coordonnateur','Installateur') AND actor_client IS NULL)
    OR (actor_client IS NOT NULL AND actor_client=owner_client);
END;
$function$;
REVOKE ALL ON FUNCTION public.tos_table_resource_scope(bigint,text,bigint,bigint,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tos_table_resource_scope(bigint,text,bigint,bigint,boolean) TO authenticated, service_role;


-- clients: adminService; authenticated client identity; Edge service-role contacts
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clients FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.clients TO authenticated;
DROP POLICY IF EXISTS "clients_admin_all" ON public.clients;
DROP POLICY IF EXISTS "clients_scoped_read_v120" ON public.clients;
DROP POLICY IF EXISTS "dev_read_clients" ON public.clients;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.clients;
DROP POLICY IF EXISTS "private_clients_select" ON public.clients;
DROP POLICY IF EXISTS "private_clients_update" ON public.clients;
DROP POLICY IF EXISTS "private_clients_insert" ON public.clients;
DROP POLICY IF EXISTS "private_clients_delete" ON public.clients;
CREATE POLICY private_clients_select ON public.clients FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IS NOT NULL AND (public.tos_table_resource_scope(id,NULL,NULL,NULL,false) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_clients_update ON public.clients FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(id,NULL,NULL,NULL,false) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(id,NULL,NULL,NULL,false) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
GRANT INSERT, DELETE ON TABLE public.clients TO authenticated;
CREATE POLICY private_clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));
CREATE POLICY private_clients_delete ON public.clients FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(id,NULL,NULL,NULL,false) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- liste_des_arrets: internal dataService/searchService and Terrain
ALTER TABLE public.liste_des_arrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.liste_des_arrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.liste_des_arrets TO authenticated;
DROP POLICY IF EXISTS "dev_read_liste_des_arrets" ON public.liste_des_arrets;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.liste_des_arrets;
DROP POLICY IF EXISTS "private_liste_des_arrets_select" ON public.liste_des_arrets;
DROP POLICY IF EXISTS "private_liste_des_arrets_update" ON public.liste_des_arrets;
DROP POLICY IF EXISTS "private_liste_des_arrets_insert" ON public.liste_des_arrets;
DROP POLICY IF EXISTS "private_liste_des_arrets_delete" ON public.liste_des_arrets;
CREATE POLICY private_liste_des_arrets_select ON public.liste_des_arrets FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
CREATE POLICY private_liste_des_arrets_update ON public.liste_des_arrets FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));

-- repertoire_des_affiches: internal dataService, campaign inventory, exports
ALTER TABLE public.repertoire_des_affiches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.repertoire_des_affiches FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.repertoire_des_affiches TO authenticated;
DROP POLICY IF EXISTS "dev_read_repertoire_des_affiches" ON public.repertoire_des_affiches;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.repertoire_des_affiches;
DROP POLICY IF EXISTS "private_repertoire_des_affiches_select" ON public.repertoire_des_affiches;
DROP POLICY IF EXISTS "private_repertoire_des_affiches_update" ON public.repertoire_des_affiches;
DROP POLICY IF EXISTS "private_repertoire_des_affiches_insert" ON public.repertoire_des_affiches;
DROP POLICY IF EXISTS "private_repertoire_des_affiches_delete" ON public.repertoire_des_affiches;
CREATE POLICY private_repertoire_des_affiches_select ON public.repertoire_des_affiches FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
CREATE POLICY private_repertoire_des_affiches_update ON public.repertoire_des_affiches FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));

-- communications_operationnelles: internal dataService and operational support records
ALTER TABLE public.communications_operationnelles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.communications_operationnelles FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.communications_operationnelles TO authenticated;
DROP POLICY IF EXISTS "dev_read_communications_operationnelles" ON public.communications_operationnelles;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.communications_operationnelles;
DROP POLICY IF EXISTS "private_communications_operationnelles_select" ON public.communications_operationnelles;
DROP POLICY IF EXISTS "private_communications_operationnelles_update" ON public.communications_operationnelles;
DROP POLICY IF EXISTS "private_communications_operationnelles_insert" ON public.communications_operationnelles;
DROP POLICY IF EXISTS "private_communications_operationnelles_delete" ON public.communications_operationnelles;
CREATE POLICY private_communications_operationnelles_select ON public.communications_operationnelles FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_communications_operationnelles_update ON public.communications_operationnelles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- enjeux_des_cadres_et_supports: internal dataService and support issues
ALTER TABLE public.enjeux_des_cadres_et_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.enjeux_des_cadres_et_supports FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.enjeux_des_cadres_et_supports TO authenticated;
DROP POLICY IF EXISTS "dev_read_enjeux_des_cadres_et_supports" ON public.enjeux_des_cadres_et_supports;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.enjeux_des_cadres_et_supports;
DROP POLICY IF EXISTS "private_enjeux_des_cadres_et_supports_select" ON public.enjeux_des_cadres_et_supports;
DROP POLICY IF EXISTS "private_enjeux_des_cadres_et_supports_update" ON public.enjeux_des_cadres_et_supports;
DROP POLICY IF EXISTS "private_enjeux_des_cadres_et_supports_insert" ON public.enjeux_des_cadres_et_supports;
DROP POLICY IF EXISTS "private_enjeux_des_cadres_et_supports_delete" ON public.enjeux_des_cadres_et_supports;
CREATE POLICY private_enjeux_des_cadres_et_supports_select ON public.enjeux_des_cadres_et_supports FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND (public.tos_table_resource_scope(NULL,related_support,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_enjeux_des_cadres_et_supports_update ON public.enjeux_des_cadres_et_supports FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,related_support,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,related_support,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- centres_dinformation: internal dataService, CI operational photos/issues
ALTER TABLE public.centres_dinformation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.centres_dinformation FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.centres_dinformation TO authenticated;
DROP POLICY IF EXISTS "dev_read_centres_dinformation" ON public.centres_dinformation;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.centres_dinformation;
DROP POLICY IF EXISTS "private_centres_dinformation_select" ON public.centres_dinformation;
DROP POLICY IF EXISTS "private_centres_dinformation_update" ON public.centres_dinformation;
DROP POLICY IF EXISTS "private_centres_dinformation_insert" ON public.centres_dinformation;
DROP POLICY IF EXISTS "private_centres_dinformation_delete" ON public.centres_dinformation;
CREATE POLICY private_centres_dinformation_select ON public.centres_dinformation FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
CREATE POLICY private_centres_dinformation_update ON public.centres_dinformation FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));

-- ci_avec_enjeux: internal dataService, CI issue records
ALTER TABLE public.ci_avec_enjeux ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ci_avec_enjeux FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.ci_avec_enjeux TO authenticated;
DROP POLICY IF EXISTS "dev_read_ci_avec_enjeux" ON public.ci_avec_enjeux;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.ci_avec_enjeux;
DROP POLICY IF EXISTS "private_ci_avec_enjeux_select" ON public.ci_avec_enjeux;
DROP POLICY IF EXISTS "private_ci_avec_enjeux_update" ON public.ci_avec_enjeux;
DROP POLICY IF EXISTS "private_ci_avec_enjeux_insert" ON public.ci_avec_enjeux;
DROP POLICY IF EXISTS "private_ci_avec_enjeux_delete" ON public.ci_avec_enjeux;
CREATE POLICY private_ci_avec_enjeux_select ON public.ci_avec_enjeux FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
CREATE POLICY private_ci_avec_enjeux_update ON public.ci_avec_enjeux FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));

-- voitures_trains: internal dataService, support vehicles
ALTER TABLE public.voitures_trains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voitures_trains FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.voitures_trains TO authenticated;
DROP POLICY IF EXISTS "dev_read_voitures_trains" ON public.voitures_trains;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.voitures_trains;
DROP POLICY IF EXISTS "private_voitures_trains_select" ON public.voitures_trains;
DROP POLICY IF EXISTS "private_voitures_trains_update" ON public.voitures_trains;
DROP POLICY IF EXISTS "private_voitures_trains_insert" ON public.voitures_trains;
DROP POLICY IF EXISTS "private_voitures_trains_delete" ON public.voitures_trains;
CREATE POLICY private_voitures_trains_select ON public.voitures_trains FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_voitures_trains_update ON public.voitures_trains FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- photos: legacy internal dataService; current photo workflows use support_photos
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.photos FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.photos TO authenticated;
DROP POLICY IF EXISTS "dev_read_photos" ON public.photos;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.photos;
DROP POLICY IF EXISTS "private_photos_select" ON public.photos;
DROP POLICY IF EXISTS "private_photos_update" ON public.photos;
DROP POLICY IF EXISTS "private_photos_insert" ON public.photos;
DROP POLICY IF EXISTS "private_photos_delete" ON public.photos;
CREATE POLICY private_photos_select ON public.photos FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_photos_update ON public.photos FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- historique_des_campagnes: support360Service internal history; client uses scoped RPC payload
ALTER TABLE public.historique_des_campagnes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historique_des_campagnes FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.historique_des_campagnes TO authenticated;
DROP POLICY IF EXISTS "dev_read_historique_des_campagnes" ON public.historique_des_campagnes;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.historique_des_campagnes;
DROP POLICY IF EXISTS "private_historique_des_campagnes_select" ON public.historique_des_campagnes;
DROP POLICY IF EXISTS "private_historique_des_campagnes_update" ON public.historique_des_campagnes;
DROP POLICY IF EXISTS "private_historique_des_campagnes_insert" ON public.historique_des_campagnes;
DROP POLICY IF EXISTS "private_historique_des_campagnes_delete" ON public.historique_des_campagnes;
CREATE POLICY private_historique_des_campagnes_select ON public.historique_des_campagnes FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))));
CREATE POLICY private_historique_des_campagnes_update ON public.historique_des_campagnes FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true))) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND (public.tos_table_resource_scope(NULL,support_id,NULL,NULL,true) OR public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));

-- journal_des_evenements: internal event journal/dataService
ALTER TABLE public.journal_des_evenements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.journal_des_evenements FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.journal_des_evenements TO authenticated;
DROP POLICY IF EXISTS "dev_read_journal_des_evenements" ON public.journal_des_evenements;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.journal_des_evenements;
DROP POLICY IF EXISTS "private_journal_des_evenements_select" ON public.journal_des_evenements;
DROP POLICY IF EXISTS "private_journal_des_evenements_update" ON public.journal_des_evenements;
DROP POLICY IF EXISTS "private_journal_des_evenements_insert" ON public.journal_des_evenements;
DROP POLICY IF EXISTS "private_journal_des_evenements_delete" ON public.journal_des_evenements;
CREATE POLICY private_journal_des_evenements_select ON public.journal_des_evenements FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)));
CREATE POLICY private_journal_des_evenements_update ON public.journal_des_evenements FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(NULL,NULL,NULL,NULL,true));

-- utilisateurs: authenticated authProfileService bootstrap; internal assignments/reports; Admin and Edge user management
ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.utilisateurs FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.utilisateurs TO authenticated;
DROP POLICY IF EXISTS "dev_read_utilisateurs" ON public.utilisateurs;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.utilisateurs;
DROP POLICY IF EXISTS "utilisateurs_admin_all" ON public.utilisateurs;
DROP POLICY IF EXISTS "utilisateurs_self_read" ON public.utilisateurs;
DROP POLICY IF EXISTS "private_utilisateurs_select" ON public.utilisateurs;
DROP POLICY IF EXISTS "private_utilisateurs_update" ON public.utilisateurs;
DROP POLICY IF EXISTS "private_utilisateurs_insert" ON public.utilisateurs;
DROP POLICY IF EXISTS "private_utilisateurs_delete" ON public.utilisateurs;
CREATE POLICY private_utilisateurs_select ON public.utilisateurs FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IS NOT NULL AND (auth_user_id=(SELECT auth.uid()) OR ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,true)))));
CREATE POLICY private_utilisateurs_update ON public.utilisateurs FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,true));
GRANT INSERT, DELETE ON TABLE public.utilisateurs TO authenticated;
CREATE POLICY private_utilisateurs_insert ON public.utilisateurs FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,true));
CREATE POLICY private_utilisateurs_delete ON public.utilisateurs FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,true));

-- infrastructures: authenticated dataService/search/photoReview/photoLibrary/reports; client scoped RPC and preview
ALTER TABLE public.infrastructures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.infrastructures FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.infrastructures TO authenticated;
DROP POLICY IF EXISTS "dev_read_infrastructures" ON public.infrastructures;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.infrastructures;
DROP POLICY IF EXISTS "private_infrastructures_select" ON public.infrastructures;
DROP POLICY IF EXISTS "private_infrastructures_update" ON public.infrastructures;
DROP POLICY IF EXISTS "private_infrastructures_insert" ON public.infrastructures;
DROP POLICY IF EXISTS "private_infrastructures_delete" ON public.infrastructures;
CREATE POLICY private_infrastructures_select ON public.infrastructures FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IS NOT NULL AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,false)));
CREATE POLICY private_infrastructures_update ON public.infrastructures FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,false)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,NULL,NULL,false));

-- suivi_des_edt: operationsService/reportDataService/finalReportService; client scoped published RPC
ALTER TABLE public.suivi_des_edt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suivi_des_edt FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.suivi_des_edt TO authenticated;
DROP POLICY IF EXISTS "dev_read_suivi_des_edt" ON public.suivi_des_edt;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.suivi_des_edt;
DROP POLICY IF EXISTS "private_suivi_des_edt_select" ON public.suivi_des_edt;
DROP POLICY IF EXISTS "private_suivi_des_edt_update" ON public.suivi_des_edt;
DROP POLICY IF EXISTS "private_suivi_des_edt_insert" ON public.suivi_des_edt;
DROP POLICY IF EXISTS "private_suivi_des_edt_delete" ON public.suivi_des_edt;
CREATE POLICY private_suivi_des_edt_select ON public.suivi_des_edt FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(client_id,NULL,campagne_id,NULL,false)));
CREATE POLICY private_suivi_des_edt_update ON public.suivi_des_edt FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,campagne_id,NULL,false)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,NULL,campagne_id,NULL,false));

-- bons_de_travail: workOrderService/operationsService/support360Service; internal Admin/Coordinator writes
ALTER TABLE public.bons_de_travail ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bons_de_travail FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.bons_de_travail TO authenticated;
DROP POLICY IF EXISTS "bt_admin_delete" ON public.bons_de_travail;
DROP POLICY IF EXISTS "bt_authenticated_insert" ON public.bons_de_travail;
DROP POLICY IF EXISTS "bt_authenticated_read" ON public.bons_de_travail;
DROP POLICY IF EXISTS "bt_authenticated_update" ON public.bons_de_travail;
DROP POLICY IF EXISTS "dev_read_bons_de_travail" ON public.bons_de_travail;
DROP POLICY IF EXISTS "tdm_admin_universal_update" ON public.bons_de_travail;
DROP POLICY IF EXISTS "private_bons_de_travail_select" ON public.bons_de_travail;
DROP POLICY IF EXISTS "private_bons_de_travail_update" ON public.bons_de_travail;
DROP POLICY IF EXISTS "private_bons_de_travail_insert" ON public.bons_de_travail;
DROP POLICY IF EXISTS "private_bons_de_travail_delete" ON public.bons_de_travail;
CREATE POLICY private_bons_de_travail_select ON public.bons_de_travail FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND ((SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur','Installateur') AND public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)));
CREATE POLICY private_bons_de_travail_update ON public.bons_de_travail FOR UPDATE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur') AND public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true)) WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur') AND public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true));
GRANT INSERT, DELETE ON TABLE public.bons_de_travail TO authenticated;
CREATE POLICY private_bons_de_travail_insert ON public.bons_de_travail FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) IN ('Administrateur','Coordonnateur') AND public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true));
CREATE POLICY private_bons_de_travail_delete ON public.bons_de_travail FOR DELETE TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT public.tos_current_role()) = 'Administrateur' AND public.tos_table_resource_scope(client_id,support_id,NULL,edt_id,true));
