import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  }
);

async function findExistingUser(adminClient: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (error) throw error;

    const found = data.users.find(
      (user: any) => String(user.email || '').toLowerCase() === email
    );

    if (found) return found;
    if (data.users.length < 1000) break;
  }

  return null;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Session absente.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey =
      Deno.env.get('SUPABASE_ANON_KEY') ||
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serverSecret =
      Deno.env.get('SUPABASE_SECRET_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !publishableKey || !serverSecret) {
      return json({
        error: 'Configuration serveur incomplète.',
        missing: {
          SUPABASE_URL: !supabaseUrl,
          SUPABASE_PUBLISHABLE_OR_ANON_KEY: !publishableKey,
          SUPABASE_SECRET_OR_SERVICE_ROLE_KEY: !serverSecret
        }
      }, 500);
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } }
    });

    const { data: userData, error: userError } =
      await callerClient.auth.getUser();

    if (userError || !userData.user) {
      return json({ error: 'Session invalide.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serverSecret, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: profile, error: profileError } = await adminClient
      .from('utilisateurs')
      .select('role,statut,courriel')
      .or(
        `auth_user_id.eq.${userData.user.id},courriel.eq.${userData.user.email}`
      )
      .maybeSingle();

    if (profileError) {
      return json({ error: `Profil administrateur illisible : ${profileError.message}` }, 500);
    }

    if (
      profile?.role !== 'Administrateur' ||
      String(profile?.statut || '').toLowerCase() !== 'actif'
    ) {
      return json({ error: 'Accès administrateur actif requis.' }, 403);
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const nom = String(body.nom || '').trim();
    const role = String(body.role || 'Client').trim();
    const organisation = String(body.organisation || '').trim();
    const redirectTo = String(body.redirectTo || '').trim();

    if (!email || !email.includes('@')) {
      return json({ error: 'Courriel valide obligatoire.' }, 400);
    }

    const allowedRoles = [
      'Administrateur',
      'Coordonnateur',
      'Installateur',
      'Client-Admin',
      'Client'
    ];

    if (!allowedRoles.includes(role)) {
      return json({ error: 'Rôle invalide.' }, 400);
    }

    let authUser = await findExistingUser(adminClient, email);
    let invitationSent = false;

    if (!authUser) {
      const { data: invited, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirectTo || undefined,
          data: { nom, role, organisation }
        });

      if (inviteError) {
        return json({
          error: `Supabase Auth n’a pas pu envoyer l’invitation : ${inviteError.message}`,
          hint:
            'Vérifie Authentication > SMTP Settings, les URL de redirection autorisées et les journaux Auth.'
        }, 400);
      }

      authUser = invited.user;
      invitationSent = true;
    }

    const profilePayload = {
      auth_user_id: authUser?.id || null,
      nom,
      courriel: email,
      role,
      organisation,
      statut: 'Actif',
      client_id: body.client_id ? Number(body.client_id) : null,
      updated_at: new Date().toISOString()
    };

    const { data: savedProfile, error: upsertError } = await adminClient
      .from('utilisateurs')
      .upsert(profilePayload, { onConflict: 'courriel' })
      .select()
      .single();

    if (upsertError) {
      return json({
        error: `Le compte Auth existe, mais le profil n’a pas pu être enregistré : ${upsertError.message}`
      }, 500);
    }

    return json({
      ok: true,
      invitation_sent: invitationSent,
      already_existed: !invitationSent,
      user_id: authUser?.id,
      profile: savedProfile,
      message: invitationSent
        ? 'Invitation envoyée.'
        : 'Le compte existait déjà; son profil a été mis à jour.'
    });
  } catch (error) {
    console.error(error);
    return json({
      error: error?.message || 'Erreur inconnue dans invite-user.'
    }, 500);
  }
});
