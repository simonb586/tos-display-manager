import { supabase } from '../lib/supabaseClient';

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());

export async function searchInfrastructures(query, limit = 50) {
  const q = clean(query);

  let request = supabase
    .from('infrastructures')
    .select('*')
    .limit(limit);

  if (q) {
    request = request.or(
      [
        `support_id.ilike.%${q}%`,
        `site.ilike.%${q}%`,
        `emplacement_visibilite.ilike.%${q}%`,
        `type_support.ilike.%${q}%`,
        `campagne_actuelle.ilike.%${q}%`
      ].join(',')
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export async function searchArrets(query, limit = 50) {
  const q = clean(query);

  let request = supabase
    .from('liste_des_arrets')
    .select('*')
    .limit(limit);

  if (q) {
    request = request.or(
      [
        `no_arret.ilike.%${q}%`,
        `emplacement_visibilite.ilike.%${q}%`,
        `type_support.ilike.%${q}%`,
        `statut.ilike.%${q}%`,
        `visuel_affiche.ilike.%${q}%`
      ].join(',')
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export async function searchEdt(query, limit = 50) {
  const q = clean(query);

  let request = supabase
    .from('suivi_des_edt')
    .select('*')
    .limit(limit);

  if (q) {
    request = request.or(
      [
        `no_edt.ilike.%${q}%`,
        `campagne.ilike.%${q}%`,
        `client.ilike.%${q}%`,
        `statut.ilike.%${q}%`,
        `coordonnateur.ilike.%${q}%`
      ].join(',')
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export async function universalSearch(type, query, limit = 50) {
  if (type === 'arret') return searchArrets(query, limit);
  if (type === 'edt') return searchEdt(query, limit);
  return searchInfrastructures(query, limit);
}
