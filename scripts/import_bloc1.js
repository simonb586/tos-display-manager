import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Variables manquantes : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'tos-display-manager-import-v3' } }
});

const dataDir = path.join(process.cwd(), 'src', 'data');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
const txt = (v) => (v === undefined || v === null ? '' : String(v).trim());
const intVal = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const pctVal = (v) => {
  const n = parseFloat(String(v ?? '').replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const imports = [
  {
    table: 'infrastructures', file: 'infrastructures.json', key: 'support_id', map: r => ({
      support_id: txt(r['Support ID']),
      type_support: txt(r['Type de support']),
      format_affichage: txt(r["Formats d'affichage"]),
      medium_recommande: txt(r['Médium recommandé']),
      emplacement_visibilite: txt(r['Emplacement/Visibilité']),
      site: txt(r['Site']),
      type_site: txt(r['Type de site']),
      ligne_distribution: txt(r['Ligne de distribution']),
      type_ligne_distribution: txt(r['TYPE DE LIGNE DE DISTRIBUTION']),
      enjeux: txt(r['Enjeux']),
      type_enjeux: txt(r["Type d'enjeux"]),
      actif: txt(r['Actif']),
      campagne_selon_visuel: txt(r['CAMPAGNES SELON VISUEL']),
      visuel_en_expo: txt(r['VISUEL EN EXPO']),
      commentaires: txt(r['COMMENTAIRES']),
      campagne_actuelle: txt(r['Nom de la campagne actuelle']),
      visuel_campagne: txt(r['Visuel de la campagne']),
      visuel_actuel_cadre: txt(r['Visuel actuel du cadre']),
      date_derniere_manipulation: txt(r['Date de la dernière manipulation']),
      edt_associe: txt(r['EDT Associé']),
      prochain_edt_cible: txt(r['Prochain EDT ciblé']),
      edt_precedent_associe: txt(r['EDT précédent associé']),
      coordonnees_gps: txt(r['Coordonnées GPS']),
      latitude: txt(r['Latitude']),
      longitude: txt(r['Longitude']),
      lien_carte_interactive: txt(r['Lien carte interactive']),
      raw_data: r
    })
  },
  {
    table: 'liste_des_arrets', file: 'liste_des_arrets.json', key: 'no_arret', map: r => ({
      no_arret: txt(r["# d'Arrêt"]),
      emplacement_visibilite: txt(r['Emplacement/Visibilité']),
      type_support: txt(r['Type de support']),
      statut: txt(r['Statut']),
      visuel_affiche: txt(r['Visuel affiché']),
      photo_visuel_reel: txt(r['Photo du visuel réel']),
      raw_data: r
    })
  },
  { table: 'clients', file: 'clients.json', key: 'nom_client', map: r => ({ nom_client: txt(r['Client']), type_client: txt(r['Type']), client_admin: txt(r['Client-admin']), statut: txt(r['Statut']), notes: txt(r['Notes']), raw_data: r }) },
  { table: 'utilisateurs', file: 'utilisateurs.json', key: 'courriel', map: r => ({ nom: txt(r['Nom']), courriel: txt(r['Courriel']), role: txt(r['Rôle']), organisation: txt(r['Organisation']), statut: txt(r['Statut']), raw_data: r }) },
  { table: 'suivi_des_edt', file: 'suivi_des_edt.json', key: 'no_edt', map: r => ({ no_edt: txt(r['No EDT']), campagne: txt(r['Campagne']), phase: txt(r['Phase']), client: txt(r['Client']), date_debut_prevue: txt(r['Date début prévue']), date_fin_prevue: txt(r['Date fin prévue']), dates_travaux: txt(r['Dates de travaux']), statut: txt(r['Statut']), supports_cibles: intVal(r['Supports ciblés']), supports_completes: intVal(r['Supports complétés']), photos_recues: intVal(r['Photos reçues']), avancement: pctVal(r['Avancement']), coordonnateur: txt(r['Coordonnateur']), commentaires: txt(r['Commentaires']), raw_data: r }) },
  { table: 'campagnes_et_visuels', file: 'campagnes_et_visuels.json', key: null, map: r => ({ nom_campagne: txt(r['Nom de la campagne']), visuel_terrain: txt(r['Visuel terrain de la campagne en exposition']), date_debut: txt(r['Date de début']), date_fin: txt(r['Date de fin']), statut_campagne: txt(r['Statut de la campagne']), support_id: txt(r['Support ID']), emplacement: txt(r['Emplacement']), date_mise_a_jour: txt(r['Date de mise à jour']), raw_data: r }) },
  { table: 'repertoire_des_affiches', file: 'repertoire_des_affiches.json', key: null, map: r => ({ type_campagne: txt(r['Type de campagne']), nom_campagne: txt(r['Nom de la campagne']), medium_affichage: txt(r["Medium d'affichage"]), format: txt(r['Format']), nom_detaille_visuel: txt(r['Nom détaillé du visuel']), quantite_entrepot: intVal(r['Quantité en entrepot']), quantite_expo: intVal(r['Quantité en expo']), date_debut: txt(r['Date de début']), date_fin: txt(r['Date de fin']), statut_campagne: txt(r['Statut de la campagne']), visuel: txt(r['Visuel']), statut_apres_periode: txt(r["Statut après periode d'affichage"]), date_dernier_decompte: txt(r['Date du dernier décompte']), raw_data: r }) },
  { table: 'communications_operationnelles', file: 'communications_operationnelles.json', key: null, map: r => ({ emplacement: txt(r['Emplacement']), message: txt(r['Message']), date_debut: txt(r['Date de début']), date_fin: txt(r['Date de fin']), statut: txt(r['Statut']), no_arret: txt(r["# d'Arrêt"]), site_ou_arret: txt(r["#d'arrêt ou site"]), support_id: txt(r['ID du support']), no_edt: txt(r["No d'EDT"]), related_voiture: txt(r['Related voiture']), visuel_message: txt(r['Visuel du message']), visuel_terrain: txt(r['Visuel terrain']), raw_data: r }) },
  { table: 'enjeux_des_cadres_et_supports', file: 'enjeux_des_cadres_et_supports.json', key: null, map: r => ({ related_support: txt(r['Related Support']), no_cadre: txt(r['#Du cadre']), emplacement: txt(r['Emplacement']), enjeux: txt(r['Enjeux']), type_enjeux: txt(r["Type d'enjeux"]), statut: txt(r['Statut']), commentaire: txt(r['Commentaire']), date_inscription: txt(r["Date d'inscription de l'enjeux"]), raw_data: r }) },
  { table: 'centres_dinformation', file: 'centres_dinformation.json', key: 'nom_ci', map: r => ({ nom_ci: txt(r['Nom du C.I.']), nombre_cadres: intVal(r['Nombre de cadres']), photo: txt(r['Photo']), enjeux: txt(r['Enjeux']), date_derniere_intervention: txt(r['Date de la dernière intervention']), commentaires: txt(r['Commentaires']), raw_data: r }) },
  { table: 'ci_avec_enjeux', file: 'c_i_avec_enjeux.json', key: 'nom_complet_ci', map: r => ({ nom_complet_ci: txt(r['Nom complet du C.I.']), enjeux: txt(r['Enjeux']), commentaires: txt(r['Commentaires']), photo: txt(r['Photo']), date_derniere_mise_a_jour: txt(r['Date de la dernière mise à jour']), raw_data: r }) },
  { table: 'voitures_trains', file: 'voitures_trains.json', key: 'no_voiture', map: r => ({ no_voiture: txt(r['#  Voiture']), statut_voiture: txt(r['Statut de la voiture']), support_id: txt(r['Support ID']), raw_data: r }) },
  { table: 'photos', file: 'photos.json', key: 'photo_id', map: r => ({ photo_id: txt(r['Photo ID']), support_id: txt(r['Support ID']), nom_fichier: txt(r['Nom fichier']), action: txt(r['Action']), date_photo: txt(r['Date']), utilisateur: txt(r['Utilisateur']), campagne: txt(r['Campagne']), visuel: txt(r['Visuel']), gps: txt(r['GPS']), statut: txt(r['Statut']), raw_data: r }) },
  { table: 'bons_de_travail', file: 'bons_de_travail.json', key: 'no_bt', map: r => ({ no_bt: txt(r['BT']), type_bt: txt(r['Type']), support_id: txt(r['Support ID']), no_edt: txt(r['EDT']), priorite: txt(r['Priorité']), statut: txt(r['Statut']), assigne_a: txt(r['Assigné à']), date_cible: txt(r['Date cible']), client: txt(r['Client']), raw_data: r }) },
  { table: 'historique_des_campagnes', file: 'historique_des_campagnes.json', key: null, map: r => ({ support_id: txt(r['Support ID']), campagne: txt(r['Campagne']), visuel: txt(r['Visuel']), no_edt: txt(r['EDT']), date_installation: txt(r['Date installation']), date_retrait: txt(r['Date retrait']), photo_installation: txt(r['Photo installation']), utilisateur: txt(r['Utilisateur']), raw_data: r }) },
  { table: 'journal_des_evenements', file: 'journal_des_evenements.json', key: null, map: r => ({ date_evenement: txt(r['Date']), utilisateur: txt(r['Utilisateur']), action: txt(r['Action']), table_concernee: txt(r['Table']), ancienne_valeur: txt(r['Ancienne valeur']), nouvelle_valeur: txt(r['Nouvelle valeur']), raw_data: r }) }
];

function dedupeRows(rows, key) {
  if (!key) return rows;
  const map = new Map();
  let ignored = 0;
  for (const row of rows) {
    const value = txt(row[key]);
    if (!value) { ignored++; continue; }
    map.set(value, row);
  }
  return { rows: Array.from(map.values()), ignored };
}

async function withRetry(operation, label, attempts = 5) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try { return await operation(); }
    catch (error) {
      lastError = error;
      console.warn(`⚠️ ${label} échoué (${i}/${attempts}) : ${error.message}`);
      await wait(1500 * i);
    }
  }
  throw lastError;
}

async function upsertChunks(table, rows, key, size = 250) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await withRetry(async () => {
      const query = supabase.from(table);
      const { error } = key
      const { error } =
  table === 'ci_avec_enjeux'
    ? await query.insert(chunk)
    : key
    ? await query.upsert(chunk, { onConflict: key })
    : await query.insert(chunk);
      if (error) throw new Error(error.message);
    }, `${table} ${Math.min(i + size, rows.length)}/${rows.length}`);
    console.log(`  ${table}: ${Math.min(i + size, rows.length)}/${rows.length}`);
    await wait(150);
  }
}

async function main() {
  console.log('🚀 Début import Bloc 1 V3...');
  const report = [];

  for (const item of imports) {
    const filePath = path.join(dataDir, item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fichier absent: ${item.file}`);
      report.push({ table: item.table, status: 'fichier absent', rows: 0 });
      continue;
    }

    const json = readJson(item.file);
    const mapped = Array.isArray(json) ? json.map(item.map) : [];
    const result = dedupeRows(mapped, item.key);
    const rows = Array.isArray(result) ? result : result.rows;
    const ignored = Array.isArray(result) ? 0 : result.ignored;

    console.log(`\n📦 ${item.table}: ${rows.length} ligne(s) à synchroniser${ignored ? `, ${ignored} doublon(s) ou clé vide ignoré(s)` : ''}`);
    await upsertChunks(item.table, rows, item.key);
    report.push({ table: item.table, status: 'ok', rows: rows.length, ignored });
    console.log(`✅ ${item.table}: terminé`);
  }

  console.log('\n✅ Import Bloc 1 V3 terminé. Rapport:');
  for (const r of report) {
    console.log(`- ${r.table}: ${r.status}, ${r.rows} ligne(s)${r.ignored ? `, ${r.ignored} ignorée(s)` : ''}`);
  }
}

main().catch(error => {
  console.error('\n❌ Import interrompu');
  console.error(error.message);
  process.exit(1);
});
