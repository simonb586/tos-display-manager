import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIVITY_TIMEZONE,
  activityObjectLabel,
  formatActivityDate,
  isRecentBusinessActivity,
  prepareRecentBusinessActivity,
  RECENT_ACTIVITY_LIMIT,
  recentActivityTarget
} from '../src/lib/recentActivity.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const events = Array.from({ length: 15 }, (_, index) => ({ id: String(index + 1), occurred_at: `2026-08-07T${String(index + 1).padStart(2, '0')}:00:00Z`, action: index % 2 ? 'Photo ajoutée' : 'Infrastructure modifiée', module: index % 2 ? 'Photos' : 'Infrastructures', support_id: `2000-${index + 1}`, actor_email: 'simon@example.com' }));
const recent = prepareRecentBusinessActivity(events);
assert.equal(recent.length, 10); checks += 1;
assert.equal(RECENT_ACTIVITY_LIMIT, 10); checks += 1;
assert.equal(recent[0].id, '15'); checks += 1;
assert.equal(recent.at(-1).id, '6'); checks += 1;
ok(recent.every((row, index) => index === 0 || row.occurred_at <= recent[index - 1].occurred_at), 'Tri récent vers ancien incorrect');

const initialization = { id: 'technical', occurred_at: '2026-08-07T23:59:00Z', action: 'Initialisation V0.6', module: 'Système' };
assert.equal(isRecentBusinessActivity(initialization), false); checks += 1;
assert.equal(prepareRecentBusinessActivity([...events, initialization]).some(row => row.id === 'technical'), false); checks += 1;
for (const action of ['Photo d’inspection ajoutée', 'Synchronisation Terrain réussie', 'EDT démarré', 'Campagne créée', 'Bon de travail créé']) ok(isRecentBusinessActivity({ occurred_at: '2026-08-07T12:00:00Z', action, module: action }), `Événement métier exclu: ${action}`);

assert.equal(activityObjectLabel(events[0]), 'Support 2000-1'); checks += 1;
assert.equal(recentActivityTarget({ module: 'Photos', support_id: '1' }, 'Coordonnateur'), 'Infrastructures'); checks += 1;
assert.equal(recentActivityTarget({ module: 'Terrain' }, 'Coordonnateur'), 'Diagnostic terrain'); checks += 1;
assert.equal(recentActivityTarget({ module: 'Terrain' }, 'Lecteur'), null); checks += 1;
assert.equal(recentActivityTarget({ module: 'Rapports' }, 'Lecteur'), null); checks += 1;
assert.equal(ACTIVITY_TIMEZONE, 'America/Toronto'); checks += 1;
ok(formatActivityDate('2026-08-07T18:08:00Z').includes('14 h 08'), 'Timezone Toronto incorrecte');

const service = fs.readFileSync('src/services/activityLogService.js', 'utf8');
const widget = fs.readFileSync('src/components/RecentActivityWidget.jsx', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
ok(service.includes("from('activity_events')"), 'Source activity_events absente');
ok(service.includes('RECENT_ACTIVITY_FIELDS') && !service.match(/listRecentBusinessActivity[\s\S]*select\('\*'/), 'Colonnes récentes non bornées');
ok(service.includes(".order('occurred_at', { ascending: false })") && service.includes(".order('id', { ascending: false })"), 'Tri canonique absent');
ok(service.includes('.limit(RECENT_ACTIVITY_LIMIT)'), 'Limite serveur absente');
ok(service.includes("request.not('action', 'ilike', pattern)"), 'Filtre technique serveur absent');
ok(widget.includes('event.actor_email') && widget.includes('formatActivityDate') && widget.includes('activityObjectLabel'), 'Informations utilisateur/date/objet absentes');
ok(widget.includes("onNavigate('Journal des événements')") && widget.includes('Voir tout le journal'), 'Bouton Journal complet absent');
ok(widget.includes('Aucune activité récente.'), 'État vide incorrect');
ok(widget.includes('recentActivityTarget(event, role)') && widget.includes('canOpenJournal'), 'Navigation ou permissions absentes');
ok(widget.includes("addEventListener('tos-terrain-data-updated'"), 'Rafraîchissement existant non réutilisé');
ok(main.includes('<RecentActivityWidget onNavigate={setActive} role={role}/>'), 'Widget réel non monté');
ok(!main.includes("getRows(dataStore,'Journal des événements')"), 'Ancienne source Dashboard encore utilisée');
ok(!widget.includes('Initialisation V0.6'), 'Fallback technique rendu dans le widget');

console.log(`Activité récente V1.1.5 : ${checks} contrôles réussis.`);
