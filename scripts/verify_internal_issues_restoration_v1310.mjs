import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
const { mergeInternalIssues, normalizeHistoricalIssue, normalizeTerrainIssue }=await vite.ssrLoadModule('/src/services/internalIssuesService.js');

const historical=JSON.parse(fs.readFileSync('src/data/enjeux_des_cadres_et_supports.json','utf8'));
assert.equal(historical.length,104,'104 enjeux historiques conservés');
assert.deepEqual(historical.reduce((counts,row)=>({...counts,[row.Statut]:(counts[row.Statut]||0)+1}),{}),{Actif:36,Inactif:68},'statuts historiques inchangés');

const normalized=historical.map(normalizeHistoricalIssue);
assert.equal(mergeInternalIssues(historical,[]).length,104,'aucun doublon métier historique exact supprimé');
assert.ok(normalized.every(row=>row.source==='Historique'),'badge source historique');
assert.ok(normalized.every(row=>row.support_id===String(row['#Du cadre']).trim()),'no_cadre utilisé lorsque related_support est vide');
assert.equal(new Set(normalized.map(row=>row.support_id)).size,102,'deux supports portent chacun deux enjeux historiques');

const terrain=Array.from({length:8},(_,index)=>({id:index+1,support_id:`TERRAIN-${index+1}`,type_enjeu:'Terrain',statut:'Ouvert',created_at:`2026-07-${String(index+1).padStart(2,'0')}`}));
assert.equal(new Set(mergeInternalIssues(historical,terrain).map(row=>row.id)).size,112,'identifiants UI uniques entre les sources');
assert.equal(mergeInternalIssues(historical,terrain).length,112,'104 historiques + 8 Terrain distincts');
assert.equal(mergeInternalIssues(historical,[terrain[0],terrain[0]]).filter(row=>row.source==='Terrain').length,1,'doublon métier strict non artificiel');
assert.equal(normalizeTerrainIssue(terrain[0]).source,'Terrain','badge source Terrain');

const main=fs.readFileSync('src/main.jsx','utf8');
const service=fs.readFileSync('src/services/internalIssuesService.js','utf8');
assert.match(main,/table: 'enjeux_des_cadres_et_supports', loader: loadInternalIssues/,'source historique principale et fusion logique');
assert.match(main,/readOnly: true/,'grille logique protégée contre les écritures multi-tables');
assert.match(main,/config\.cacheTables \|\| \[config\.table\]/,'rafraîchissement des deux sources');
assert.match(service,/loadTable\('enjeux_terrain'/,'enjeux Terrain conservés');
assert.doesNotMatch(service,/\.insert\(|\.update\(|\.delete\(/,'service strictement read-only');
await vite.close();
console.log('Restauration Enjeux : 104 historiques, statuts 36/68, fusion Terrain et déduplication stricte PASS.');
