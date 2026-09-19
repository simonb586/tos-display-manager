import fs from 'node:fs';
import {targetedAccess} from './targeted_remote_access.mjs';
import {reconcileVisualCampaigns} from '../src/lib/campaignHistory.js';
const {admin}=await targetedAccess();
async function all(table,fields){const rows=[];for(let offset=0;;offset+=500){const {data,error}=await admin.from(table).select(fields).order(table==='visual_edt_associations'?'visual_id':'id').range(offset,offset+499);if(error)throw error;rows.push(...data);if(data.length<500)return rows;}}
const [visuals,links,edts,campaigns]=await Promise.all([
 all('campagne_visuels_formats','id,nom_visuel,client_id,campagne_id,edt_phase_id'),all('visual_edt_associations','visual_id,edt_id,phase_id,date_debut,date_fin'),
 all('suivi_des_edt','id,no_edt,client_id,campagne_id'),all('campagnes_maitres','id,nom_campagne,client_id,business_context,date_debut,date_fin')
]);
const matrix=reconcileVisualCampaigns(visuals,links,edts,campaigns).map(row=>({...row,
 dates_associations:links.filter(link=>link.visual_id===row.visual_id).map(link=>`${edts.find(edt=>edt.id===link.edt_id)?.no_edt||link.edt_id}: ${link.date_debut||'?'} / ${link.date_fin||'?'}`).join(' · '),
 dates_campagne_actuelle:campaigns.filter(c=>c.id===row.campagne_actuelle_id).map(c=>`${c.date_debut||'?'} / ${c.date_fin||'?'}`).join(''),
 dates_campagne_proposee:campaigns.filter(c=>c.id===row.campagne_proposee_id).map(c=>`${c.date_debut||'?'} / ${c.date_fin||'?'}`).join('')
}));
fs.mkdirSync('docs/review-edt-mission',{recursive:true});
fs.writeFileSync('docs/review-edt-mission/reconciliation.json',JSON.stringify(matrix,null,2));
const keys=['visual_id','visuel','edt','client_id','business_context','campagne_actuelle','campagne_proposee','dates_associations','dates_campagne_actuelle','dates_campagne_proposee','confidence','action'];
const csv=value=>'"'+String(value??'').replaceAll('"','""')+'"';
fs.writeFileSync('docs/review-edt-mission/reconciliation.csv','\ufeff'+[keys.map(csv).join(','),...matrix.map(row=>keys.map(key=>csv(row[key])).join(','))].join('\r\n'));
console.log({total:matrix.length,certain:matrix.filter(r=>r.action==='ASSOCIER').length,retained:matrix.filter(r=>r.action==='CONSERVER').length,toReview:matrix.filter(r=>r.action==='À VALIDER').length});
