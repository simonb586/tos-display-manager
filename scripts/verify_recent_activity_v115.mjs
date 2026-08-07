import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  ACTIVITY_TIMEZONE, activityObjectLabel, canAccessActivityDestination, formatActivityDate, formatActivityLabel,
  isRecentBusinessActivity, prepareRecentBusinessActivity, RECENT_ACTIVITY_LIMIT, recentActivityTarget,
  resolveActivityDestination
} from '../src/lib/recentActivity.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks += 1; };

const events = Array.from({ length: 15 }, (_, index) => ({ id: String(index + 1), occurred_at: `2026-08-07T${String(index + 1).padStart(2, '0')}:00:00Z`, action: 'photo_ajoutee', module: 'Photos', support_id: `CODEX-PREVIEW-TEST-1784857411641-${index}`, actor_email: 'adresse.utilisateur.extremement.longue@example.com', status: 'Validée' }));
const recent = prepareRecentBusinessActivity(events);
equal(RECENT_ACTIVITY_LIMIT, 10); equal(recent.length, 10); equal(recent[0].id, '15'); equal(recent.at(-1).id, '6');
ok(recent.every((row, index) => index === 0 || row.occurred_at <= recent[index - 1].occurred_at), 'Tri récent vers ancien incorrect');
const initialization = { id: 'technical', occurred_at: '2026-08-07T23:59:00Z', action: 'Initialisation V0.6', module: 'Système' };
equal(isRecentBusinessActivity(initialization), false); equal(prepareRecentBusinessActivity([...events, initialization]).some(row => row.id === 'technical'), false);

equal(formatActivityLabel({ action: 'INSERT' }), 'Création');
equal(formatActivityLabel({ action: 'INSERT', entity_type: 'client' }), 'Client créé');
equal(formatActivityLabel({ action: 'SUPPRESSION' }), 'Suppression');
equal(formatActivityLabel({ action: 'photo_ajoutee' }), 'Photo ajoutée');
equal(formatActivityLabel({ action: 'sync_success' }), 'Synchronisation Terrain réussie');
equal(activityObjectLabel(events[0]), `Support ${events[0].support_id}`);

const now = new Date('2026-08-07T20:00:00Z');
equal(ACTIVITY_TIMEZONE, 'America/Toronto');
equal(formatActivityDate('2026-08-07T18:08:00Z', now), 'Aujourd’hui 14:08');
equal(formatActivityDate('2026-08-06T21:24:00Z', now), 'Hier 17:24');
equal(formatActivityDate('2026-07-24T13:04:00Z', now), '24 juill 09:04');

const routeCases = [
  [{ action: 'sync_success', module: 'Terrain', support_id: 'HA4 70059' }, 'Diagnostic terrain'],
  [{ action: 'resolved', source_system: 'terrain_sync_diagnostics', support_id: '1' }, 'Diagnostic terrain'],
  [{ action: 'Infrastructure modifiée', module: 'Infrastructures', support_id: '1' }, 'Infrastructures'],
  [{ action: 'photo_ajoutee', support_id: '1' }, 'Photos'],
  [{ action: 'inspection_completed', support_id: '1' }, 'Infrastructures'],
  [{ action: 'installation_started', support_id: '1' }, 'Suivi des EDT'],
  [{ action: 'issue_created' }, 'Enjeux des cadres et supports'],
  [{ action: 'campaign_updated' }, 'Campagnes maîtres'],
  [{ action: 'visual_created' }, 'Campagne — Visuels et formats'],
  [{ action: 'report_generated' }, 'Rapports finaux'],
  [{ action: 'événement inconnu', support_id: '1' }, null]
];
for (const [event, expected] of routeCases) equal(resolveActivityDestination(event), expected, `Destination incorrecte pour ${event.action}`);
equal(recentActivityTarget(routeCases[0][0], 'Coordonnateur'), 'Diagnostic terrain');
equal(recentActivityTarget(routeCases[0][0], 'Client'), null);
equal(recentActivityTarget({ action: 'photo_ajoutee' }, 'Client', { visible_tables: [] }), null);
equal(recentActivityTarget({ action: 'Infrastructure modifiée', support_id: '1' }, 'Client', { visible_tables: ['Photos'] }), null);
equal(canAccessActivityDestination('Gestionnaire des champs', 'Coordonnateur'), false);

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { ActivityEvent } = await vite.ssrLoadModule('/src/components/RecentActivityWidget.jsx');
  const clickable = renderToStaticMarkup(React.createElement(ActivityEvent, { event: events[0], role: 'Administrateur', permission: { visible_tables: ['*'] }, onNavigate() {} }));
  const unknown = renderToStaticMarkup(React.createElement(ActivityEvent, { event: { id: 'x', occurred_at: events[0].occurred_at, action: 'mystery', actor_email: events[0].actor_email }, role: 'Administrateur', permission: { visible_tables: ['*'] }, onNavigate() {} }));
  for (const className of ['activity-event', 'activity-event-title', 'activity-event-object', 'activity-event-details', 'activity-event-date']) ok(clickable.includes(className), `Conteneur rendu absent: ${className}`);
  ok(clickable.includes('<button') && clickable.includes('aria-label='), 'Interaction accessible absente');
  ok(clickable.includes(events[0].support_id) && clickable.includes(events[0].actor_email), 'Textes longs absents du HTML rendu');
  ok(unknown.includes('activity-event-row') && !unknown.includes('<button'), 'Événement inconnu rendu cliquable');
} finally { await vite.close(); }

const css = fs.readFileSync('src/features/v13/recent-activity.css', 'utf8');
const widget = fs.readFileSync('src/components/RecentActivityWidget.jsx', 'utf8');
const service = fs.readFileSync('src/services/activityLogService.js', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
ok(css.includes('.executive-activity .activity-event{display:block') && !css.includes('position:absolute'), 'Flux naturel non garanti');
ok(css.includes('overflow-wrap:anywhere') && css.includes('min-width:0'), 'Protection des textes longs absente');
ok(css.includes('@media(max-width:600px)') && css.includes('grid-column:2'), 'Responsive mobile absent');
ok(service.includes('.limit(RECENT_ACTIVITY_LIMIT)') && service.includes("request.not('action', 'ilike', pattern)"), 'Limite ou exclusion serveur absente');
ok(widget.includes('Voir tout le journal') && widget.includes("onNavigate('Journal des événements')"), 'Bouton Journal absent');
ok(main.includes('permission={rolePermission}') && main.includes('<ActivityJournal role={role}/>'), 'Permissions ou Journal non intégrés');

console.log(`Activité récente V1.1.5B : ${checks} contrôles réussis, rendu React vérifié.`);
