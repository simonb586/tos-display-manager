import { supabase } from '../lib/supabaseClient';

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function canAccess(role, moduleName) {
  const permissions = {
    administrateur: ['*'],
    coordonnateur: ['dashboard', 'recherche', 'infrastructures', 'arrets', 'edt', 'photos', 'bons'],
    installateur: ['recherche', 'application-terrain', 'photos', 'bons'],
    'client-admin': ['dashboard', 'recherche', 'rapports'],
    client: ['dashboard', 'rapports']
  };

  const allowed = permissions[role] || [];
  return allowed.includes('*') || allowed.includes(moduleName);
}
