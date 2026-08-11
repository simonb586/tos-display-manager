import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';
import { availableKpi, unavailableKpi } from '../lib/module14Kpi.js';
import { assignmentsForContext, normalizeUniqueAssignments } from '../lib/siteSupportAssignments';
import { getTerrainSyncTimeline } from './terrainDiagnosticsService.js';
import { loadEdtReportTracking } from './reportDataService';
import { getAllAssignmentsBySiteAndSupport, getMarketingAssignmentsBySiteAndSupport, getOperationalCommunicationAssignmentsBySiteAndSupport } from './siteSupportBusinessService.js';

const unwrap = result => { if(result.error) throw result.error; return result.data || []; };
export async function loadModule14Data(){
 if(!supabaseConfigured||!supabase) return {campaigns:[],assignments:[],visuals:[],available:false};
 const [marketing,operational]=await Promise.all([
  getAllAssignmentsBySiteAndSupport({context:BUSINESS_CONTEXT.MARKETING}),
  getAllAssignmentsBySiteAndSupport({context:BUSINESS_CONTEXT.OPERATIONAL})
 ]),assignments=normalizeUniqueAssignments([...marketing,...operational]);
 const distinct=(rows,key)=>[...new Map(rows.filter(row=>row[key]!=null).map(row=>[`${row.business_context}:${row[key]}`,row])).values()];
 const campaigns=distinct(assignments.map(row=>({...row,id:row.campaign_id,nom_campagne:row.campaign})),'id'),visuals=distinct(assignments.map(row=>({...row,id:row.visual_id,nom_visuel:row.visual,actif:row.statut!=='Inactif'})),'id');
 return {campaigns,assignments,visuals,available:true};
}
export const marketingRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.MARKETING);
export const operationalRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.OPERATIONAL);
export const uniqueMarketingAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.MARKETING);
export const uniqueOperationalAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.OPERATIONAL);

export async function loadModule14OperationalKpis() {
 const [terrainResult,reportResult]=await Promise.allSettled([getTerrainSyncTimeline({page:1,pageSize:1}),loadEdtReportTracking()]);
 return {
  terrain:terrainResult.status==='fulfilled'?availableKpi(terrainResult.value.total):unavailableKpi(terrainResult.reason),
  reports:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.completed):unavailableKpi(reportResult.reason),
  reportsSent:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.sent):unavailableKpi(reportResult.reason),
  reportsToSend:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.toSend):unavailableKpi(reportResult.reason),
  reportsErrors:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.errors):unavailableKpi(reportResult.reason)
 };
}
