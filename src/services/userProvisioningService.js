import { supabase } from '../lib/supabaseClient';

export async function inviteRealUser(payload) {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      nom: payload.nom?.trim(),
      email: payload.courriel?.trim().toLowerCase(),
      role: payload.role,
      organisation: payload.organisation?.trim() || '',
      client_id: payload.client_id || null,
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
