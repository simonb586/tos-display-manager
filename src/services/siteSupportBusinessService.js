import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { BUSINESS_CONTEXT } from '../lib/businessContext';
import { assignmentsForContext, normalizeUniqueAssignments } from '../lib/siteSupportAssignments';

const PAGE_SIZES = [25, 50, 100, 200];
const safePageSize = value => PAGE_SIZES.includes(Number(value)) ? Number(value) : 25;

export async function getAssignmentsBySiteAndSupport({ context, page = 1, pageSize = 25 } = {}) {
  if (!supabaseConfigured || !supabase) return { rows: [], total: 0, page: 1, pageSize: safePageSize(pageSize) };
  const size = safePageSize(pageSize);
  const from = Math.max(0, Number(page) - 1) * size;
  const { data, error, count } = await supabase
    .from('campagnes_supports')
    .select('id,support_id,statut,visuel_attendu,no_edt,photo_url,date_completion,campagne_id,campagne:campagne_id(id,nom_campagne,client,date_debut,date_fin,business_context)', { count: 'exact' })
    .eq('campagne.business_context', context)
    .order('id', { ascending: false })
    .range(from, from + size - 1);
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
    date_fin: row.campagne?.date_fin
  }));
  const rows = assignmentsForContext(projected, context);
  return { rows, total: count ?? rows.length, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export const getMarketingAssignmentsBySiteAndSupport = options => getAssignmentsBySiteAndSupport({ ...options, context: BUSINESS_CONTEXT.MARKETING });
export const getOperationalCommunicationAssignmentsBySiteAndSupport = options => getAssignmentsBySiteAndSupport({ ...options, context: BUSINESS_CONTEXT.OPERATIONAL });
export { normalizeUniqueAssignments };
