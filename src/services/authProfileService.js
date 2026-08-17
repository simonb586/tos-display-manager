import { supabase, supabaseConfigured } from '../lib/supabaseClient';

export async function getCurrentProfile(session) {
  if (!supabaseConfigured || !supabase || !session?.user) return null;

  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*')
    .or(`auth_user_id.eq.${session.user.id},courriel.eq.${session.user.email}`)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function requestPasswordReset(email) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');
  const redirectTo = `${window.location.origin}/update-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}
