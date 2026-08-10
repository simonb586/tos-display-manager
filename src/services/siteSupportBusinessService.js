import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';

const PAGE_SIZES=[25,50,100,200];
const safePageSize=value=>PAGE_SIZES.includes(Number(value))?Number(value):25;
const tableFor=context=>context===BUSINESS_CONTEXT.OPERATIONAL?'communications_operationnelles_sites_supports':'campagnes_visuels_sites_supports';

export async function getAssignmentsBySiteAndSupport({context,page=1,pageSize=25,filters={}}={}){
  const size=safePageSize(pageSize),current=Math.max(1,Number(page)||1),from=(current-1)*size;
  if(!supabaseConfigured||!supabase)return{rows:[],total:0,page:current,pageSize:size};
  let query=supabase.from(tableFor(context)).select('*',{count:'exact'}).eq('business_context',context);
  if(filters.site)query=query.ilike('site',`%${filters.site}%`);
  if(filters.support)query=query.ilike('support_id',`%${filters.support}%`);
  if(filters.infrastructure)query=query.eq('infrastructure_id',filters.infrastructure);
  if(filters.status)query=query.eq(context===BUSINESS_CONTEXT.OPERATIONAL?'statut':'statut_campagne',filters.status);
  if(filters.edt&&context===BUSINESS_CONTEXT.OPERATIONAL)query=query.ilike('no_edt',`%${filters.edt}%`);
  if(filters.campaign)query=query.ilike(context===BUSINESS_CONTEXT.OPERATIONAL?'message':'nom_campagne',`%${filters.campaign}%`);
  if(filters.visual){const visualColumn=context===BUSINESS_CONTEXT.OPERATIONAL?'visuel_terrain':'visuel_terrain';query=query.ilike(visualColumn,`%${filters.visual}%`)}
  if(filters.dateFrom)query=query.gte('date_fin',filters.dateFrom);
  if(filters.dateTo)query=query.lte('date_debut',filters.dateTo);
  const{data,error,count}=await query.order('id',{ascending:false}).range(from,from+size-1);
  if(error)throw error;
  const rows=(data||[]).map(row=>({...row,logical_key:`${row.source_table}:${row.legacy_id}`,campaign:row.nom_campagne??row.message,visual:row.visuel_terrain??row.visuel_message,infrastructure:row.infrastructure_id,derniere_activite:row.updated_at}));
  return{rows,total:count??rows.length,page:current,pageSize:size};
}

export const getMarketingAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.MARKETING});
export const getOperationalCommunicationAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.OPERATIONAL});

export async function getAllAssignmentsBySiteAndSupport({context,filters={}}={}){
  const first=await getAssignmentsBySiteAndSupport({context,page:1,pageSize:200,filters}),rows=[...first.rows];
  const pages=Math.ceil(first.total/first.pageSize);
  for(let page=2;page<=pages;page+=1)rows.push(...(await getAssignmentsBySiteAndSupport({context,page,pageSize:200,filters})).rows);
  return rows;
}
