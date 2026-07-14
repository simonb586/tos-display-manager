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

function publicSiteUrl() {
  const raw =
    Deno.env.get('PUBLIC_SITE_URL') ||
    Deno.env.get('APP_PUBLIC_URL') ||
    '';

  const value = raw.trim().replace(/\/+$/, '');

  if (!value) {
    throw new Error('Le secret PUBLIC_SITE_URL est obligatoire.');
  }

  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error('PUBLIC_SITE_URL doit commencer par https://');
  }

  if (
    ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) ||
    url.hostname.endsWith('.local')
  ) {
    throw new Error('PUBLIC_SITE_URL ne peut jamais pointer vers localhost.');
  }

  return value;
}

async function callerIsAdmin(userClient: any, adminClient: any, user: any) {
  const { data, error } = await adminClient
    .from('utilisateurs')
    .select('role,statut')
    .or(`auth_user_id.eq.${user.id},courriel.eq.${user.email}`)
    .maybeSingle();

  if (error) throw error;

  return data?.role === 'Administrateur' &&
    String(data?.statut || '').toLowerCase() === 'actif';
}

async function findUser(adminClient: any, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000
    });
    if (error) throw error;

    const user = data.users.find(
      (item: any) => String(item.email || '').toLowerCase() === email
    );

    if (user) return user;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publicKey =
      Deno.env.get('SUPABASE_ANON_KEY') ||
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serverKey =
      Deno.env.get('SUPABASE_SECRET_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !publicKey || !serverKey) {
      return json({ error: 'Configuration Supabase Edge incomplète.' }, 500);
    }

    const userClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } }
    });
    const adminClient = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: 'Session invalide.' }, 401);
    }

    if (!(await callerIsAdmin(userClient, adminClient, authData.user))) {
      return json({ error: 'Accès administrateur actif requis.' }, 403);
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const nom = String(body.nom || '').trim();
    const role = String(body.role || 'Installateur').trim();
    const organisation = String(body.organisation || '').trim();
    const redirectTo = `${publicSiteUrl()}/`;

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

    let authUser = await findUser(adminClient, email);
    let invitationSent = false;

    if (!authUser) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo,
          data: { nom, role, organisation }
        }
      );

      if (error) {
        return json({
          error: `Invitation impossible : ${error.message}`,
          redirect_to: redirectTo
        }, 400);
      }

      authUser = data.user;
      invitationSent = true;
    } else if (!authUser.email_confirmed_at) {
      const { error } = await adminClient.auth.resend({
        type: 'invite',
        email,
        options: { emailRedirectTo: redirectTo }
      });

      if (error) {
        return json({
          error: `Le compte existe, mais l’invitation n’a pas pu être renvoyée : ${error.message}`
        }, 400);
      }

      invitationSent = true;
    }

    const lifecycle = authUser?.email_confirmed_at
      ? 'Actif'
      : 'Invitation envoyée';

    const { data: profile, error: profileError } = await adminClient
      .from('utilisateurs')
      .upsert({
        auth_user_id: authUser?.id || null,
        nom,
        courriel: email,
        role,
        organisation,
        statut: authUser?.banned_until ? 'Désactivé' : 'Actif',
        invitation_statut: lifecycle,
        invitation_envoyee_le: invitationSent ? new Date().toISOString() : null,
        client_id: body.client_id ? Number(body.client_id) : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'courriel' })
      .select()
      .single();

    if (profileError) {
      return json({ error: `Profil non enregistré : ${profileError.message}` }, 500);
    }

    return json({
      ok: true,
      invitation_sent: invitationSent,
      redirect_to: redirectTo,
      profile,
      message: invitationSent
        ? `Invitation envoyée vers ${redirectTo}`
        : 'Le compte était déjà actif; son profil a été mis à jour.'
    });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || String(error) }, 500);
  }
});
