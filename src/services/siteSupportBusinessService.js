import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { BUSINESS_CONTEXT, normalizeBusinessContext } from '../lib/businessContext.js';
import { assignmentLogicalKey, normalizeUniqueAssignments } from '../lib/siteSupportAssignments.js';
import { defaultSortForColumn, sortRows } from '../lib/gridSorting.js';

const PAGE_SIZES=[25,50,100,200];
const FETCH_SIZE=1000;
const safePageSize=value=>PAGE_SIZES.includes(Number(value))?Number(value):25;
const tableFor=context=>context===BUSINESS_CONTEXT.OPERATIONAL?'communications_operationnelles_sites_supports':'campagnes_visuels_sites_supports';
const searchableFor=context=>context===BUSINESS_CONTEXT.OPERATIONAL
  ?['emplacement','message','statut','no_arret','site_ou_arret','support_id','no_edt','related_voiture','visuel_message','visuel_terrain','site']
  :['nom_campagne','visuel_terrain','statut_campagne','support_id','emplacement','date_mise_a_jour','site'];
const exactFilterColumns=new Set(['id','legacy_id','infrastructure_id','campaign_id','visual_id']);
const normalizedText=value=>String(value??'').trim().toLocaleLowerCase('fr-CA');
// V1.2.2 server-query semantics are preserved locally across both sources:
// .eq('business_context',context), searchableFor(context), .order(sortColumn, { ascending }).

async function fetchAll(table,select='*',signal){
  const rows=[];
  for(let from=0;;from+=FETCH_SIZE){
    let query=supabase.from(table).select(select).range(from,from+FETCH_SIZE-1);
    if(signal)query=query.abortSignal(signal);
    const{data,error}=await query;
    if(error)throw error;
    rows.push(...(data||[]));
    if((data||[]).length<FETCH_SIZE)return rows;
  }
}

export function canonicalAssignmentRows(assignments,campaigns,infrastructures,visuals){
  const campaignById=new Map(campaigns.map(row=>[String(row.id),row]));
  const infrastructureBySupport=new Map(infrastructures.map(row=>[String(row.support_id),row]));
  const visualsByCampaign=new Map();
  for(const visual of visuals){
    const key=String(visual.campagne_id),bucket=visualsByCampaign.get(key)||[];
    bucket.push(visual);visualsByCampaign.set(key,bucket);
  }
  return assignments.flatMap(assignment=>{
    const campaign=campaignById.get(String(assignment.campagne_id));
    if(!campaign)return[];
    const context=normalizeBusinessContext(campaign.business_context);
    const infrastructure=infrastructureBySupport.get(String(assignment.support_id))||{};
    const visual=(visualsByCampaign.get(String(campaign.id))||[]).find(item=>normalizedText(item.nom_visuel)===normalizedText(assignment.visuel_attendu));
    const common={
      id:assignment.id,legacy_id:assignment.id,source_table:'campagnes_supports',site:infrastructure.site??null,
      infrastructure_id:infrastructure.id??null,campaign_id:campaign.id,visual_id:visual?.id??null,
      business_context:context,support_id:assignment.support_id,created_at:assignment.created_at,
      updated_at:assignment.updated_at,raw_data:assignment,installation:assignment.date_completion,
      date_completion:assignment.date_completion,no_edt:assignment.no_edt||campaign.no_edt||null
    };
    if(context===BUSINESS_CONTEXT.OPERATIONAL)return[{...common,emplacement:infrastructure.emplacement_visibilite??null,
      message:campaign.nom_campagne,date_debut:campaign.date_debut,date_fin:campaign.date_fin,statut:assignment.statut,
      site_ou_arret:infrastructure.site??null,visuel_message:assignment.visuel_attendu||campaign.visuel_generique,
      visuel_terrain:assignment.visuel_attendu||campaign.visuel_generique}];
    return[{...common,nom_campagne:campaign.nom_campagne,visuel_terrain:assignment.visuel_attendu||campaign.visuel_generique,
      date_debut:campaign.date_debut,date_fin:campaign.date_fin,statut_campagne:assignment.statut,
      emplacement:infrastructure.emplacement_visibilite??null,date_mise_a_jour:assignment.updated_at}];
  });
}

async function loadRows(context,signal){
  const [historical,assignments,campaigns,infrastructures,visuals]=await Promise.all([
    fetchAll(tableFor(context),'*',signal),fetchAll('campagnes_supports','*',signal),fetchAll('campagnes_maitres','*',signal),
    fetchAll('infrastructures','id,support_id,site,emplacement_visibilite',signal),
    fetchAll('campagne_visuels_formats','id,campagne_id,nom_visuel',signal)
  ]);
  const current=canonicalAssignmentRows(assignments,campaigns,infrastructures,visuals).filter(row=>row.business_context===context);
  const tagged=[...current,...historical.filter(row=>row.business_context===context)].map(row=>({...row,logical_key:assignmentLogicalKey(row)}));
  return normalizeUniqueAssignments(tagged);
}

export function filterRows(rows,context,search,filters){
  const global=normalizedText(search);
  return rows.filter(row=>{
    if(global&&!searchableFor(context).some(column=>normalizedText(row[column]).includes(global)))return false;
    return Object.entries(filters).every(([column,value])=>{
      if(Array.isArray(value))return !value.length||value.some(selected=>selected==='__TDM_EMPTY__'?(row[column]===null||row[column]===undefined||row[column]===''):String(row[column]??'')===String(selected));
      const term=normalizedText(value);if(!term)return true;
      const candidate=normalizedText(row[column]);
      return exactFilterColumns.has(column)?candidate===term:candidate.includes(term);
    });
  });
}

export function prepareRows(rows,context,search,filters,sortState){
  const filtered=filterRows(rows,context,search,filters);
  const requested=sortState?.column?{...defaultSortForColumn(filtered,sortState.column,sortState.type),...sortState}:defaultSortForColumn(filtered,'id','identifier');
  if(!sortState)requested.direction='desc';
  return sortRows(filtered,requested);
}

export function paginateRows(rows,page,pageSize){const size=safePageSize(pageSize),current=Math.max(1,Number(page)||1),from=(current-1)*size;return{rows:rows.slice(from,from+size),total:rows.length,page:current,pageSize:size}}

export async function getAssignmentsBySiteAndSupport({context=BUSINESS_CONTEXT.MARKETING,page=1,pageSize=25,search='',filters={},sortState=null,signal}={}){
  const size=safePageSize(pageSize),current=Math.max(1,Number(page)||1);
  if(!supabaseConfigured||!supabase)return{rows:[],total:0,page:current,pageSize:size};
  const rows=prepareRows(await loadRows(context,signal),context,search,filters,sortState);
  return paginateRows(rows,current,size);
}

export const getMarketingAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.MARKETING});
export const getOperationalCommunicationAssignmentsBySiteAndSupport=options=>getAssignmentsBySiteAndSupport({...options,context:BUSINESS_CONTEXT.OPERATIONAL});

export async function getAllAssignmentsBySiteAndSupport({context=BUSINESS_CONTEXT.MARKETING,search='',filters={},sortState=null}={}){
  if(!supabaseConfigured||!supabase)return[];
  return prepareRows(await loadRows(context),context,search,filters,sortState);
}
