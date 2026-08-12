export const REPORT_SECTIONS=['summary','supports','photos','issues','conclusion'];
export const SECONDARY_SUPPORT_COLUMNS=['campaign','visual','format','installation_status','installation_date','removal_date','issue'];
const clean=value=>String(value??'').trim();
const fold=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-CA');

export function supportLogicalKey(row={}){
  return [row.edt_id,row.site,row.support_id,row.campaign_id||row.campaign,row.visual_id||row.visual].map(fold).join('|');
}

export function uniqueReportSupports(rows=[]){
  const seen=new Set();
  return rows.filter(row=>{const key=supportLogicalKey(row);if(seen.has(key))return false;seen.add(key);return true});
}

export function duplicateLogicalRows(rows=[]){return rows.length-uniqueReportSupports(rows).length}

export function createReportDraft(source,previous={}){
  const supports=uniqueReportSupports(source.supports||[]).map((row,index)=>({...row,order:index,comment:previous.supports?.find(item=>supportLogicalKey(item)===supportLogicalKey(row))?.comment||''}));
  const priorPhotoIds=new Set((previous.photos||[]).filter(photo=>photo.selected).map(photo=>String(photo.id)));
  return{
    schema_version:1,title:previous.title||`Rapport EDT ${source.edt.no_edt}`,summary:previous.summary??source.workSummary??'',conclusion:previous.conclusion??'Les travaux associés à cet EDT sont complétés.',
    section_order:previous.section_order||REPORT_SECTIONS,secondary_columns:previous.secondary_columns||SECONDARY_SUPPORT_COLUMNS,
    edt:{id:source.edt.id,no_edt:source.edt.no_edt,client:source.edt.client,campaign_name:source.edt.campaign_name,edt_type:source.edt.edt_type,requester_name:source.edt.requester_name,requester_email:source.edt.requester_email,date_debut_prevue:source.edt.date_debut_prevue||source.edt.date_debut,date_fin_prevue:source.edt.date_fin_prevue,date_fin:source.edt.date_fin,statut:source.edt.statut},
    source_support_count:supports.length,supports,
    photos:(source.photos||[]).map(photo=>({...photo,selected:previous.photos?priorPhotoIds.has(String(photo.id)):Boolean(photo.est_principale),caption:previous.photos?.find(item=>String(item.id)===String(photo.id))?.caption||''})),
    issues:(source.issues||[]).map(issue=>({...issue,selected:previous.issues?.find(item=>String(item.id)===String(issue.id))?.selected??Boolean(issue.client_visible!==false)}))
  };
}

export function validateReportIntegrity(draft){
  const reportCount=uniqueReportSupports(draft?.supports||[]).length,sourceCount=Number(draft?.source_support_count||0),duplicates=duplicateLogicalRows(draft?.supports||[]);
  return{valid:sourceCount===reportCount&&duplicates===0,sourceCount,reportCount,duplicateLogicalRows:duplicates,message:sourceCount===reportCount&&duplicates===0?'':'Le rapport ne contient pas tous les emplacements associés à cet EDT.'};
}

export function parseRecipients(value){
  const raw=Array.isArray(value)?value:String(value??'').split(/[\n,;]+/);const seen=new Set(),valid=[],invalid=[];
  for(const item of raw){const email=clean(item).toLowerCase();if(!email||seen.has(email))continue;seen.add(email);(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)&&email.length<=254?valid:invalid).push(email)}
  return{valid,invalid,count:valid.length};
}

export function reportFileName(draft,version){return`Rapport_EDT_${clean(draft?.edt?.no_edt).replace(/[^a-zA-Z0-9_-]/g,'_')}_v${version}.pdf`}
