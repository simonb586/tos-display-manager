import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { loadTable } from './dataService';
import { BUSINESS_CONTEXT } from '../lib/businessContext';
import { availableKpi, unavailableKpi } from '../lib/module14Kpi.js';
import { assignmentsForContext, normalizeUniqueAssignments } from '../lib/siteSupportAssignments';
import { getTerrainSyncTimeline } from './terrainDiagnosticsService.js';
import { loadEdtReportTracking } from './reportDataService';
import { getAllAssignmentsBySiteAndSupport, getMarketingAssignmentsBySiteAndSupport, getOperationalCommunicationAssignmentsBySiteAndSupport } from './siteSupportBusinessService.js';

const unwrap = result => { if(result.error) throw result.error; return result.data || []; };
export async function loadModule14Data({infrastructureRows}={}){
 if(!supabaseConfigured||!supabase) return {campaigns:[],assignments:[],visuals:[],available:false};
 const [marketing,operational,campaignResult,visualResult]=await Promise.all([
  getAllAssignmentsBySiteAndSupport({context:BUSINESS_CONTEXT.MARKETING,infrastructureRows}),
  getAllAssignmentsBySiteAndSupport({context:BUSINESS_CONTEXT.OPERATIONAL,infrastructureRows}),
  loadTable('campagnes_maitres'),loadTable('campagne_visuels_formats')
 ]),assignments=normalizeUniqueAssignments([...marketing,...operational]);
 const campaigns=campaignResult.rows,byCampaign=new Map(campaigns.map(row=>[String(row.id),row]));
 const visuals=visualResult.rows.map(row=>({...row,business_context:byCampaign.get(String(row.campagne_id))?.business_context||row.business_context||BUSINESS_CONTEXT.MARKETING}));
 return {campaigns,assignments,visuals,available:true};
}
export const marketingRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.MARKETING);
export const operationalRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.OPERATIONAL);
export const uniqueMarketingAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.MARKETING);
export const uniqueOperationalAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.OPERATIONAL);

export async function loadModule14OperationalKpis() {
 const [terrainResult,reportResult]=await Promise.allSettled([getTerrainSyncTimeline({page:1,pageSize:1}),loadEdtReportTracking()]);
 return {
  reports:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.available):unavailableKpi(reportResult.reason),
  terrain:terrainResult.status==='fulfilled'?availableKpi(terrainResult.value.total):unavailableKpi(terrainResult.reason),
  reportsCompleted:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.completed):unavailableKpi(reportResult.reason),
  reportsSent:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.sent):unavailableKpi(reportResult.reason),
  reportsToSend:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.toSend):unavailableKpi(reportResult.reason),
  reportsErrors:reportResult.status==='fulfilled'?availableKpi(reportResult.value.kpis.errors):unavailableKpi(reportResult.reason)
 };
}
