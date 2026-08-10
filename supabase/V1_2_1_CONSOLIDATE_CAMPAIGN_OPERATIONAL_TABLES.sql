BEGIN;

-- V1.2.1: copie additive des deux tables historiques. Aucune source n'est modifiee.
CREATE TABLE IF NOT EXISTS public.campagnes_visuels_sites_supports
  (LIKE public.campagnes_et_visuels INCLUDING ALL);
ALTER TABLE public.campagnes_visuels_sites_supports
  ADD COLUMN IF NOT EXISTS legacy_id bigint,
  ADD COLUMN IF NOT EXISTS site_id text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS infrastructure_id bigint,
  ADD COLUMN IF NOT EXISTS campaign_id bigint,
  ADD COLUMN IF NOT EXISTS visual_id bigint,
  ADD COLUMN IF NOT EXISTS business_context text NOT NULL DEFAULT 'marketing',
  ADD COLUMN IF NOT EXISTS source_table text NOT NULL DEFAULT 'campagnes_et_visuels',
  ADD COLUMN IF NOT EXISTS historical_fingerprint text;

INSERT INTO public.campagnes_visuels_sites_supports
  (id,nom_campagne,visuel_terrain,date_debut,date_fin,statut_campagne,support_id,emplacement,date_mise_a_jour,raw_data,created_at,updated_at,
   legacy_id,site_id,site,infrastructure_id,campaign_id,visual_id,business_context,source_table,historical_fingerprint)
SELECT old.id,old.nom_campagne,old.visuel_terrain,old.date_debut,old.date_fin,old.statut_campagne,old.support_id,old.emplacement,old.date_mise_a_jour,old.raw_data,old.created_at,old.updated_at,
       old.id,infra.site,infra.site,infra.id,campaign.id,visual.id,'marketing','campagnes_et_visuels',
       md5(jsonb_build_array(old.id,old.nom_campagne,old.visuel_terrain,old.date_debut,old.date_fin,old.statut_campagne,old.support_id,old.emplacement,old.date_mise_a_jour,old.raw_data,old.created_at,old.updated_at)::text)
FROM public.campagnes_et_visuels old
LEFT JOIN LATERAL (SELECT i.id,i.site FROM public.infrastructures i WHERE i.support_id=old.support_id ORDER BY i.id LIMIT 1) infra ON true
LEFT JOIN LATERAL (SELECT c.id FROM public.campagnes_maitres c WHERE lower(trim(c.nom_campagne))=lower(trim(old.nom_campagne)) AND c.business_context='marketing' ORDER BY c.id LIMIT 1) campaign ON true
LEFT JOIN LATERAL (SELECT v.id FROM public.campagne_visuels_formats v WHERE v.campagne_id=campaign.id AND lower(trim(v.nom_visuel))=lower(trim(old.visuel_terrain)) ORDER BY v.id LIMIT 1) visual ON true
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.communications_operationnelles_sites_supports
  (LIKE public.communications_operationnelles INCLUDING ALL);
ALTER TABLE public.communications_operationnelles_sites_supports
  ADD COLUMN IF NOT EXISTS legacy_id bigint,
  ADD COLUMN IF NOT EXISTS site_id text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS infrastructure_id bigint,
  ADD COLUMN IF NOT EXISTS campaign_id bigint,
  ADD COLUMN IF NOT EXISTS visual_id bigint,
  ADD COLUMN IF NOT EXISTS business_context text NOT NULL DEFAULT 'operational_communication',
  ADD COLUMN IF NOT EXISTS source_table text NOT NULL DEFAULT 'communications_operationnelles',
  ADD COLUMN IF NOT EXISTS historical_fingerprint text;

INSERT INTO public.communications_operationnelles_sites_supports
  (id,emplacement,message,date_debut,date_fin,statut,no_arret,site_ou_arret,support_id,no_edt,related_voiture,visuel_message,visuel_terrain,raw_data,created_at,updated_at,
   legacy_id,site_id,site,infrastructure_id,campaign_id,visual_id,business_context,source_table,historical_fingerprint)
SELECT old.id,old.emplacement,old.message,old.date_debut,old.date_fin,old.statut,old.no_arret,old.site_ou_arret,old.support_id,old.no_edt,old.related_voiture,old.visuel_message,old.visuel_terrain,old.raw_data,old.created_at,old.updated_at,
       old.id,infra.site,infra.site,infra.id,campaign.id,visual.id,'operational_communication','communications_operationnelles',
       md5(jsonb_build_array(old.id,old.emplacement,old.message,old.date_debut,old.date_fin,old.statut,old.no_arret,old.site_ou_arret,old.support_id,old.no_edt,old.related_voiture,old.visuel_message,old.visuel_terrain,old.raw_data,old.created_at,old.updated_at)::text)
FROM public.communications_operationnelles old
LEFT JOIN LATERAL (SELECT i.id,i.site FROM public.infrastructures i WHERE i.support_id=old.support_id ORDER BY i.id LIMIT 1) infra ON true
LEFT JOIN LATERAL (SELECT c.id FROM public.campagnes_maitres c WHERE lower(trim(c.nom_campagne))=lower(trim(old.message)) AND c.business_context='operational_communication' ORDER BY c.id LIMIT 1) campaign ON true
LEFT JOIN LATERAL (SELECT v.id FROM public.campagne_visuels_formats v WHERE v.campagne_id=campaign.id AND lower(trim(v.nom_visuel))=lower(trim(coalesce(nullif(old.visuel_message,''),old.visuel_terrain))) ORDER BY v.id LIMIT 1) visual ON true
ON CONFLICT (id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS campagnes_visuels_sites_supports_legacy_uidx ON public.campagnes_visuels_sites_supports(source_table,legacy_id);
CREATE INDEX IF NOT EXISTS campagnes_visuels_sites_supports_site_support_idx ON public.campagnes_visuels_sites_supports(site,support_id);
CREATE INDEX IF NOT EXISTS campagnes_visuels_sites_supports_relations_idx ON public.campagnes_visuels_sites_supports(campaign_id,visual_id);
CREATE UNIQUE INDEX IF NOT EXISTS communications_operationnelles_sites_supports_legacy_uidx ON public.communications_operationnelles_sites_supports(source_table,legacy_id);
CREATE INDEX IF NOT EXISTS communications_operationnelles_sites_supports_site_support_idx ON public.communications_operationnelles_sites_supports(site,support_id);
CREATE INDEX IF NOT EXISTS communications_operationnelles_sites_supports_relations_idx ON public.communications_operationnelles_sites_supports(campaign_id,visual_id);

ALTER TABLE public.campagnes_visuels_sites_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_operationnelles_sites_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.campagnes_visuels_sites_supports FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.communications_operationnelles_sites_supports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.campagnes_visuels_sites_supports TO authenticated;
GRANT SELECT ON TABLE public.communications_operationnelles_sites_supports TO authenticated;
CREATE POLICY "internal_read_campaign_history_v121" ON public.campagnes_visuels_sites_supports
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('Administrateur','Coordonnateur'));
CREATE POLICY "internal_read_operational_history_v121" ON public.communications_operationnelles_sites_supports
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('Administrateur','Coordonnateur'));

COMMIT;
