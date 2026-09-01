import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOS_VIEW_TEMPLATES, mergeSystemTemplates } from '../src/config/tosConfigurationTemplates.js';
import { APP_TITLE, businessFieldLabel, friendlyError, UI_LABELS } from '../src/config/businessLanguage.js';

assert.equal(APP_TITLE, 'TOS Display Manager');
assert.equal(UI_LABELS.sourceModule, 'Les données proviennent de');
assert.equal(UI_LABELS.destinationModule, 'Afficher les données dans');
assert.equal(businessFieldLabel('support_id'), 'Numéro du support');
assert.equal(businessFieldLabel('completed_at'), 'Date de fin');
assert.equal(TOS_VIEW_TEMPLATES.length, 10);
assert.ok(TOS_VIEW_TEMPLATES.every(item => item.status === 'draft' && item.isSystemTemplate));
assert.equal(new Set(TOS_VIEW_TEMPLATES.map(item => item.id)).size, 10);

const once = mergeSystemTemplates([], TOS_VIEW_TEMPLATES);
const twice = mergeSystemTemplates(once, TOS_VIEW_TEMPLATES);
assert.equal(once.length, 10);
assert.equal(twice.length, 10, 'Le pack de vues doit être idempotent.');
assert.equal(friendlyError({ message: 'new row violates row level security' }), 'Vous ne possédez pas les autorisations nécessaires pour effectuer cette action.');
assert.ok(!friendlyError({ message: 'PGRST202 RPC missing' }).match(/PGRST|RPC/i));

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /<title>TOS Display Manager<\/title>/);
assert.doesNotMatch(index, /v\d|preview|localhost|vite/i);

const assistant = await readFile(new URL('../src/components/AutomationAssistant.jsx', import.meta.url), 'utf8');
assert.match(assistant, /Automatisations/);
assert.match(assistant, /Vues entre les tables/);
assert.match(assistant, /UI_LABELS\.advancedSection/);
assert.doesNotMatch(assistant, /Relations métier['"]\s*,|Mode avancé/);

const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(main, /Assistant d’automatisation/);
assert.doesNotMatch(main, /ColumnRelationMenu/);
assert.match(main, /ServiceConfigurationError/);

const photoService = await readFile(new URL('../src/services/photoLibraryService.js', import.meta.url), 'utf8');
for (const requirement of ['storage.from', 'support_photos', 'setInfrastructurePrimary', 'photo_action_log', 'tos-photo-deleted']) {
  assert.ok(photoService.includes(requirement), `Suppression photo incomplète : ${requirement}`);
}

console.log('Bloc 13.2 : 27 contrôles réussis.');
