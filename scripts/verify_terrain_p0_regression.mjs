import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const main = read('src/main.jsx');
const shell = read('src/components/InstallerTerrainShell.jsx');
const terrain = read('src/components/TerrainApp.jsx');
const service = read('src/services/terrainService.js');
const photoService = read('src/services/photoWorkflowService.js');
const photoModel = read('src/lib/photoWorkflow.js');
let checks = 0;
const match = (value, pattern, message) => { assert.match(value, pattern, message); checks += 1; };

match(main, /role === 'Installateur'[\s\S]*<InstallerTerrainShell/, 'Shell installateur non monté.');
match(shell, /<TerrainApp[\s\S]*dataStore=\{dataStore\}/, 'TerrainApp absent du shell.');
match(terrain, /visualRequestRef\.current/, 'Protection Support A vers B absente.');
match(terrain, /requestId !== visualRequestRef\.current/, 'Réponse visuel obsolète non rejetée.');
match(terrain, /action === 'installation'/, 'Contexte installation absent.');
match(terrain, /option value="enjeu"/, 'Action enjeu absente.');
match(service, /finaliser_installation_terrain_v01210/, 'RPC installation active absente.');
match(service, /finaliser_intervention_terrain_v1342/, 'RPC intervention sécurisée active absente.');
match(service, /p_idempotency_key/, 'Idempotence serveur absente.');
match(photoModel, /capturedAt:date\.toISOString\(\)/, 'Timestamp photo automatique absent.');
match(photoService, /upsert:false/, 'Upload immuable absent.');
match(photoService, /rollbackUploadedPhoto/, 'Rollback Storage absent.');
assert.doesNotMatch(terrain, /datetime-local|capture="environment"/); checks += 1;
assert.doesNotMatch(terrain + service, /service_role/i); checks += 1;
console.log(`Régression Terrain P0 : ${checks} invariants réussis.`);
