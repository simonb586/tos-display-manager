import { reportValue } from './reportDataService';

export const REPORT_TEMPLATES=[['campaign','Campagne marketing'],['operational_communication','Communication opérationnelle'],['site_support','Site / support'],['client','Client'],['edt','EDT'],['inspection','Inspection'],['photos','Photos'],['issues','Enjeux'],['summary','Synthèse']];
export const safeMetric=value=>Number.isFinite(Number(value))?Number(value):0;
export const REPORT_TRANSITIONS={draft:['generated','archived'],generated:['published','archived'],published:['generated','archived'],error:['generated','archived'],archived:[]};
export const canTransitionReport=(from,to)=>Boolean(REPORT_TRANSITIONS[from]?.includes(to));
export function buildReportPreview({type,scope='',rows=[]}){return{title:REPORT_TEMPLATES.find(item=>item[0]===type)?.[1]||'Rapport',scope,generatedAt:new Date().toISOString(),count:rows.length,rows:rows.slice(0,100).map(row=>({...row,label:reportValue(row,'nom_campagne','nom','support_id','no_edt','objet','description')||'Élément'}))}}
