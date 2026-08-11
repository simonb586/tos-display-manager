import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT, normalizeBusinessContext } from '../lib/businessContext';

const rows=(store,name)=>store?.[name]?.rows||[];
const value=(row,...keys)=>keys.map(key=>row?.[key]).find(item=>item!==null&&item!==undefined&&String(item).trim()!=='')??'';
const status=row=>String(value(row,'statut','status')).toLowerCase();
const published=row=>Boolean(value(row,'sent_at','published_at','publie_le'))||['envoyé','publie','publié'].includes(status(row));
const ready=()=>{if(!supabaseConfigured||!supabase)throw new Error('Service de rapports indisponible.')};

export async function listReports({status:reportStatus,type,clientId,campaignId,communicationId,periodStart,periodEnd}={}){ready();let query=supabase.from('reports').select('*').order('created_at',{ascending:false});if(reportStatus)query=query.eq('status',reportStatus);if(type)query=query.eq('report_type',type);if(clientId)query=query.eq('client_id',clientId);if(campaignId)query=query.eq('campaign_id',campaignId);if(communicationId)query=query.eq('communication_id',communicationId);if(periodStart)query=query.gte('period_start',periodStart);if(periodEnd)query=query.lte('period_end',periodEnd);const{data,error}=await query;if(error)throw error;return data||[]}
export async function getReport(id){ready();const{data,error}=await supabase.from('reports').select('*').eq('id',id).single();if(error)throw error;return data}
export async function createDraftReport(report){ready();const payload={report_type:report.report_type,title:String(report.title||'').trim(),client_id:report.client_id||null,campaign_id:report.campaign_id||null,communication_id:report.communication_id||null,site:report.site||null,support_id:report.support_id||null,no_edt:report.no_edt||null,period_start:report.period_start||null,period_end:report.period_end||null,status:'draft',client_published:false,template_key:report.template_key||report.report_type,metadata:report.metadata||{}};if(!payload.title)throw new Error('Le titre est obligatoire.');const{data,error}=await supabase.from('reports').insert(payload).select().single();if(error)throw error;return data}
export async function updateDraftReport(id,changes){ready();const current=await getReport(id);if(!['draft','generated','error'].includes(current.status))throw new Error('Ce rapport ne peut plus être modifié.');const allowed=['title','client_id','campaign_id','communication_id','site','support_id','no_edt','period_start','period_end','metadata','template_key'];const payload=Object.fromEntries(allowed.filter(key=>Object.hasOwn(changes,key)).map(key=>[key,changes[key]]));payload.updated_by=(await supabase.auth.getUser()).data.user?.id||null;payload.updated_at=new Date().toISOString();const{data,error}=await supabase.from('reports').update(payload).eq('id',id).select().single();if(error)throw error;return data}
export async function generateReport(id,metadata={}){ready();const{data,error}=await supabase.rpc('module15_generate_report_v130',{p_report_id:id,p_metadata:metadata});if(error)throw error;return data}
const transition=async(id,action)=>{ready();const{data,error}=await supabase.rpc('module15_transition_report_v130',{p_report_id:id,p_action:action});if(error)throw error;return data};
export const publishReport=id=>transition(id,'publish');
export const unpublishReport=id=>transition(id,'unpublish');
export const archiveReport=id=>transition(id,'archive');
export async function listReportActivity(){ready();const{data,error}=await supabase.from('activity_events').select('*').eq('entity_type','report').order('occurred_at',{ascending:false}).limit(250);if(error)throw error;return data||[]}

export async function loadReportData(dataStore={}){
 let reports=[],available=true,error='';
 let history=[];try{[reports,history]=await Promise.all([listReports(),listReportActivity()])}catch(e){available=false;error=e?.message||String(e)}
 const campaigns=rows(dataStore,'Campagnes et visuels');
 const edt=rows(dataStore,'Suivi des EDT');
 return{available,error,reports,campaigns,marketing:campaigns.filter(row=>normalizeBusinessContext(row.business_context)===BUSINESS_CONTEXT.MARKETING),communications:campaigns.filter(row=>normalizeBusinessContext(row.business_context)===BUSINESS_CONTEXT.OPERATIONAL),supports:rows(dataStore,'Infrastructures'),edt,photos:rows(dataStore,'Photos'),inspections:rows(dataStore,'Inspections'),issues:rows(dataStore,'Enjeux des cadres et supports'),history,clients:rows(dataStore,'Clients'),kpis:{generated:reports.length,published:reports.filter(row=>row.status==='published'&&row.client_published).length,drafts:reports.filter(row=>row.status==='draft').length,errors:reports.filter(row=>row.status==='error').length,recent:reports.filter(row=>Date.now()-new Date(value(row,'created_at','published_at')||0).getTime()<=30*86400000).length,campaignsWithoutReport:campaigns.filter(c=>!reports.some(r=>String(r.campaign_id)===String(c.id))).length,communicationsWithoutReport:campaigns.filter(c=>normalizeBusinessContext(c.business_context)===BUSINESS_CONTEXT.OPERATIONAL&&!reports.some(r=>String(r.communication_id)===String(c.id))).length,completedEdtWithoutReport:edt.filter(e=>status(e).includes('termin')&&!reports.some(r=>String(r.no_edt)===String(value(e,'no_edt','numero_edt')))).length}};
}

export const reportValue=value;
export const isPublishedReport=published;
