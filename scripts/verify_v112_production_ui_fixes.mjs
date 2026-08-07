import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from 'esbuild';

let checks = 0;
const verify = (condition, message) => { assert.ok(condition, message); checks += 1; };
const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const terrainStatus = await readFile(new URL('../src/services/terrainSyncStatus.js', import.meta.url), 'utf8');
const paginationSource = await readFile(new URL('../src/components/GridPagination.jsx', import.meta.url), 'utf8');
const executablePagination = paginationSource
  .replace(/import React[^;]+;/, 'const React = globalThis.__V112_REACT__;')
  .replace(/import \{[^}]+\} from 'lucide-react';/, 'const ChevronLeft=()=>null, ChevronRight=()=>null, ChevronsLeft=()=>null, ChevronsRight=()=>null;');
const paginationTransform = await transform(executablePagination, { loader: 'jsx', format: 'esm' });
globalThis.__V112_REACT__ = React;
const { default: GridPagination } = await import(`data:text/javascript;base64,${Buffer.from(paginationTransform.code).toString('base64')}`);
delete globalThis.__V112_REACT__;
const renderedPagination = renderToStaticMarkup(React.createElement(GridPagination, {
  page: 2, pageCount: 250, pageSize: 50, total: 12486, selectedCount: 0,
  onPage() {}, onPageSize() {},
}));

for (const token of [
  'manifest.map(module => module.name)',
  'else content = <TableView name={active}',
  "Infrastructures: { table: 'infrastructures'",
  '<GridPagination page={currentPage}',
]) verify(main.includes(token), `Chemin de rendu Infrastructure incomplet : ${token}`);

for (const label of ['Première', 'Précédente', 'Suivante', 'Dernière', 'Lignes par page']) {
  verify(renderedPagination.includes(label), `Contrôle de pagination non rendu : ${label}`);
}
for (const token of ['sorted.slice(', 'total={sorted.length}']) {
  verify(main.includes(token), `Limitation ou total filtré absent : ${token}`);
}
for (const token of ['51–100', '12 486', '>25<', '>50<', '>100<', '>200<', 'aria-current="page"']) {
  verify(renderedPagination.includes(token), `Valeur de pagination non rendue : ${token}`);
}
verify(main.includes('useEffect(()=>setPage(1),[query,filters,sortState,pageSize,name])'), 'Les filtres et le tri doivent réinitialiser la page.');
verify(main.includes('downloadCSV(') && main.includes('downloadExcel(') && main.includes('downloadPDF('), 'Les exports existants doivent rester reliés.');
verify(styles.includes('.grid-pagination{display:grid'), 'La pagination doit être visible dans la feuille de styles de production.');
verify(!/Source\s*:\s*\{sourceLabel/.test(main), 'Le fournisseur technique reste affiché dans TableView.');

const componentNames = (await readdir(new URL('../src/components/', import.meta.url))).filter(name => name.endsWith('.jsx'));
for (const name of componentNames) {
  const source = await readFile(new URL(`../src/components/${name}`, import.meta.url), 'utf8');
  verify(!/>[^<{]*Supabase[^<{]*</i.test(source), `Texte Supabase directement rendu : ${name}`);
}

for (const token of ["from('terrain_sync_diagnostics')", "'attente'", "'erreur'", 'Dernière synchro', 'État global non centralisé']) {
  verify(terrainStatus.includes(token), `État Terrain non relié ou incomplet : ${token}`);
}
verify(main.includes('loadTerrainSyncStatus().then(setTerrainSyncStatus)'), 'Le tableau de bord ne charge pas la source Terrain réelle.');
verify(!main.includes("['Synchronisations Terrain',null"), 'Le KPI Terrain utilise encore une valeur nulle.');
verify(main.includes("['Synchronisations Terrain',terrainSyncStatus"), 'Le KPI Terrain doit toujours recevoir un état explicite.');

console.log(`V1.1.2 : ${checks} contrôles de production réussis.`);
