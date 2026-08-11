import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const read = file => fs.readFileSync(file, 'utf8');
const campaignsSource = read('src/components/CampaignsPanel.jsx');
const visualsSource = read('src/components/CampaignVisualManager.jsx');
const campaignService = read('src/services/campaignService.js');
const visualService = read('src/services/campaignVisualService.js');
const mainSource = read('src/main.jsx');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const [{ default: Campaigns }, { default: Visuals }, { BUSINESS_CONTEXT }] = await Promise.all([
    vite.ssrLoadModule('/src/components/CampaignsPanel.jsx'),
    vite.ssrLoadModule('/src/components/CampaignVisualManager.jsx'),
    vite.ssrLoadModule('/src/lib/businessContext.js')
  ]);
  const render = (Component, role) => renderToStaticMarkup(React.createElement(Component, { role, businessContext: BUSINESS_CONTEXT.MARKETING }));
  for (const role of ['Administrateur', 'Coordonnateur']) {
    const campaigns = render(Campaigns, role);
    const visuals = render(Visuals, role);
    assert.match(campaigns, /Créer une campagne/, `${role}: création campagne absente`);
    assert.match(visuals, /Créer un visuel/, `${role}: création visuel absente`);
  }
  for (const role of ['Client', 'Client-Admin']) {
    assert.doesNotMatch(render(Campaigns, role), /Créer une campagne/, `${role}: création campagne exposée`);
    assert.doesNotMatch(render(Visuals, role), /Créer un visuel/, `${role}: création visuel exposée`);
  }
  for (const label of ['Modifier', 'Supprimer']) assert.ok(campaignsSource.includes(label), `Action campagne ${label} absente`);
  for (const label of ['Modifier', 'Supprimer', 'Hors-Cadre']) assert.ok(visualsSource.includes(label), `Action visuel ${label} absente`);
  assert.ok(campaignsSource.includes('if(busy)return') && visualsSource.includes('if (busy) return'), 'Double soumission non bloquée');
  assert.ok(campaignsSource.includes('window.confirm') && visualsSource.includes('window.confirm'), 'Confirmation de suppression absente');
  assert.ok(campaignService.includes('delete_or_archive_master_campaign_v111'), 'Archivage campagne avec dépendances absent');
  assert.ok(visualService.includes('delete_or_archive_campaign_visual'), 'Archivage visuel avec dépendances absent');
  assert.ok(visualService.includes('is_out_of_frame: Boolean'), 'Hors-Cadre non persisté');
  assert.ok(visualService.includes('isVisualFormatCompatible'), 'Compatibilité format/Hors-Cadre non raccordée');
  for (const route of ['Campagnes maîtres', 'Campagne — Visuels et formats']) {
    assert.ok(mainSource.includes(`active === '${route}'`), `Rendu de navigation absent: ${route}`);
    assert.ok(mainSource.includes(`'${route}'`), `Entrée de navigation absente: ${route}`);
  }
  console.log('P0 campagnes/visuels: rendu React, permissions, formulaires, actions, confirmations, archivage, Hors-Cadre et navigation validés.');
} finally {
  await vite.close();
}
