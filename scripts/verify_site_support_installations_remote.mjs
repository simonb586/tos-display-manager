import fs from 'node:fs';
import assert from 'node:assert/strict';
import {targetedAccess} from './targeted_remote_access.mjs';
import {projectSiteSupportDeployments} from '../src/lib/siteSupportDeployments.js';
const {admin}=await targetedAccess();
async function all(table){const rows=[];for(let offset=0;;offset+=500){const {data,error}=await admin.from(table).select('*').order('id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
const [history,campaigns,supports,visuals]=await Promise.all(['historique_des_campagnes','campagnes_maitres','infrastructures','campagne_visuels_formats'].map(all));
const projected=projectSiteSupportDeployments({history,campaigns,supports,visuals});
const installed=projected.filter(row=>row.etat_courant==='Oui');
assert.equal(new Set(installed.map(row=>`${row.client_id}:${row.support_id}`)).size,installed.length,'One current installation per support');
const unresolved=installed.filter(row=>!row.business_context);
const report={at:new Date().toISOString(),sourceSupports:supports.length,installed:installed.length,
 marketing:installed.filter(r=>r.business_context==='marketing').length,
 operational:installed.filter(r=>r.business_context==='operational_communication').length,
 unresolved:unresolved.length,unresolvedCampaigns:[...new Set(unresolved.map(r=>r.nom_campagne || r.campagne))],
 historyPreserved:history.length,uniqueCurrentSupports:true};
fs.mkdirSync('docs/site-support-installations',{recursive:true});
fs.writeFileSync('docs/site-support-installations/remote-data.json',JSON.stringify(report,null,2));
console.log(report);
