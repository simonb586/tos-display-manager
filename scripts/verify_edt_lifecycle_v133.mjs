import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { applyPhaseTransition, isLatestLifecycleRequest, phasesForEdt } from '../src/lib/edtLifecycle.js';

const edt = { id: 7, no_edt: 'EDT-TOS-01' };
const installation = { id: 11, edt_id: 7, phase_type: 'installation', statut: 'en_cours', date_debut_prevue: '2026-09-12' };
const removal = { id: 12, edt_id: 7, phase_type: 'retrait', statut: 'planifiee', date_debut_prevue: '2026-10-15' };

const one = phasesForEdt([installation], edt.id);
assert.equal(one.installation.id, 11);
assert.equal(one.retrait, null);
const both = phasesForEdt([installation, removal], edt.id);
assert.equal(both.installation.id, 11);
assert.equal(both.retrait.id, 12);

let changed = applyPhaseTransition([installation, removal], 11, 'terminee');
assert.equal(changed[0].statut, 'terminee');
assert.equal(changed[1].statut, 'planifiee', 'Compléter Installation ne modifie pas Retrait');
changed = applyPhaseTransition([{ ...installation, statut: 'fermee' }, { ...removal, statut: 'en_cours' }], 12, 'terminee');
assert.equal(changed[0].statut, 'fermee', 'Compléter Retrait ne modifie pas Installation');
assert.equal(changed[1].statut, 'terminee');
assert.equal(isLatestLifecycleRequest(1, 2), false, 'La réponse A est ignorée après sélection B');
assert.equal(isLatestLifecycleRequest(2, 2), true);

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { default: Panel } = await vite.ssrLoadModule('/src/components/EdtLifecyclePanel.jsx');
  const props = { edt, canManage: true, busy: false, run: async () => {}, onRetry: () => {} };
  const withPhases = phases => ({ ...props, data: { phases, phaseReports: [], campaigns: [], workOrders: [], history: [] } });
  const onlyInstallation = renderToStaticMarkup(React.createElement(Panel, withPhases([installation])));
  assert.match(onlyInstallation, /Installation/);
  assert.match(onlyInstallation, /Non planifié/);
  assert.match(onlyInstallation, /Planifier le retrait/);
  const twoCards = renderToStaticMarkup(React.createElement(Panel, withPhases([installation, removal])));
  assert.match(twoCards, /data-phase-type="installation"/);
  assert.match(twoCards, /data-phase-type="retrait"/);
  const legacy = renderToStaticMarkup(React.createElement(Panel, withPhases([])));
  assert.match(legacy, /Données legacy indisponibles/);
  const loading = renderToStaticMarkup(React.createElement(Panel, { ...withPhases([]), loading: true }));
  assert.match(loading, /Chargement du cycle de vie/);
  const error = renderToStaticMarkup(React.createElement(Panel, { ...withPhases([]), error: new Error('DB') }));
  assert.match(error, /Impossible de charger/);
  assert.match(error, /Réessayer/);
} finally {
  await vite.close();
}
console.log('V1.3.3 cycle EDT: 7 scénarios fonctionnels validés.');
