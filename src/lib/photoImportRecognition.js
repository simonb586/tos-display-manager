// Import-only inference. Terrain keeps its explicit capture workflow.
import {rankImportSupports} from './importSupportCandidates.js';
export const REVIEW_FIELDS = ['support','date','type','edt','phase','campaign','visual'];
const confirmed = state => ['AUTO_CONFIRMED','MANUAL_CONFIRMED','NOT_APPLICABLE'].includes(state);
const same = (a,b) => a != null && b != null && String(a) === String(b);
const day = value => /^\d{4}-\d{2}-\d{2}/.test(String(value)) && Number.isFinite(Date.parse(value)) ? String(value).slice(0,10) : null;
const distance = (a,b) => a && b ? Math.abs(Date.parse(a)-Date.parse(b))/86400000 : Infinity;
const normalize = value => String(value||'').normalize('NFKC').toUpperCase().replace(/\s+/g,' ').trim();
const format = value => normalize(value).replace(/,/g,'.').replace(/[×X]/g,'x').replace(/\b(PORTRAIT|PAYSAGE|LANDSCAPE)\b/g,'').replace(/\s/g,'');
export const importFormatCompatible = (support, visual) => visual.is_out_of_frame === true || Boolean(format(support.format_affichage)) && format(support.format_affichage) === format(visual.format_support);

export function recognizeImportPhoto(item, catalog, manual = {}) {
  const states = Object.fromEntries(REVIEW_FIELDS.map(key=>[key,'TO_REVIEW']));
  const values = {}; const reasons = {}; const candidates = {};
  const accept = (key,value,isManual=false) => {values[key]=value;states[key]=isManual?'MANUAL_CONFIRMED':'AUTO_CONFIRMED';};
  const na = key => {values[key]=null;states[key]='NOT_APPLICABLE';};
  const supports = catalog.supports||[];
  const exact = supports.filter(s=>same(s.support_id,manual.support));
  let matches = exact;
  const supportRanking=rankImportSupports(item,supports);
  if(!manual.support){
    matches=supportRanking.filter(candidate=>candidate.automatic).map(candidate=>candidate.support);
  }
  candidates.supportDetails=supportRanking.slice(0,6).map(({support,...candidate})=>candidate);
  candidates.support=matches.map(s=>s.support_id);
  const support=matches.length===1?matches[0]:null;
  if(support)accept('support',support.support_id,Boolean(manual.support));
  else reasons.support=matches.length>1?'SUPPORT À VALIDER — plusieurs numéros exacts':supportRanking.length?'SUPPORT À VALIDER — candidat approchant':'Support à identifier';
  const capture=manual.date||item.capturedAt;
  const source=manual.date?'MANUAL':String(item.capturedAtSource||'IMPORT_DATE').toUpperCase();
  values.date=day(capture)?capture:null;
  if(day(capture) && (manual.date || ['EXIF','TERRAIN_CAPTURE'].includes(source) || source==='FILE_METADATA' && item.fileMetadataReliable===true))accept('date',capture,Boolean(manual.date));
  else reasons.date='Date à confirmer';
  const result=()=>{
    const pending=REVIEW_FIELDS.filter(key=>!confirmed(states[key]));
    return {values,states,reasons,candidates,dateSource:source,pending,ready:pending.length===0,
      unidentified:!values.support && !values.edt && !values.type && !values.visual,
      classification:pending.length===0?'ready':!values.support?'unmatched':'needs_review'};
  };
  if(!support)return result();
  const links=(catalog.links||[]).filter(l=>same(l.support_id,support.support_id));
  const clientEdts=(catalog.edts||[]).filter(e=>same(e.client_id,support.client_id));
  const namedEdts=[support.edt_associe,support.edt_precedent_associe,support.prochain_edt_cible].filter(Boolean).map(normalize);
  const edts=clientEdts.filter(e=>links.some(l=>same(l.edt_id,e.id))||namedEdts.includes(normalize(e.no_edt))||same(e.id,manual.edt));
  candidates.edt=clientEdts;
  const phases=(catalog.phases||[]).filter(p=>edts.some(e=>same(e.id,p.edt_id))&&['installation','retrait'].includes(p.phase_type));
  const date=day(capture);
  const activeEdts=edts.filter(e=>{
    const ps=phases.filter(p=>same(p.edt_id,e.id));
    const starts=ps.filter(p=>p.phase_type==='installation').map(p=>day(p.date_debut_reelle)||day(p.date_debut_prevue)).filter(Boolean);
    const ends=ps.filter(p=>p.phase_type==='retrait').map(p=>day(p.date_fin_reelle)||day(p.date_debut_reelle)||day(p.date_debut_prevue)||day(p.date_fin_prevue)).filter(Boolean);
    const start=starts.sort()[0]||day(e.date_debut),end=ends.sort().at(-1)||day(e.date_fin);
    return date&&start&&date>=start&&(!end||date<=end);
  });
  const activeEdt=confirmed(states.date)&&activeEdts.length===1?activeEdts[0]:null;
  const ranked=phases.map(p=>{
    const associationDates=(catalog.associations||[]).filter(a=>same(a.phase_id,p.id)).map(a=>p.phase_type==='installation'?a.date_debut:a.date_fin);
    const dates=[p.date_debut_reelle,p.date_debut_prevue,...associationDates].map(day).filter(Boolean);
    const delta=Math.min(Infinity,...dates.map(d=>distance(date,d)));
    return {...p,matchDistance:delta,matchRank:delta===0?(p.phase_type==='installation'?0:1):delta<=2?2+delta:Infinity};
  }).sort((a,b)=>a.matchRank-b.matchRank);
  candidates.phase=ranked;
  let phase=null;
  if(manual.phase)phase=phases.find(p=>same(p.id,manual.phase))||null;
  else if(manual.edt){const options=ranked.filter(p=>same(p.edt_id,manual.edt)&&(!manual.type||p.phase_type===manual.type));if(options.length===1 || options[0]?.matchRank<options[1]?.matchRank)phase=options[0];}
  else if(confirmed(states.date)&&Number.isFinite(ranked[0]?.matchRank)&&(!ranked[1]||ranked[0].matchRank<ranked[1].matchRank))phase=ranked[0];
  const explicitWithout=manual.withoutEdt===true || item.canonicalMetadata?.installation_sans_edt===true;
  const manualType=['installation','retrait','inspection','enjeu','photo'].includes(manual.type)?manual.type:null;
  if(manualType)accept('type',manualType,true);
  else if(phase)accept('type',phase.phase_type);
  else if(explicitWithout)accept('type','installation',manual.withoutEdt===true);
  const noMovement=['inspection','enjeu','photo'].includes(values.type);
  if(noMovement || explicitWithout){na('edt');na('phase');values.withoutEdt=explicitWithout&&!noMovement;phase=null;}
  else {
    const edt=edts.find(e=>same(e.id,manual.edt||phase?.edt_id||activeEdt?.id));
    if(edt)accept('edt',edt.id,Boolean(manual.edt));
    else reasons.edt=edts.length?'EDT à valider':'Aucun EDT correspondant : décision requise';
    if(phase&&same(phase.edt_id,values.edt)&&(!values.type||phase.phase_type===values.type))accept('phase',phase.id,Boolean(manual.phase));
  }
  if(noMovement){na('campaign');na('visual');return result();}
  const edt=edts.find(e=>same(e.id,values.edt));
  const referenceMatches=(item.visualReferenceMatches||[]).filter(match=>same(match.client_id,support.client_id)
    && (catalog.visuals||[]).some(v=>same(v.id,match.visual_id)&&same(v.client_id,support.client_id)&&importFormatCompatible(support,v)));
  const references=referenceMatches.filter(match=>match.confirmed);
  const reference=references.length===1?references[0]:null;
  const referenceConflict=reference&&edt?.campagne_id&&!same(reference.campaign_id,edt.campagne_id);
  const campaigns=(catalog.campaigns||[]).filter(c=>same(c.client_id,support.client_id)&&['marketing','operational_communication'].includes(c.business_context)&&
    (edt?.campagne_id||same(c.id,manual.campaign)||(!day(c.date_debut)||date>=day(c.date_debut))&&(!day(c.date_fin)||date<=day(c.date_fin))));
  candidates.campaign=campaigns.filter(c=>!edt?.campagne_id||same(c.id,edt.campagne_id));
  const campaign=candidates.campaign.find(c=>same(c.id,manual.campaign||edt?.campagne_id||(!referenceConflict&&reference?.campaign_id)));
  if(campaign)accept('campaign',campaign.id,Boolean(manual.campaign));
  const visuals=(catalog.visuals||[]).filter(v=>same(v.client_id,support.client_id)&&importFormatCompatible(support,v)&&campaigns.some(c=>same(c.id,v.campagne_id))&&(!values.campaign||same(v.campagne_id,values.campaign)));
  // Existing support/visual links are deliberately not an eligibility condition.
  candidates.visual=visuals.filter(v=>{
    const associations=(catalog.associations||[]).filter(a=>same(a.visual_id,v.id)&&same(a.edt_id,values.edt));
    if(!associations.length)return true;
    return associations.some(a=>(!a.date_debut||date>=a.date_debut)&&(!a.date_fin||date<=a.date_fin));
  });
  const visual=manual.visual?candidates.visual.find(v=>same(v.id,manual.visual)):!referenceConflict&&reference?candidates.visual.find(v=>same(v.id,reference.visual_id)):null;
  if(visual){accept('visual',visual.id,Boolean(manual.visual));if(!values.campaign)accept('campaign',visual.campagne_id,Boolean(manual.visual));}
  else reasons.visual=referenceConflict?'La référence reconnue ne correspond pas à la campagne de cet EDT':referenceMatches.length?'Références visuelles à départager':'Aucune référence générique reconnue : visuel à valider';
  return result();
}

export function importRecognitionCounts(rows) {
  return rows.reduce((out,row)=>{
    out.imported++;
    if(row.error)out.errors++;
    if(row.finalized)out.validated++;
    else if(row.recognition?.ready){out.ready++;if(!Object.values(row.recognition.states).includes('MANUAL_CONFIRMED'))out.automatic++;}
    else {out.review++;if(row.recognition?.unidentified)out.unidentified++;}
    return out;
  },{imported:0,automatic:0,ready:0,review:0,unidentified:0,validated:0,errors:0});
}
