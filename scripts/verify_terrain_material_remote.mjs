import fs from 'node:fs';
import assert from 'node:assert/strict';
import {managementQuery} from './targeted_management_access.mjs';
const applied=process.argv.includes('--applied');
const migration=applied?'':fs.readFileSync('supabase/migrations/20260925211601_terrain_material_auto_resolution.sql','utf8');
const tests=fs.readFileSync('scripts/fixtures/terrain-material-remote.sql','utf8');
const result=await managementQuery(`BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='45s';${migration}\n${tests}
 SELECT 'PASS' result;ROLLBACK;`);
assert(result.some(r=>r.result==='PASS'));
const totals=await managementQuery(`BEGIN;SET LOCAL statement_timeout='30s';${migration}
 SELECT status,count(*)::int count FROM (SELECT tdm_private.resolve_material(v.id)->>'status' status FROM public.campagne_visuels_formats v) results GROUP BY status;ROLLBACK;`);
const reportedCase=await managementQuery(`BEGIN;SET LOCAL statement_timeout='30s';${migration}
 SELECT i.support_id,e.no_edt,v.nom_visuel,v.format_support,
 tdm_private.resolve_material(v.id,i.support_id,p.id) resolution
 FROM public.infrastructures i CROSS JOIN public.suivi_des_edt e
 JOIN public.edt_phases p ON p.edt_id=e.id AND p.phase_type='installation'
 JOIN public.visual_edt_associations a ON a.phase_id=p.id
 JOIN public.campagne_visuels_formats v ON v.id=a.visual_id
 WHERE lower(replace(i.support_id,' ',''))='ha-78904-02' AND lower(e.no_edt)='edt-tos-73-h';ROLLBACK;`);
const remaining=await managementQuery("select count(*)::int count from public.infrastructures where support_id like 'MATERIAL-TEST-%'");assert.equal(remaining[0].count,0);
fs.mkdirSync('.cache/terrain-material',{recursive:true});fs.writeFileSync(`.cache/terrain-material/remote-${applied?'applied':'rollback'}.json`,JSON.stringify({at:new Date().toISOString(),result:'PASS',tests:'Installer: no match, unique, ambiguity, medium, direct EDT ID, canonical EDT/no-EDT finalization, persisted article ID, retry, zero stock rollback, role denial',catalogResolution:totals,reportedCase,fixturesRemaining:0},null,2));
console.log('PASS: remote transaction rolled back, Installer workflows and stock idempotence; catalog resolution '+JSON.stringify(totals));
