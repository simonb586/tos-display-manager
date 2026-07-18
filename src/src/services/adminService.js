import { supabase } from '../lib/supabaseClient';

export async function listUsers() {
  const { data, error } = await supabase.from('utilisateurs').select('*').order('nom', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveUser(user) {
  const payload = {
    nom: user.nom?.trim() || '',
    courriel: user.courriel?.trim().toLowerCase() || '',
    role: user.role || 'Client',
    organisation: user.organisation?.trim() || '',
    statut: user.statut || 'Actif',
    client_id: user.client_id || null,
    updated_at: new Date().toISOString()
  };
  if (!payload.courriel) throw new Error('Le courriel est obligatoire.');

  const query = user.id
    ? supabase.from('utilisateurs').update(payload).eq('id', user.id)
    : supabase.from('utilisateurs').insert(payload);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function toggleUserStatus(user) {
  const next = String(user.statut || '').toLowerCase() === 'actif' ? 'Inactif' : 'Actif';
  const { data, error } = await supabase
    .from('utilisateurs')
    .update({ statut: next, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listClients() {
  const { data, error } = await supabase.from('clients').select('*').order('nom_client', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveClient(client) {
  const payload = {
    nom_client: client.nom_client?.trim() || '',
    type_client: client.type_client?.trim() || '',
    statut: client.statut || 'Actif',
    notes: client.notes?.trim() || '',
    updated_at: new Date().toISOString()
  };
  if (!payload.nom_client) throw new Error('Le nom du client est obligatoire.');

  const query = client.id
    ? supabase.from('clients').update(payload).eq('id', client.id)
    : supabase.from('clients').insert(payload);

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
