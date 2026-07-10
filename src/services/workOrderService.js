import { supabase, supabaseConfigured } from '../lib/supabaseClient';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

export async function listWorkOrders() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('bons_de_travail')
    .select('*')
    .order('date_cible', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createWorkOrder(order) {
  ensureSupabase();

  const payload = {
    no_bt: order.no_bt?.trim() || `BT-${Date.now()}`,
    type_bt: order.type_bt || 'Inspection',
    support_id: order.support_id?.trim() || null,
    no_edt: order.no_edt?.trim() || null,
    priorite: order.priorite || 'Normale',
    statut: order.statut || 'À faire',
    assigne_a: order.assigne_a?.trim() || null,
    date_cible: order.date_cible || null,
    client: order.client?.trim() || null,
    description: order.description?.trim() || null,
    created_by: order.created_by || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('bons_de_travail')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkOrder(id, patch) {
  ensureSupabase();

  const { data, error } = await supabase
    .from('bons_de_travail')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkOrder(id) {
  ensureSupabase();
  const { error } = await supabase.from('bons_de_travail').delete().eq('id', id);
  if (error) throw error;
}

export async function listInstallers() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('id,nom,courriel,role,statut')
    .in('role', ['Installateur', 'Coordonnateur', 'Administrateur'])
    .order('nom', { ascending: true });

  if (error) throw error;
  return data || [];
}
