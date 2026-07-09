-- TOS Display Manager - Bloc 1 / 2 / 3
-- Schéma Supabase professionnel initial.
-- À exécuter dans Supabase > SQL Editor si les tables doivent être recréées.

DROP TABLE IF EXISTS journal_des_evenements CASCADE;
DROP TABLE IF EXISTS historique_des_campagnes CASCADE;
DROP TABLE IF EXISTS bons_de_travail CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS voitures_trains CASCADE;
DROP TABLE IF EXISTS ci_avec_enjeux CASCADE;
DROP TABLE IF EXISTS centres_dinformation CASCADE;
DROP TABLE IF EXISTS enjeux_des_cadres_et_supports CASCADE;
DROP TABLE IF EXISTS communications_operationnelles CASCADE;
DROP TABLE IF EXISTS repertoire_des_affiches CASCADE;
DROP TABLE IF EXISTS campagnes_et_visuels CASCADE;
DROP TABLE IF EXISTS suivi_des_edt CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS liste_des_arrets CASCADE;
DROP TABLE IF EXISTS infrastructures CASCADE;

CREATE TABLE infrastructures (
  id BIGSERIAL PRIMARY KEY,
  support_id TEXT UNIQUE,
  type_support TEXT,
  format_affichage TEXT,
  medium_recommande TEXT,
  emplacement_visibilite TEXT,
  site TEXT,
  type_site TEXT,
  ligne_distribution TEXT,
  type_ligne_distribution TEXT,
  enjeux TEXT,
  type_enjeux TEXT,
  actif TEXT,
  campagne_selon_visuel TEXT,
  visuel_en_expo TEXT,
  commentaires TEXT,
  campagne_actuelle TEXT,
  visuel_campagne TEXT,
  visuel_actuel_cadre TEXT,
  date_derniere_manipulation TEXT,
  edt_associe TEXT,
  prochain_edt_cible TEXT,
  edt_precedent_associe TEXT,
  coordonnees_gps TEXT,
  latitude TEXT,
  longitude TEXT,
  lien_carte_interactive TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE liste_des_arrets (
  id BIGSERIAL PRIMARY KEY,
  no_arret TEXT UNIQUE,
  emplacement_visibilite TEXT,
  type_support TEXT,
  statut TEXT,
  visuel_affiche TEXT,
  photo_visuel_reel TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (id BIGSERIAL PRIMARY KEY, nom_client TEXT UNIQUE, type_client TEXT, client_admin TEXT, statut TEXT, notes TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE utilisateurs (id BIGSERIAL PRIMARY KEY, nom TEXT, courriel TEXT UNIQUE, role TEXT, organisation TEXT, statut TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE suivi_des_edt (id BIGSERIAL PRIMARY KEY, no_edt TEXT UNIQUE, campagne TEXT, phase TEXT, client TEXT, date_debut_prevue TEXT, date_fin_prevue TEXT, dates_travaux TEXT, statut TEXT, supports_cibles INTEGER DEFAULT 0, supports_completes INTEGER DEFAULT 0, photos_recues INTEGER DEFAULT 0, avancement NUMERIC DEFAULT 0, coordonnateur TEXT, commentaires TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE campagnes_et_visuels (id BIGSERIAL PRIMARY KEY, nom_campagne TEXT, visuel_terrain TEXT, date_debut TEXT, date_fin TEXT, statut_campagne TEXT, support_id TEXT, emplacement TEXT, date_mise_a_jour TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE repertoire_des_affiches (id BIGSERIAL PRIMARY KEY, type_campagne TEXT, nom_campagne TEXT, medium_affichage TEXT, format TEXT, nom_detaille_visuel TEXT, quantite_entrepot INTEGER DEFAULT 0, quantite_expo INTEGER DEFAULT 0, date_debut TEXT, date_fin TEXT, statut_campagne TEXT, visuel TEXT, statut_apres_periode TEXT, date_dernier_decompte TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE communications_operationnelles (id BIGSERIAL PRIMARY KEY, emplacement TEXT, message TEXT, date_debut TEXT, date_fin TEXT, statut TEXT, no_arret TEXT, site_ou_arret TEXT, support_id TEXT, no_edt TEXT, related_voiture TEXT, visuel_message TEXT, visuel_terrain TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE enjeux_des_cadres_et_supports (id BIGSERIAL PRIMARY KEY, related_support TEXT, no_cadre TEXT, emplacement TEXT, enjeux TEXT, type_enjeux TEXT, statut TEXT, commentaire TEXT, date_inscription TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE centres_dinformation (id BIGSERIAL PRIMARY KEY, nom_ci TEXT UNIQUE, nombre_cadres INTEGER DEFAULT 0, photo TEXT, enjeux TEXT, date_derniere_intervention TEXT, commentaires TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE ci_avec_enjeux (id BIGSERIAL PRIMARY KEY, nom_complet_ci TEXT, enjeux TEXT, commentaires TEXT, photo TEXT, date_derniere_mise_a_jour TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE voitures_trains (id BIGSERIAL PRIMARY KEY, no_voiture TEXT UNIQUE, statut_voiture TEXT, support_id TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE photos (id BIGSERIAL PRIMARY KEY, photo_id TEXT UNIQUE, support_id TEXT, nom_fichier TEXT, action TEXT, date_photo TEXT, utilisateur TEXT, campagne TEXT, visuel TEXT, gps TEXT, statut TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE bons_de_travail (id BIGSERIAL PRIMARY KEY, no_bt TEXT UNIQUE, type_bt TEXT, support_id TEXT, no_edt TEXT, priorite TEXT, statut TEXT, assigne_a TEXT, date_cible TEXT, client TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE historique_des_campagnes (id BIGSERIAL PRIMARY KEY, support_id TEXT, campagne TEXT, visuel TEXT, no_edt TEXT, date_installation TEXT, date_retrait TEXT, photo_installation TEXT, utilisateur TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE journal_des_evenements (id BIGSERIAL PRIMARY KEY, date_evenement TEXT, utilisateur TEXT, action TEXT, table_concernee TEXT, ancienne_valeur TEXT, nouvelle_valeur TEXT, raw_data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE INDEX idx_infrastructures_support_id ON infrastructures (support_id);
CREATE INDEX idx_infrastructures_prochain_edt ON infrastructures (prochain_edt_cible);
CREATE INDEX idx_infrastructures_edt_associe ON infrastructures (edt_associe);
CREATE INDEX idx_arrets_no_arret ON liste_des_arrets (no_arret);
CREATE INDEX idx_edt_no_edt ON suivi_des_edt (no_edt);
CREATE INDEX idx_photos_support_id ON photos (support_id);
CREATE INDEX idx_bt_support_id ON bons_de_travail (support_id);
CREATE INDEX idx_bt_no_edt ON bons_de_travail (no_edt);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'infrastructures','liste_des_arrets','clients','utilisateurs','suivi_des_edt','campagnes_et_visuels','repertoire_des_affiches','communications_operationnelles','enjeux_des_cadres_et_supports','centres_dinformation','ci_avec_enjeux','voitures_trains','photos','bons_de_travail','historique_des_campagnes','journal_des_evenements'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS dev_read_%I ON %I;', t, t);
    EXECUTE format('CREATE POLICY dev_read_%I ON %I FOR SELECT USING (true);', t, t);
  END LOOP;
END $$;
