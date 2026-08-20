import assert from 'node:assert/strict';
import fs from 'node:fs';
import manifest from '../src/data/manifest.json' with { type: 'json' };
import {
  CLIENT_PORTAL_EXPLICITLY_BLOCKED,
  CLIENT_PORTAL_ROLES,
  CLIENT_PORTAL_VIEW_REGISTRY,
  isClientPortalViewExplicitlyBlocked,
  isClientPortalViewSupported,
  normalizeClientPortalViewKey,
  resolveClientPortalViews
} from '../src/lib/clientPortalViewRegistry.js';
import { DEFAULT_ROLE_VISIBILITY } from '../src/services/roleVisibilityService.js';

const read = file => fs.readFileSync(file, 'utf8');
const fail = message => assert.fail(`CLIENT_PORTAL_VIEW_COVERAGE_FAIL:\n${message}`);

const configurableViews = manifest.map(item => item.name);
const supportedValues = new Set(CLIENT_PORTAL_VIEW_REGISTRY.flatMap(item => [item.label, ...(item.permissionKeys || []), ...(item.aliases || [])].map(normalizeClientPortalViewKey)));
const blockedValues = new Set(CLIENT_PORTAL_EXPLICITLY_BLOCKED.map(item => normalizeClientPortalViewKey(item.value)));

for (const role of CLIENT_PORTAL_ROLES) {
  const configured = DEFAULT_ROLE_VISIBILITY[role]?.visible_tables || [];
  const resolved = resolveClientPortalViews(configured);
  if (resolved.unknown.length) {
    fail(`${resolved.unknown.map(value => `"${value}" is permitted for ${role} but has no portal implementation.`).join('\n')}`);
  }
  if (!resolved.views.length && configured.length) fail(`${role} has configured views but none resolve to the portal registry.`);
}

for (const value of configurableViews) {
  const key = normalizeClientPortalViewKey(value);
  assert.ok(
    supportedValues.has(key) || blockedValues.has(key),
    `Configurable view "${value}" must be supported by clientPortalViewRegistry or explicitly blocked.`
  );
}

for (const required of ['Infrastructures','Répertoire des affiches',"Centres d'information",'C.I. avec enjeux','Liste des arrêts','Voitures / trains']) {
  assert.ok(isClientPortalViewSupported(required), `${required} must resolve for Client portal.`);
}

for (const blocked of CLIENT_PORTAL_EXPLICITLY_BLOCKED) {
  assert.ok(isClientPortalViewExplicitlyBlocked(blocked.value), `${blocked.value} must stay explicitly blocked.`);
}

const portal = read('src/components/ClientPortal.jsx');
const roleAdmin = read('src/components/RoleVisibilityAdmin.jsx');
const pkg = read('package.json');
assert.ok(!portal.includes('VIEW_NOT_IMPLEMENTED_FOR_CLIENT_PORTAL'), 'Client portal must not render VIEW_NOT_IMPLEMENTED_FOR_CLIENT_PORTAL.');
assert.match(roleAdmin, /Cette vue n’est pas encore disponible dans le portail Client/);
assert.match(pkg, /verify_client_portal_view_coverage_v1361/);

console.log(`V1.3.6.1 couverture portail Client OK: ${configurableViews.length} vues configurables, ${CLIENT_PORTAL_ROLES.length} rôles client, ${CLIENT_PORTAL_VIEW_REGISTRY.length} vues supportées, ${CLIENT_PORTAL_EXPLICITLY_BLOCKED.length} vues explicitement bloquées.`);
