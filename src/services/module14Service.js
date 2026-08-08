import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';
import { assignmentsForContext, normalizeUniqueAssignments } from '../lib/siteSupportAssignments';

const unwrap = result => { if(result.error) throw result.error; return result.data || []; };
export async function loadModule14Data(){
 if(!supabaseConfigured||!supabase) return {campaigns:[],assignments:[],visuals:[],available:false};
 const [campaigns,assignments,visuals]=await Promise.all([
  supabase.from('campagnes_maitres').select('id,nom_campagne,client,statut,date_debut,date_fin,supports_cibles,supports_completes,business_context').order('date_fin',{ascending:true,nullsFirst:false}).limit(250),
  supabase.from('campagnes_supports').select('id,support_id,statut,campagne:campagne_id(id,nom_campagne,business_context)').order('updated_at',{ascending:false}).limit(500),
  supabase.from('campagne_visuels_formats').select('id,nom_visuel,actif,campagne:campagne_id(id,business_context)').order('id',{ascending:false}).limit(250)
 ]);
 return {campaigns:unwrap(campaigns),assignments:normalizeUniqueAssignments(unwrap(assignments).map(row=>({...row,campaign_id:row.campagne?.id,visual_id:row.visuel_id??row.visuel_attendu,site_id:row.site??row.support_id?.split('-')[0]}))),visuals:unwrap(visuals),available:true};
}
export const marketingRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.MARKETING);
export const operationalRows=rows=>rows.filter(row=>(row.business_context||row.campagne?.business_context||BUSINESS_CONTEXT.MARKETING)===BUSINESS_CONTEXT.OPERATIONAL);
export const uniqueMarketingAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.MARKETING);
export const uniqueOperationalAssignments=rows=>assignmentsForContext(rows,BUSINESS_CONTEXT.OPERATIONAL);
