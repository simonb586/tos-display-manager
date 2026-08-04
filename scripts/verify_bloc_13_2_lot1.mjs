import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync('src/main.jsx','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
for(const marker of ['GridPagination','Première page','Page précédente','Page suivante','Dernière page','Lignes par page','selectedRows','pageSize','pageCount'])assert.ok(main.includes(marker),marker);
assert.match(main,/\[25,50,100,200\]/);
assert.match(main,/sorted\.slice\(\(currentPage-1\)\*pageSize,currentPage\*pageSize\)/);
assert.match(main,/CSV \{hasMapColumn\?'page visible'/);
assert.match(main,/Excel sélection/);
assert.match(main,/PDF ensemble filtré/);
for(const metric of ['Supports actifs','Campagnes actives','Installations prévues','Inspections','Enjeux ouverts','Travaux urgents','Synchronisations Terrain','Photos manquantes'])assert.ok(main.includes(metric),metric);
assert.match(main,/value==null\?'Non disponible'/);
for(const marker of ['executive-dashboard','executive-kpis','grid-pagination','@media(max-width:760px)'])assert.ok(css.includes(marker),marker);
console.log('Bloc 13.2 Lot 1 : shell, dashboard réel, responsive et pagination Infrastructure validés.');
