import { supabase, supabaseConfigured } from '../lib/supabaseClient';
const ready=()=>{if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');};

async function safeQuery(table, supportId, columns='*', supportFields=['support_id']) {
  ready();
  for (const field of supportFields) {
    const {data,error}=await supabase.from(table).select(columns).eq(field,supportId).limit(500);
    if(!error)return data||[];
    if(!['42703','42P01','PGRST204','PGRST205'].includes(error.code))throw error;
  }
  return [];
}

export async function loadSupport360(supportId) {
  const [history,issues,inspections,workOrders,edtLinks,logs]=await Promise.all([
    safeQuery('historique_des_campagnes',supportId,'*',['support_id','related_support']),
    safeQuery('enjeux_terrain',supportId,'*',['support_id']),
    safeQuery('inspections',supportId,'*',['support_id']),
    safeQuery('bons_de_travail',supportId,'*',['support_id','related_support']),
    safeQuery('edt_supports',supportId,'*',['support_id']),
    safeQuery('photo_action_log',supportId,'*',['support_id'])
  ]);
  return {history,issues,inspections,workOrders,edtLinks,logs};
}
