import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterSupportOperations, filterSupportPhotos } from '../src/lib/supportNavigationContext.js';

const read = path => fs.readFileSync(path,'utf8');
const data={
  edts:[{id:1},{id:2},{id:3}],
  edtSupports:[{edt_id:1,support_id:'A'},{edt_id:2,support_id:'A'},{edt_id:3,support_id:'B'}],
  workOrders:[{id:1,edt_id:1,support_id:'A'},{id:2,edt_id:2},{id:3,edt_id:3,support_id:'B'}],
  requests:[{id:1,support_id:'A'},{id:2,support_id:'B'}],
  history:[{id:1,support_id:'A'},{id:2,edt_id:2},{id:3,support_id:'B'}]
};
assert.deepEqual(filterSupportPhotos([{id:1,support_id:'A'},{id:2,support_id:'B'}],'A').map(x=>x.id),[1]);
assert.deepEqual(filterSupportPhotos([],'A'),[]);
const scoped=filterSupportOperations(data,'A');
assert.deepEqual(scoped.edts.map(x=>x.id),[1,2]);
assert.deepEqual(scoped.workOrders.map(x=>x.id),[1,2]);
assert.deepEqual(scoped.requests.map(x=>x.id),[1]);
assert.deepEqual(scoped.history.map(x=>x.id),[1,2]);
assert.deepEqual(filterSupportOperations({...data,edtSupports:[]},'Z').edts,[]);

const edt=read('src/components/EdtLifecyclePanel.jsx');
assert.doesNotMatch(edt,/if\(action==='fermer'\)[\s\S]{0,250}window\.prompt/);
assert.match(edt,/transitionEdtPhase\(phase\.id,action/);
const map=read('src/components/InteractiveMap.jsx');
for(const marker of ["open360:true","{supportId:selected.supportId}","Ouvrir / Fiche 360","EDT / Travaux","Historique"])assert.ok(map.includes(marker),marker);
const automationUi=read('src/components/AutomationAssistant.jsx');
const templates=read('src/config/tosConfigurationTemplates.js');
assert.doesNotMatch(automationUi,/TOS_AUTOMATION_TEMPLATES/);
assert.match(automationUi,/const allRows=useMemo\(\(\)=>\(rows\|\|\[\]\)\.map/);
assert.doesNotMatch(templates,/Installation d’un visuel|TOS_AUTOMATION_TEMPLATES/);
assert.match(automationUi,/definition\?\.system_template===true/);
const seed=read('supabase/migrations/20260901170000_seed_tos_automation_templates_v139.sql');
assert.equal((seed.match(/'13900000-0000-4000-8000-0000000000\d\d'::uuid,/g)||[]).length,15);
assert.match(seed,/'active','normal'/);
assert.match(seed,/system_template',true/);
const migration=read('supabase/migrations/20260901170001_client_portal_support_context_v139.sql');
assert.match(migration,/SUPPORT_SCOPE_DENIED/);
assert.match(migration,/es\.support_id=v_support/);
assert.doesNotMatch(migration,/ilike/);
console.log('v1.3.9 UX EDT, automatisations et navigation contextuelle: PASS');
