import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';

const PAGE_SIZES=[25,50,100,200];
const safePageSize=value=>PAGE_SIZES.includes(Number(value))?Number(value):25;
const tableFor=context=>context===BUSINESS_CONTEXT.OPERATIONAL?'communications_operationnelles_sites_supports':'campagnes_visuels_sites_supports';
const searchableFor=context=>context===BUSINESS_CONTEXT.OPERATIONAL
  ?['emplacement','message','statut','no_arret','site_ou_arret','support_id','no_edt','related_voiture','visuel_message','visuel_terrain','site']
  :['nom_campagne','visuel_terrain','statut_campagne','support_id','emplacement','date_mise_a_jour','site'];
const safeTerm=value=>String(value??'').replace(/[,%()]/g,' ').trim();

export async function getAssignmentsBySiteAndSupport({context,page=1,pageSize=25,search='',filters={},sortState=null}={}){
  const size=safePageSize(pageSize),current=Math.max(1,Number(page)||1),from=(current-1)*size;
  if(!supabaseConfigured||!supabase)return{rows:[],total:0,page:current,pageSize:size};
  let query=supabase.from(tableFor(context)).select('*',{count:'exact'}).eq('business_context',context);
  const global=safeTerm(search);
  if(global)query=query.or(searchableFor(context).map(column=>`${column}.ilike.%${global}%`).join(','));
  for(const[column,value]of Object.entries(filters)){const term=safeTerm(value);if(!term)continue;if(['id','legacy_id','infrastructure_id','campaign_id','visual_id'].includes(column))query=query.eq(column,term);else query=query.ilike(column,`%${term}%`)}
  const sortColumn=sortState?.column||'id',ascending=sortState?.direction==='asc';
  const{data,error,count}=await query.order(sortColumn,{ascending,nullsFirst:sortState?.emptyPlacement==='first'}).range(from,from+size-1);
  if(error)throw error;
  const rows=(data||[]).map(row=>({...row,logical_key:`${row.source_table}:${row.legacy_id}`}));
  return{rows,total:count??rows.length,page:current,pageSize:size};
}

export const getMarketingAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.MARKETING});
export const getOperationalCommunicationAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.OPERATIONAL});

export async function getAllAssignmentsBySiteAndSupport({context,search='',filters={},sortState=null}={}){
  const first=await getAssignmentsBySiteAndSupport({context,page:1,pageSize:200,search,filters,sortState}),rows=[...first.rows];
  for(let page=2,pages=Math.ceil(first.total/first.pageSize);page<=pages;page+=1)rows.push(...(await getAssignmentsBySiteAndSupport({context,page,pageSize:200,search,filters,sortState})).rows);
  return rows;
}
