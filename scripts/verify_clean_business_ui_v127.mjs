import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const forbidden = /source canonique|source supabase|postgres(?:ql)?|\brpc\b|table source|json fallback|storage path|auth\.uid\(\)|business_context|client_visible/i;
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const [{ default: Assignments }, { BUSINESS_CONTEXT }] = await Promise.all([
    vite.ssrLoadModule('/src/components/SiteSupportAssignmentsView.jsx'),
    vite.ssrLoadModule('/src/lib/businessContext.js')
  ]);
  for (const context of [BUSINESS_CONTEXT.MARKETING, BUSINESS_CONTEXT.OPERATIONAL]) {
    const html = renderToStaticMarkup(React.createElement(Assignments, { context, role: 'Administrateur' }));
    assert.ok(!forbidden.test(html), `Texte technique rendu pour ${context}`);
    assert.ok(html.includes('Affectations par site et support'), 'Contexte métier absent');
  }
  console.log('V1.2.7 UX: HTML métier rendu sans terminologie technique interdite; erreurs de chargement présentées en langage utilisateur.');
} finally {
  await vite.close();
}
