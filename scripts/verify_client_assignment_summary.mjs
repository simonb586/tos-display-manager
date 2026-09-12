import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolveClientPortalViews,normalizeClientPortalViewKey} from '../src/lib/clientPortalViewRegistry.js';
const source=fs.readFileSync('src/services/dashboardService.js','utf8');
const declaration=source.slice(source.indexOf('export function validateDashboardSummary'),source.indexOf('export async function loadDashboardSummary')).replace('export function','function');
const validate=new Function('resolveClientPortalViews','normalizeClientPortalViewKey',declaration+';return validateDashboardSummary;')(resolveClientPortalViews,normalizeClientPortalViewKey);
for(const role of ['Client','Client-Admin']){
 const input={version:1,identity:{user_id:'test',role,client_id:2},permission:{visible_tables:['Campagnes et visuels par site et supports','Communications opérationnelles par site et supports']},sections:{},kpis:{marketing_places:163,operational_places:58}};
 const summary=validate(input);
 assert.equal(summary.sections.marketing_assignments.total,163);
 assert.equal(summary.sections.operational_assignments.total,58);
 assert.deepEqual(input.sections,{},'Validation must not mutate the shared cached response');
 assert.throws(()=>validate({...input,kpis:{marketing_places:163}}),/incomplet/);
}
console.log('Assignment dashboard summary PASS: both client roles, canonical counts, missing count rejected, cache preserved');
