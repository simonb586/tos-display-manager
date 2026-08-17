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
    Deno.env.get('CLIENT_PORTAL_URL') ||
    Deno.env.get('PUBLIC_SITE_URL') ||
    Deno.env.get('APP_PUBLIC_URL') ||
    '';

  const value = raw.trim().replace(/\/+$/, '');
  if (!value) throw new Error('PUBLIC_SITE_URL est obligatoire.');

  const url = new URL(value);

  if (
    url.protocol !== 'https:' ||
    ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
  ) {
    throw new Error('PUBLIC_SITE_URL doit être une adresse HTTPS publique.');
  }

  return value;
}

async function listAllAuthUsers(admin: any) {
  const output = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000
    });
    if (error) throw error;
    output.push(...data.users);
    if (data.users.length < 1000) break;
  }

  return output;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const caller = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } }
    });
    const admin = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: 'Session invalide.' }, 401);
    }

    const { data: callerProfile } = await admin
      .from('utilisateurs')
      .select('role,statut')
      .or(`auth_user_id.eq.${authData.user.id},courriel.eq.${authData.user.email}`)
      .maybeSingle();

    if (
      callerProfile?.role !== 'Administrateur' ||
      String(callerProfile?.statut || '').toLowerCase() !== 'actif'
    ) {
      return json({ error: 'Accès administrateur actif requis.' }, 403);
    }

    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'list') {
      const [authUsers, profilesResult] = await Promise.all([
        listAllAuthUsers(admin),
        admin.from('utilisateurs').select('*').order('nom')
      ]);

      if (profilesResult.error) throw profilesResult.error;

      const authByEmail = new Map(
        authUsers.map((user: any) => [String(user.email || '').toLowerCase(), user])
      );

      const profileByEmail = new Map(
        (profilesResult.data || []).map((profile: any) => [
          String(profile.courriel || '').toLowerCase(),
          profile
        ])
      );

      const emails = new Set([
        ...authByEmail.keys(),
        ...profileByEmail.keys()
      ]);

      const users = [...emails].map(email => {
        const authUser: any = authByEmail.get(email);
        const profile: any = profileByEmail.get(email);

        let lifecycle = 'Invitation envoyée';

        if (profile?.statut === 'Désactivé' || authUser?.banned_until) {
          lifecycle = 'Désactivé';
        } else if (authUser?.email_confirmed_at) {
          lifecycle = 'Actif';
        } else if (!authUser) {
          lifecycle = 'Profil sans compte Auth';
        }

        return {
          profile_id: profile?.id || null,
          auth_user_id: authUser?.id || profile?.auth_user_id || null,
          nom: profile?.nom || authUser?.user_metadata?.nom || '',
          courriel: email,
          role: profile?.role || authUser?.user_metadata?.role || 'Installateur',
          organisation: profile?.organisation || authUser?.user_metadata?.organisation || '',
          statut: profile?.statut || (authUser?.banned_until ? 'Désactivé' : 'Actif'),
          lifecycle_status: lifecycle,
          email_confirmed_at: authUser?.email_confirmed_at || null,
          invited_at: authUser?.invited_at || profile?.invitation_envoyee_le || null,
          last_sign_in_at: authUser?.last_sign_in_at || null,
          created_at: authUser?.created_at || profile?.created_at || null
        };
      });

      return json({ users });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const userId = body.user_id || null;

    let authUser = null;

    if (userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (!error) authUser = data.user;
    }

    if (!authUser && email) {
      authUser = (await listAllAuthUsers(admin)).find(
        (user: any) => String(user.email || '').toLowerCase() === email
      );
    }

    if (action === 'resend_invite') {
      if (!email) return json({ error: 'Courriel absent.' }, 400);

      const redirectTo = `${publicSiteUrl()}/set-password`;

      if (authUser?.email_confirmed_at) {
        const { error } = await admin.auth.resetPasswordForEmail(email, {
          redirectTo
        });
        if (error) throw error;

        return json({
          message: 'Le compte était déjà confirmé; un lien de réinitialisation a été envoyé.'
        });
      }

      if (!authUser) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo,
            data: {
              nom: body.nom || '',
              role: body.role || 'Installateur',
              organisation: body.organisation || '',
              account_activated: false
            }
          }
        );
        if (error) throw error;
        authUser = data.user;
      } else {
        const { error } = await admin.auth.resend({
          type: 'invite',
          email,
          options: { emailRedirectTo: redirectTo }
        });
        if (error) throw error;
      }

      await admin
        .from('utilisateurs')
        .update({
          invitation_statut: 'Invitation envoyée',
          invitation_envoyee_le: new Date().toISOString()
        })
        .eq('courriel', email);

      return json({ message: `Invitation renvoyée vers ${redirectTo}` });
    }

    if (action === 'reset_password') {
      if (!email) return json({ error: 'Courriel absent.' }, 400);

      const { error } = await admin.auth.resetPasswordForEmail(email, {
        redirectTo: `${publicSiteUrl()}/`
      });
      if (error) throw error;

      return json({ message: 'Courriel de réinitialisation envoyé.' });
    }

    if (action === 'deactivate') {
      if (!authUser) return json({ error: 'Compte Auth introuvable.' }, 404);

      const { error } = await admin.auth.admin.updateUserById(authUser.id, {
        ban_duration: '876000h'
      });
      if (error) throw error;

      await admin
        .from('utilisateurs')
        .update({ statut: 'Désactivé', updated_at: new Date().toISOString() })
        .eq('courriel', email);

      return json({ message: 'Utilisateur désactivé.' });
    }

    if (action === 'reactivate') {
      if (!authUser) return json({ error: 'Compte Auth introuvable.' }, 404);

      const { error } = await admin.auth.admin.updateUserById(authUser.id, {
        ban_duration: 'none'
      });
      if (error) throw error;

      await admin
        .from('utilisateurs')
        .update({ statut: 'Actif', updated_at: new Date().toISOString() })
        .eq('courriel', email);

      return json({ message: 'Utilisateur réactivé.' });
    }

    if (action === 'update') {
      const patch = body.patch || {};

      if (authUser) {
        const { error } = await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: {
            ...(authUser.user_metadata || {}),
            nom: patch.nom,
            role: patch.role,
            organisation: patch.organisation
          }
        });
        if (error) throw error;
      }

      const { error } = await admin
        .from('utilisateurs')
        .update({
          nom: patch.nom,
          role: patch.role,
          organisation: patch.organisation,
          statut: patch.statut,
          updated_at: new Date().toISOString()
        })
        .eq('courriel', email);

      if (error) throw error;
      return json({ message: 'Utilisateur modifié.' });
    }

    if (action === 'delete') {
      if (authUser) {
        const { error } = await admin.auth.admin.deleteUser(authUser.id);
        if (error) throw error;
      }

      const { error } = await admin
        .from('utilisateurs')
        .delete()
        .eq('courriel', email);

      if (error) throw error;

      return json({
        message: 'Compte Auth et profil supprimés. Les historiques opérationnels sont conservés.'
      });
    }

    return json({ error: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || String(error) }, 500);
  }
});
