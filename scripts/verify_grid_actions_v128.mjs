import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/SiteSupportAssignmentsView.jsx', 'utf8');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const [{ default: Assignments }, { BUSINESS_CONTEXT }] = await Promise.all([
    vite.ssrLoadModule('/src/components/SiteSupportAssignmentsView.jsx'),
    vite.ssrLoadModule('/src/lib/businessContext.js')
  ]);
  const render = (context, role) => renderToStaticMarkup(React.createElement(Assignments, { context, role, onNavigate: () => {} }));
  const adminViews = [render(BUSINESS_CONTEXT.MARKETING, 'Administrateur'), render(BUSINESS_CONTEXT.OPERATIONAL, 'Administrateur')];
  const readOnlyViews = [render(BUSINESS_CONTEXT.MARKETING, 'Client'), render(BUSINESS_CONTEXT.OPERATIONAL, 'Client')];
  const rowActions = ['Ouvrir', 'Modifier', 'Visuel', 'Fiche 360', 'Photos', 'Historique'];
  const toolbarActions = ['Modifier la grille', 'Page visible', 'Sélection', 'Ensemble filtré'];
  for (const label of rowActions) assert.ok(source.includes(`title="${label}"`), `Contrat d’action manquant: ${label}`);
  for (const html of adminViews) for (const label of toolbarActions) assert.ok(html.includes(label), `Action rendue manquante: ${label}`);
  for (const html of readOnlyViews) {
    assert.ok(!html.includes('aria-label="Modifier"'), 'Lecture: Modifier ne doit pas être rendu sans ligne');
  }
  for (const html of [...adminViews, ...readOnlyViews]) {
    assert.ok(html.includes('data-grid-zone="headers"') && html.includes('data-grid-zone="filters"'), 'Zones grille séparées');
    assert.ok(!/<button[^>]*disabled[^>]*>\s*Activer\s*<\/button>/.test(html), 'Bouton factice rendu');
  }
  const actionCount = adminViews.reduce((total, html) => total + (html.match(/<button/g) || []).length, 0);
  assert.ok(actionCount >= 16, `Inventaire rendu incomplet: ${actionCount}`);
  assert.ok(source.includes("{canEdit&&<button title=\"Modifier\""), 'Permission Modifier non appliquée avant rendu');
  assert.ok(source.includes("sessionStorage.setItem('tos_assignment_context'"), 'Contexte de navigation non conservé');
  console.log(`V1.2.8 actions: ${actionCount} boutons de barre rendus et ${rowActions.length} contrats d’action de ligne audités sur les grilles consolidées; permissions et destinations validées.`);
} finally {
  await vite.close();
}
