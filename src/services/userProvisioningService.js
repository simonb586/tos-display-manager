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
      'La fonction invite-user est inaccessible.',
      'Elle doit être déployée dans le même projet Supabase que le portail.'
    ].join(' ');
  }

  return error?.message || String(error);
}

export async function inviteRealUser(payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('La session administrateur est expirée. Reconnecte-toi.');
  }

  const { data, error } = await supabase.functions.invoke('invite-user', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: {
      nom: payload.nom?.trim(),
      email: payload.courriel?.trim().toLowerCase(),
      role: payload.role,
      organisation: payload.organisation?.trim() || '',
      client_id: payload.client_id || null,
      redirectTo: `${window.location.origin}/`
    }
  });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}
