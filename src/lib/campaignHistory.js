export const normalizeEdtNumber = value => String(value??'').normalize('NFKC').trim().toUpperCase().replace(/[‐‑–—\s]+/g,'-').replace(/-+/g,'-').replace(/\d+/g,n=>String(Number(n)));
const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const text=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('fr-CA');
const context=value=>['marketing','operational_communication'].includes(value)?value:null;
const businessDate=value=>/^\d{4}-\d{2}-\d{2}/.test(String(value))?String(value).slice(0,10):String(value||'');

export function projectCampaignHistory(history,{campaigns=[],supports=[],edts=[]}={}) {
 const bySupport=new Map(supports.map(s=>[String(s.support_id),s]));
 return history.map(row=>{
  const raw=row.raw_data||{},support=bySupport.get(String(row.support_id));
  const matchingEdts=edts.filter(e=>same(e.client_id,row.client_id)&&normalizeEdtNumber(e.no_edt)===normalizeEdtNumber(row.no_edt)&&row.no_edt);
  const campaignId=row.campagne_id||raw.campaign_id||raw.campagne_id||(matchingEdts.length===1?matchingEdts[0].campagne_id:null);
  const matches=campaigns.filter(c=>same(c.client_id,row.client_id)&&(campaignId?same(c.id,campaignId):text(c.nom_campagne)===text(row.campagne)));
  const campaign=matches.length===1?matches[0]:null;
  const explicit=context(row.business_context||raw.business_context),derived=context(campaign?.business_context);
  const resolved=explicit&&derived&&explicit!==derived?null:explicit||derived;
  return {...row,campaign_id:campaign?.id||campaignId,site:support?.site||row.site||'',format_support:support?.format_affichage||row.format_support||'',
   business_context:resolved,context_status:resolved?'Confirmé':'À valider',date_installation:businessDate(row.date_installation),date_retrait:businessDate(row.date_retrait)};
 });
}

export function summarizeCampaignHistory(rows) {
 const groups=new Map();
 for(const row of rows){
  const key=JSON.stringify([row.client_id,row.business_context,row.campaign_id||row.campagne,row.visual_id||row.visuel,normalizeEdtNumber(row.no_edt),businessDate(row.date_installation),businessDate(row.date_retrait)]);
  if(!groups.has(key))groups.set(key,{id:key,client_id:row.client_id,business_context:row.business_context,contexte:row.context_status,
   campagne:row.campagne,visuel:row.visuel,no_edt:row.no_edt,date_installation:businessDate(row.date_installation),date_retrait:businessDate(row.date_retrait),supports:new Set()});
  if(row.support_id)groups.get(key).supports.add(String(row.support_id));
 }
 return [...groups.values()].map(({supports,...row})=>({...row,nombre_supports:supports.size}));
}

export function reconcileVisualCampaigns(visuals,associations,edts,campaigns) {
 const edtById=new Map(edts.map(e=>[String(e.id),e])),campaignById=new Map(campaigns.map(c=>[String(c.id),c]));
 return visuals.map(v=>{
  const current=campaignById.get(String(v.campagne_id));
  const linked=associations.filter(a=>same(a.visual_id,v.id)).map(a=>edtById.get(String(a.edt_id))).filter(Boolean);
  const ids=[...new Set(linked.map(e=>e.campagne_id).filter(Boolean).map(String))];
  const proposed=ids.length===1?campaignById.get(ids[0]):null;
  const reliable=linked.length>0&&linked.every(e=>same(e.client_id,v.client_id)&&e.campagne_id)&&proposed&&same(proposed.client_id,v.client_id)&&current&&proposed.business_context===current.business_context;
  const datesAgree=associations.filter(a=>same(a.visual_id,v.id)).every(a=>(!a.date_debut||!proposed?.date_fin||a.date_debut<=proposed.date_fin)&&(!a.date_fin||!proposed?.date_debut||a.date_fin>=proposed.date_debut));
  const unchanged=reliable&&same(proposed.id,v.campagne_id);
  return {visual_id:v.id,visuel:v.nom_visuel,edt:linked.map(e=>e.no_edt).join(' · '),client_id:v.client_id,business_context:current?.business_context||null,
   campagne_actuelle:current?.nom_campagne||null,campagne_actuelle_id:v.campagne_id,campagne_proposee:proposed?.nom_campagne||null,campagne_proposee_id:proposed?.id||null,
   confidence:reliable&&datesAgree?'CERTAINE':'À VALIDER',action:unchanged?'CONSERVER':reliable&&datesAgree?'ASSOCIER':'À VALIDER'};
 });
}
