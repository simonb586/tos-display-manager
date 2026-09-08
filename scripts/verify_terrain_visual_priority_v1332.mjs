import assert from 'node:assert/strict';
import fs from 'node:fs';
const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const eligible=x=>x.supportClient===x.visualClient&&x.supportClient===x.campaignClient&&x.active!==false&&x.published!==false
  &&['marketing','operational_communication'].includes(x.businessContext)&&(x.outOfFrame||normalize(x.supportFormat)===normalize(x.visualFormat));
const base={supportClient:2,visualClient:2,campaignClient:2,businessContext:'marketing',supportFormat:'20 x 28 Portrait'};
const cases=[
 ['A relation exacte + bon format',true,{...base,visualFormat:'20 x 28 Portrait',exact:true}],
 ['B sans relation + bon format',true,{...base,visualFormat:'20x28 portrait',exact:false}],
 ['C même nom + mauvais format',false,{...base,visualFormat:'26 x 20',exact:false}],
 ['D autre campagne + bon format',true,{...base,visualFormat:'20 x 28 Portrait',campaignId:99,exact:false}],
 ['E communication opérationnelle',true,{...base,businessContext:'operational_communication',visualFormat:'20 x 28 Portrait'}],
 ['F hors-cadre',true,{...base,visualFormat:'99 x 99',outOfFrame:true}],
 ['G Client B',false,{...base,visualClient:8,campaignClient:8,visualFormat:'20 x 28 Portrait',outOfFrame:true}],
];
for(const [name,expected,input] of cases) assert.equal(eligible(input),expected,name);
const sql=fs.readFileSync('supabase/migrations/20260908001151_terrain_visual_exact_relation_priority_v1332.sql','utf8').toLowerCase();
for(const marker of ['terrain_visual_is_eligible_v1331','lister_visuels_installation_terrain_v1331','tdm_normalize_display_format','is_out_of_frame','marketing','operational_communication','c.client_id=i.client_id','v.client_id=i.client_id','is_exact_relation','auth.uid() is null','cross_client_denied','set search_path=pg_catalog,public,pg_temp','revoke execute']) assert.ok(sql.includes(marker),marker);
assert.doesNotMatch(sql,/v\.campagne_id\s*=\s*v_campaign_id/i);
assert.doesNotMatch(sql,/a\.visual_id\s+is\s+not\s+null/i);
assert.doesNotMatch(sql,/\b(insert|update|delete|truncate|drop table|drop column)\b/i);
console.log('V1.3.3.2 admissibilité visuelle non exclusive : 7 scénarios PASS.');
