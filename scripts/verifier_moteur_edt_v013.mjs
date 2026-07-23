import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/V0_13_0_SECURISATION_SYNC_EDT_BT.sql', 'utf8');
const verifier = fs.readFileSync('supabase/VERIFIER_V0_13_0_SYNC_EDT_BT.sql', 'utf8');
const service = fs.readFileSync('src/services/operationsService.js', 'utf8');
const panel = fs.readFileSync('src/components/EdtIntegrityDiagnostics.jsx', 'utf8');

const checks = [
  ['normalisation du cycle de vie', /normaliser_edt_support_v013/],
  ['source de vérité déclarée', /'source_de_verite', 'edt_supports'/],
  ['réouverture déterministe', /when v_total > 0 then 'Planifié'/],
  ['date de fin réinitialisée', /else null\s+end,\s+derniere_synchro/s],
  ['diagnostic BT manquant', /'BT_MANQUANT'/],
  ['diagnostic lien asymétrique', /'LIEN_BT_ASYMETRIQUE'/],
  ['diagnostic identité incohérente', /'IDENTITE_BT_INCOHERENTE'/],
  ['diagnostic état divergent', /'ETAT_BT_DIVERGENT'/],
  ['diagnostic phase hors EDT', /'PHASE_HORS_EDT'/],
  ['dry-run par défaut', /p_apply boolean default false/],
  ['validation administrateur', /current_app_role\(\) <> 'Administrateur'/],
  ['synchronisation sans égalité naïve', /is distinct from/i],
  ['protection de l’identité BT', /Lien BT incohérent/]
];

for (const [label, pattern] of checks) {
  assert.match(migration, pattern, label);
}

assert.match(verifier, /rollback;\s*$/i, 'le test SQL autonome doit se terminer par ROLLBACK');
assert.match(verifier, /reparer_integrite_edt_v013\(v_edt_id, false\)/, 'le test doit exercer le dry-run');
assert.match(verifier, /date_fin conservée après réouverture/, 'le test doit contrôler la réouverture');
assert.match(service, /p_apply:\s*false/, 'le service applicatif ne doit offrir que le dry-run');
assert.doesNotMatch(service, /p_apply:\s*true/, 'aucune réparation active dans le service');
assert.match(panel, /Simuler la réparation/, 'le panneau doit annoncer explicitement la simulation');
assert.doesNotMatch(panel, /Appliquer la réparation/, 'le panneau ne doit pas exposer une activation');

console.log(`OK: ${checks.length + 7} vérifications statiques du moteur EDT réussies.`);
