import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError
} from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

async function edgeErrorMessage(error) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      return payload?.error || payload?.message || error.message;
    } catch {
      return error.message;
    }
  }

  if (error instanceof FunctionsRelayError) {
    return `La passerelle Supabase n’a pas joint la fonction : ${error.message}`;
  }

  if (error instanceof FunctionsFetchError) {
    return [
      'La fonction de gestion des utilisateurs est inaccessible.',
      'Déploie invite-user et manage-user dans le même projet Supabase que le portail.'
    ].join(' ');
  }

  return error?.message || String(error);
}

async function invoke(functionName, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('La session administrateur est expirée. Reconnecte-toi.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    headers: { Authorization: `Bearer ${token}` },
    body
  });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function inviteRealUser(payload) {
  return invoke('invite-user', {
    nom: payload.nom?.trim(),
    email: payload.courriel?.trim().toLowerCase(),
    role: payload.role,
    organisation: payload.organisation?.trim() || '',
    client_id: payload.client_id || null
  });
}

export async function listManagedUsers() {
  const result = await invoke('manage-user', { action: 'list' });
  return result.users || [];
}

export async function manageUser(action, user) {
  return invoke('manage-user', {
    action,
    user_id: user.auth_user_id || user.user_id || null,
    profile_id: user.profile_id || user.id || null,
    email: user.courriel || user.email,
    role: user.role,
    nom: user.nom,
    organisation: user.organisation
  });
}

export async function updateManagedUser(user, patch) {
  return invoke('manage-user', {
    action: 'update',
    user_id: user.auth_user_id || user.user_id || null,
    profile_id: user.profile_id || user.id || null,
    email: user.courriel || user.email,
    patch
  });
}
