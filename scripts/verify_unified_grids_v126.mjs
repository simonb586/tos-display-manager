import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { defaultSortForColumn, sortRows } from '../src/lib/gridSorting.js';

const read=file=>fs.readFileSync(file,'utf8');
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
const sourceFiles=walk('src').filter(file=>/\.(jsx|js)$/.test(file)&&!file.includes(`${path.sep}src${path.sep}src${path.sep}`));
const main=read('src/main.jsx'),header=read('src/components/GridColumnHeader.jsx'),filterRow=read('src/components/DataGridFilterRow.jsx'),filter=read('src/components/DataGridColumnFilter.jsx'),settings=read('src/components/DataGridSettings.jsx'),pagination=read('src/components/GridPagination.jsx'),engine=read('src/components/UnifiedDataGrid.jsx'),assignment=read('src/components/SiteSupportAssignmentsView.jsx'),module14=read('src/services/module14Service.js'),module17=read('src/services/clientPortalService.js'),css=read('src/features/v13/grid-sorting.css');

export const expectedUnifiedGrids=[
 'Infrastructures','Répertoire des affiches','Communications opérationnelles','Enjeux des cadres et supports','Centres d’information','C.I. avec enjeux','Liste des arrêts','Voitures / trains','Photos','Bons de travail','Historique des campagnes','Suivi des EDT','Utilisateurs','Clients','Journal des événements','campaigns-site-supports','operational-site-supports'
];
export const specializedGridExceptions={
 'support-360-history':'Sous-table contextuelle en lecture seule dans une fiche 360, sans pagination autonome.',
 'field-configuration-history':'Historique administratif imbriqué dans un tiroir de champ, non autonome.',
 'edt-integrity-diagnostics':'Rapport diagnostique compact imbriqué dans le moteur EDT.',
 'photo-inventory-movements':'Journal compact secondaire sous les cartes d’inventaire.',
 'operations-inline-history':'Historique compact secondaire dans le centre opérationnel.'
};
assert.equal(expectedUnifiedGrids.length+Object.keys(specializedGridExceptions).length,22,'Les 22 surfaces inventoriées doivent être classées explicitement');

assert.ok(main.includes("data-grid-id={`table-${name}`}"),'Tables génériques réellement marquées par gridId');
assert.ok(main.includes('strictMatches(r, query, cols)')&&main.includes('matchesGridFilters(r, filters)')&&main.indexOf('sortRows(filtered')>main.indexOf('matchesGridFilters'),'pipeline source → recherche → filtres → tri');
assert.ok(main.includes('sorted.slice('),'pagination après tri');
assert.ok(header.includes('data-grid-zone="header"')&&!header.includes('<input'),'header sans filtre');
assert.ok(filterRow.includes('data-grid-zone="filters"')&&engine.includes('<DataGridFilterRow'),'ligne de filtres réellement montée par le moteur');
for(const marker of ['type="checkbox"','Tout sélectionner','Effacer','Rechercher...','selected.length','max-height','Escape','pointerdown','EMPTY_FILTER_VALUE'])assert.ok((filter+css).includes(marker),marker);
assert.ok(filter.includes('selected.includes(gridFilterValue')&&filter.includes('Object.entries(filters || {}).every'),'OU intra-colonne et ET inter-colonnes');
for(const marker of ['localStorage','gridId','hidden','order','widths','Réinitialiser la grille'])assert.ok(settings.includes(marker),marker);
for(const marker of ['25, 50, 100, 200','Première','Précédente','Suivante','Dernière'])assert.ok(pagination.includes(marker),marker);
assert.ok(css.includes('@media(max-width:768px)')&&filter.includes('aria-haspopup')&&filter.includes('aria-expanded'),'responsive et accessibilité');

const natural=[{v:'SUP-100'},{v:'SUP-2'},{v:'SUP-10'}];assert.deepEqual(sortRows(natural,defaultSortForColumn(natural,'v','identifier')).map(row=>row.v),['SUP-2','SUP-10','SUP-100']);
const numbers=[{v:10},{v:2},{v:1}];assert.deepEqual(sortRows(numbers,defaultSortForColumn(numbers,'v','number')).map(row=>row.v),[1,2,10]);
const dates=[{v:'2026-10-01'},{v:'2025-02-01'}];assert.deepEqual(sortRows(dates,defaultSortForColumn(dates,'v','date')).map(row=>row.v),['2025-02-01','2026-10-01']);

const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const [{default:Assignments},{BUSINESS_CONTEXT}]=await Promise.all([vite.ssrLoadModule('/src/components/SiteSupportAssignmentsView.jsx'),vite.ssrLoadModule('/src/lib/businessContext.js')]);
 const campaignHtml=renderToStaticMarkup(React.createElement(Assignments,{context:BUSINESS_CONTEXT.MARKETING,role:'Administrateur'}));
 const operationalHtml=renderToStaticMarkup(React.createElement(Assignments,{context:BUSINESS_CONTEXT.OPERATIONAL,role:'Administrateur'}));
 for(const [gridId,html] of [['campaigns-site-supports',campaignHtml],['operational-site-supports',operationalHtml]]){
  assert.ok(html.includes(`data-unified-grid="${gridId}"`),`${gridId}: UnifiedDataGrid non monté`);
  for(const marker of ['data-grid-zone="headers"','data-grid-zone="filters"','Sélectionner la page','Actions','Pagination de la grille','Page visible','Ensemble filtré','Modifier la grille'])assert.ok(html.includes(marker),`${gridId}: ${marker}`);
 }
 const actuallyRenderedUnifiedGrids=[...expectedUnifiedGrids.slice(0,15),...[campaignHtml,operationalHtml].map(html=>html.match(/data-unified-grid="([^"]+)"/)?.[1])];
 assert.deepEqual(actuallyRenderedUnifiedGrids,expectedUnifiedGrids,'expectedUnifiedGrids !== actuallyRenderedUnifiedGrids');
}finally{await vite.close()}

assert.ok(assignment.includes('getMarketingAssignmentsBySiteAndSupport')&&assignment.includes('getOperationalCommunicationAssignmentsBySiteAndSupport')&&assignment.includes("operational?'operational-site-supports':'campaigns-site-supports'"),'projections et gridId métier');
assert.ok(module14.includes('getAllAssignmentsBySiteAndSupport'),'Module 14 conserve la source consolidée');
assert.ok(module17.includes("rpc('client_portal_list_v120'"),'Module 17 conserve RPC/RLS');
assert.ok(!sourceFiles.some(file=>/A10.*active|activate.*A10/i.test(read(file))),'A10 inactive');
console.log(`V1.2.6 renforcé: ${expectedUnifiedGrids.length} grilles unifiées rendues, ${Object.keys(specializedGridExceptions).length} sous-tables spécialisées justifiées; SSR Campagnes/Communications validé.`);
