import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/stabilization-local/certification';
const read=name=>JSON.parse(fs.readFileSync(`${dir}/${name}.json`,'utf8').replace(/^\uFEFF/,''));
const controls=read('controls-197'),forms=read('forms-29'),views=read('views-35'),refresh=read('refresh-13'),groups=read('control-groups');
const allowed=new Set(['PASS_LOCAL','REMOTE_VALIDATION_REQUIRED','N/A_JUSTIFIED','FAIL']);
assert.deepEqual(controls.map(r=>r.CONTROL_ID),read('closure-critical-controls-baseline').map(r=>r.CONTROL_ID));
assert.deepEqual(forms.map(r=>r.FORM_ID),read('closure-forms-29-baseline').map(r=>r.FORM_ID));
assert.deepEqual(views.map(r=>r.VIEW),read('closure-admin-parity-35-baseline').map(r=>r.VIEW));
assert.deepEqual(refresh.map(r=>r.COMPONENT),read('closure-refresh-13-baseline').map(r=>r.COMPONENT));
for(const row of [...controls,...forms,...views]){
 assert.ok(allowed.has(row.RESULT),row.RESULT);
 if(row.RESULT==='N/A_JUSTIFIED')assert.ok(row.JUSTIFICATION);
 if(row.RESULT==='FAIL')assert.ok(row.TEST_REQUIRED||row.FAIL_REASON);
 for(const file of row.EVIDENCE||[])assert.ok(fs.existsSync(file),'Missing '+file);
}
for(const row of forms)if(row.RESULT==='PASS_LOCAL')for(const axis of Object.values(row.AXES))assert.ok(['PASS_LOCAL','N/A_JUSTIFIED'].includes(axis.result));
for(const row of controls)if(row.FORM_ID)assert.equal(row.RESULT,forms.find(f=>f.FORM_ID===row.FORM_ID).RESULT);
const grouped=groups.flatMap(g=>g.CONTROL_IDS);assert.equal(grouped.length,197);assert.equal(new Set(grouped).size,197);
for(const group of groups)for(const id of group.CONTROL_IDS)assert.equal(controls.find(r=>r.CONTROL_ID===id).GROUP_KEY,group.GROUP_KEY);
const strict=fs.existsSync(dir+'/strict/resolutions.json');assert.equal(views.filter(r=>r.RESULT==='N/A_JUSTIFIED').length,strict?17:7);
assert.ok(refresh.every(r=>r.RESULT==='CERTIFIED_LOCAL'&&r.STATES.length===7));
const required=read('remaining-lines');assert.equal(required.length,[...controls,...forms,...views].filter(r=>r.RESULT==='FAIL').length);
if(required.length)assert.equal(read('summary').verdict,'NO-GO','Local failures prohibit READY');else{assert.ok(strict);assert.ok(['LOCAL_CHECKS_PENDING','READY WITH REMOTE VALIDATION REQUIRED'].includes(read('summary').verdict));assert.equal(read('strict/resolutions').controls.length,104);}
fs.writeFileSync(`${dir}/classification-check.json`,JSON.stringify({date:new Date().toISOString(),result:'PASS',controls:197,forms:29,views:35,refresh:13,groups:groups.length,remainingReferences:required.length,meaning:'Schema, frozen identities, group consistency and absence of falsely promoted FAIL axes; not a runtime pass for remaining lines.'},null,2));
console.log('197 controls, 29 forms, 35 views, 13 refresh records reconciled; exact remaining references reconciled.');
