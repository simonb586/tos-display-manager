import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUSINESS_CONTEXT } from '../src/lib/businessContext.js';
import { assignmentColumns, formatAssignmentCell, isLatestAssignmentRequest, mergeAssignmentPreferences } from '../src/lib/assignmentGrid.js';
import { duplicateLogicalRows, normalizeUniqueAssignments } from '../src/lib/siteSupportAssignments.js';
import { paginateRows, prepareRows } from '../src/services/siteSupportBusinessService.js';

const makeRows = (context, count) => normalizeUniqueAssignments(Array.from({ length: count }, (_, index) => ({
  id: index + 1, legacy_id: `legacy-${index + 1}`, site: `Site ${index % 7}`, support_id: `SUP-${index + 1}`,
  infrastructure_id: index + 100, campaign_id: index % 13, visual_id: index + 500,
  business_context: context, nom_campagne: `Campagne ${index}`, message: `Communication ${index}`,
  visuel_terrain: `Visuel ${index}`, statut_campagne: index % 2 === 0 ? 'Actif' : 'Inactif', statut: index % 2 === 0 ? 'Actif' : 'Inactif'
})));

function GridProbe({ rows, columns }) {
  return React.createElement('table', null, React.createElement('tbody', null, rows.map(row =>
    React.createElement('tr', { key: row.logical_key, 'data-row-key': row.logical_key }, columns.map(column =>
      React.createElement('td', { key: column.id }, column.formatter(column.accessor(row)))
    ))
  )));
}

for (const context of [BUSINESS_CONTEXT.MARKETING, BUSINESS_CONTEXT.OPERATIONAL]) {
  const source = makeRows(context, 1000);
  assert.equal(duplicateLogicalRows(source), 0);
  const definitions = assignmentColumns(context);
  for (let cycle = 0; cycle < 100; cycle += 1) {
    const searched = cycle % 2 ? 'Site' : '';
    const filtered = { statut: context === BUSINESS_CONTEXT.OPERATIONAL ? '' : undefined };
    const sorted = prepareRows(source, context, searched, filtered, { column: 'support_id', direction: cycle % 2 ? 'asc' : 'desc', type: 'identifier' });
    const page = paginateRows(sorted, cycle % 10 + 1, 25);
    const html = renderToStaticMarkup(React.createElement(GridProbe, { rows: page.rows, columns: definitions }));
    assert.equal(page.rows.length, 25, `cycle ${cycle}: pagination stable`);
    assert.equal((html.match(/<tr/g) || []).length, 25, `cycle ${cycle}: rendu stable`);
    for (const row of page.rows) { assert.ok(html.includes(formatAssignmentCell('support_id', row.support_id))); assert.ok(html.includes(row.logical_key)); }
  }
}

const defs = assignmentColumns(BUSINESS_CONTEXT.MARKETING);
for (const saved of [null, { order: defs.map(c => c.id) }, { order: ['support_id', 'id'], widths: { id: 180 } }, { order: ['ancienne_colonne', 'id'], widths: { ancienne_colonne: 99, id: 'bad' } }, { order: ['id', 'id'] }]) {
  const merged = mergeAssignmentPreferences(defs, saved);
  assert.ok(merged.columns.length > 0);
  assert.ok(merged.columns.every(column => typeof column.accessor === 'function'));
}

let currentRequest = 1;
const a = new AbortController();
const b = new AbortController();
const slowA = new Promise(resolve => setTimeout(() => resolve({ requestId: 1, signal: a.signal, value: 'A' }), 20));
currentRequest = 2; a.abort();
const fastB = Promise.resolve({ requestId: 2, signal: b.signal, value: 'B' });
let committed = null;
for (const response of [await fastB, await slowA]) if (isLatestAssignmentRequest(response.requestId, currentRequest, response.signal)) committed = response.value;
assert.equal(committed, 'B', 'La requête B rapide gagne et A obsolète ne remplace pas B');

for (const count of [100, 1000, 10000]) { const rows = makeRows(BUSINESS_CONTEXT.MARKETING, count); assert.equal(rows.length, count); assert.equal(duplicateLogicalRows(rows), 0); }
assert.equal(formatAssignmentCell('value', 0), '0');
assert.equal(formatAssignmentCell('value', false), 'false');
assert.equal(formatAssignmentCell('value', null), '—');
console.log('V1.2.5: 100 cycles React par grille, préférences, clés, 10 000 lignes et race A/B validés.');
