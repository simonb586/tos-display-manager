import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';
import { assignmentsForContext, normalizeUniqueAssignments } from '../lib/siteSupportAssignments';

const PAGE_SIZES = [25, 50, 100, 200];
const safePageSize = value => PAGE_SIZES.includes(Number(value)) ? Number(value) : 25;

export async function getAssignmentsBySiteAndSupport({ context, page = 1, pageSize = 25, filters = {} } = {}) {
  if (!supabaseConfigured || !supabase) return { rows: [], total: 0, page: 1, pageSize: safePageSize(pageSize) };
  const size = safePageSize(pageSize);
  const from = Math.max(0, Number(page) - 1) * size;
  let allowedSupportIds=null;
  if(filters.site||filters.format||filters.issue){let infrastructureQuery=supabase.from('infrastructures').select('support_id');if(filters.site)infrastructureQuery=infrastructureQuery.eq('site',filters.site);if(filters.format)infrastructureQuery=infrastructureQuery.eq('format_affichage',filters.format);const infra=await infrastructureQuery;if(infra.error)throw infra.error;allowedSupportIds=(infra.data||[]).map(row=>row.support_id);
    if(filters.issue){const issues=await supabase.from('enjeux_des_cadres_et_supports').select('support_id').ilike('type_enjeu',`%${filters.issue}%`);if(issues.error)throw issues.error;const issueIds=new Set((issues.data||[]).map(row=>String(row.support_id)));allowedSupportIds=allowedSupportIds.filter(id=>issueIds.has(String(id)))}
  }
  let query = supabase
    .from('campagnes_supports')
    .select('id,support_id,statut,visuel_attendu,no_edt,photo_url,date_completion,updated_at,campagne_id,campagne:campagne_id!inner(id,nom_campagne,client,date_debut,date_fin,business_context)', { count: 'exact' })
    .eq('campagne.business_context', context);
  if(allowedSupportIds)query=allowedSupportIds.length?query.in('support_id',allowedSupportIds):query.eq('support_id','__none__');
  if(filters.support)query=query.ilike('support_id',`%${filters.support}%`);if(filters.client)query=query.ilike('campagne.client',`%${filters.client}%`);if(filters.campaign)query=query.ilike('campagne.nom_campagne',`%${filters.campaign}%`);if(filters.visual)query=query.ilike('visuel_attendu',`%${filters.visual}%`);if(filters.status)query=query.eq('statut',filters.status);if(filters.edt)query=query.ilike('no_edt',`%${filters.edt}%`);if(filters.dateFrom)query=query.gte('campagne.date_fin',filters.dateFrom);if(filters.dateTo)query=query.lte('campagne.date_debut',filters.dateTo);
  const { data, error, count } = await query.order('id', { ascending: false }).range(from, from + size - 1);
  if (error) throw error;
  const supportIds = [...new Set((data || []).map(row => row.support_id).filter(Boolean))];
  const infrastructureResult = supportIds.length
    ? await supabase.from('infrastructures').select('support_id,site,type_site,type_support,format_affichage,emplacement_visibilite').in('support_id', supportIds)
    : { data: [], error: null };
  if (infrastructureResult.error) throw infrastructureResult.error;
  const infrastructureBySupport = new Map((infrastructureResult.data || []).map(row => [String(row.support_id), row]));
  const projected = (data || []).map(row => ({
    ...row,
    infrastructure_record: infrastructureBySupport.get(String(row.support_id)),
    site_id: infrastructureBySupport.get(String(row.support_id))?.site,
    site: infrastructureBySupport.get(String(row.support_id))?.site,
    campaign_id: row.campagne_id,
    campaign: row.campagne?.nom_campagne,
    client: row.campagne?.client,
    business_context: row.campagne?.business_context,
    visual_id: row.visuel_id ?? row.visuel_attendu,
    visual: row.nom_visuel ?? row.visuel_attendu,
    format: infrastructureBySupport.get(String(row.support_id))?.format_affichage,
    infrastructure: infrastructureBySupport.get(String(row.support_id))?.emplacement_visibilite,
    date_debut: row.campagne?.date_debut,
    date_fin: row.campagne?.date_fin,
    derniere_activite: row.updated_at
  }));
  const rows = assignmentsForContext(projected, context);
  return { rows, total: count ?? rows.length, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export const getMarketingAssignmentsBySiteAndSupport = options => getAssignmentsBySiteAndSupport({ ...options, context: BUSINESS_CONTEXT.MARKETING });
export const getOperationalCommunicationAssignmentsBySiteAndSupport = options => getAssignmentsBySiteAndSupport({ ...options, context: BUSINESS_CONTEXT.OPERATIONAL });
export { normalizeUniqueAssignments };
