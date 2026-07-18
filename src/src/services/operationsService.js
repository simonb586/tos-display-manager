import { supabase, supabaseConfigured } from '../lib/supabaseClient';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

export async function loadOperationsData() {
  ensureSupabase();

  const [
    edtResult,
    btResult,
    requestsResult,
    phasesResult,
    assignmentsResult,
    historyResult,
    usersResult
  ] = await Promise.all([
    supabase.from('suivi_des_edt').select('*').order('date_debut', { ascending: false, nullsFirst: false }),
    supabase.from('bons_de_travail').select('*').order('date_cible', { ascending: true, nullsFirst: false }),
    supabase.from('requetes_clients').select('*').order('created_at', { ascending: false }),
    supabase.from('edt_phases').select('*').order('ordre', { ascending: true }),
    supabase.from('edt_assignments').select('*').order('created_at', { ascending: false }),
    supabase.from('operations_history').select('*').order('created_at', { ascending: false }).limit(500),
    supabase.from('utilisateurs').select('id,nom,courriel,role,statut').order('nom')
  ]);

  for (const result of [
    edtResult,
    btResult,
    requestsResult,
    phasesResult,
    assignmentsResult,
    historyResult,
    usersResult
  ]) {
    if (result.error) throw result.error;
  }

  return {
    edts: edtResult.data || [],
    workOrders: btResult.data || [],
    requests: requestsResult.data || [],
    phases: phasesResult.data || [],
    assignments: assignmentsResult.data || [],
    history: historyResult.data || [],
    users: usersResult.data || []
  };
}

export async function createEdt(payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('suivi_des_edt')
    .insert({
      no_edt: payload.no_edt?.trim() || `EDT-${Date.now()}`,
      nom: payload.nom?.trim() || payload.campagne?.trim() || 'Nouvel EDT',
      campagne: payload.campagne?.trim() || null,
      client: payload.client?.trim() || null,
      statut: payload.statut || 'Planifié',
      priorite: payload.priorite || 'Normale',
      date_debut: payload.date_debut || null,
      date_fin_prevue: payload.date_fin_prevue || null,
      coordonnateur: payload.coordonnateur || null,
      supports_prevus: Number(payload.supports_prevus || 0),
      description: payload.description?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEdt(id, patch) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('suivi_des_edt')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createPhase(payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('edt_phases')
    .insert({
      edt_id: payload.edt_id,
      nom: payload.nom?.trim() || 'Phase',
      ordre: Number(payload.ordre || 1),
      statut: payload.statut || 'À faire',
      date_debut_prevue: payload.date_debut_prevue || null,
      date_fin_prevue: payload.date_fin_prevue || null,
      progression: Number(payload.progression || 0),
      notes: payload.notes?.trim() || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePhase(id, patch) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('edt_phases')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignUser(payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('edt_assignments')
    .upsert({
      edt_id: payload.edt_id,
      user_id: payload.user_id || null,
      user_email: payload.user_email,
      role_assignment: payload.role_assignment || 'Installateur',
      date_debut: payload.date_debut || null,
      date_fin: payload.date_fin || null,
      statut: payload.statut || 'Assigné'
    }, { onConflict: 'edt_id,user_email,role_assignment' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createClientRequest(payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('requetes_clients')
    .insert({
      client: payload.client?.trim() || null,
      demandeur_nom: payload.demandeur_nom?.trim() || null,
      demandeur_courriel: payload.demandeur_courriel?.trim() || null,
      type_requete: payload.type_requete || 'Installation',
      priorite: payload.priorite || 'Normale',
      support_id: payload.support_id?.trim() || null,
      description: payload.description?.trim() || null,
      statut: 'Nouvelle'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function convertRequestToWorkOrder(request) {
  ensureSupabase();

  const noBt = `BT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${request.id}`;

  const { data: workOrder, error: btError } = await supabase
    .from('bons_de_travail')
    .insert({
      no_bt: noBt,
      type_bt: request.type_requete || 'Installation',
      support_id: request.support_id || null,
      priorite: request.priorite || 'Normale',
      statut: 'À faire',
      client: request.client || null,
      description: request.description || null,
      requete_client_id: request.id,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (btError) throw btError;

  const { error: requestError } = await supabase
    .from('requetes_clients')
    .update({
      statut: 'Convertie',
      bon_de_travail_id: workOrder.id,
      converted_at: new Date().toISOString()
    })
    .eq('id', request.id);

  if (requestError) throw requestError;
  return workOrder;
}

export async function createWorkOrderV11(payload) {
  ensureSupabase();
  const { data, error } = await supabase
    .from('bons_de_travail')
    .insert({
      no_bt: payload.no_bt?.trim() || `BT-${Date.now()}`,
      type_bt: payload.type_bt || 'Installation',
      support_id: payload.support_id?.trim() || null,
      no_edt: payload.no_edt?.trim() || null,
      edt_id: payload.edt_id || null,
      phase_id: payload.phase_id || null,
      priorite: payload.priorite || 'Normale',
      statut: payload.statut || 'À faire',
      assigne_a: payload.assigne_a || null,
      date_cible: payload.date_cible || null,
      date_debut_reelle: payload.date_debut_reelle || null,
      date_fin_reelle: payload.date_fin_reelle || null,
      client: payload.client?.trim() || null,
      description: payload.description?.trim() || null,
      progression: Number(payload.progression || 0),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkOrderV11(id, patch) {
  ensureSupabase();
  const normalized = { ...patch, updated_at: new Date().toISOString() };

  if (patch.statut === 'En cours' && !patch.date_debut_reelle) {
    normalized.date_debut_reelle = new Date().toISOString();
  }

  if (patch.statut === 'Terminée') {
    normalized.progression = 100;
    normalized.date_fin_reelle = patch.date_fin_reelle || new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('bons_de_travail')
    .update(normalized)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function closeEdt(id) {
  ensureSupabase();

  const { data: openOrders, error: orderError } = await supabase
    .from('bons_de_travail')
    .select('id,statut')
    .eq('edt_id', id)
    .not('statut', 'in', '("Terminée","Annulée")');

  if (orderError) throw orderError;

  if (openOrders?.length) {
    throw new Error(`${openOrders.length} bon(s) de travail sont encore ouverts.`);
  }

  return updateEdt(id, {
    statut: 'Terminé',
    progression: 100,
    date_fin: new Date().toISOString().slice(0, 10)
  });
}

export function computeEdtProgress(edt, workOrders, phases) {
  const edtOrders = workOrders.filter(order =>
    String(order.edt_id || '') === String(edt.id) ||
    (edt.no_edt && String(order.no_edt || '') === String(edt.no_edt))
  );

  const edtPhases = phases.filter(phase => String(phase.edt_id) === String(edt.id));

  if (edtOrders.length) {
    const total = edtOrders.reduce((sum, order) => sum + Number(order.progression || (order.statut === 'Terminée' ? 100 : 0)), 0);
    return Math.round(total / edtOrders.length);
  }

  if (edtPhases.length) {
    const total = edtPhases.reduce((sum, phase) => sum + Number(phase.progression || 0), 0);
    return Math.round(total / edtPhases.length);
  }

  return Number(edt.progression || 0);
}
