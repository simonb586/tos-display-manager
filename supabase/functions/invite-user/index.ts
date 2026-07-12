import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Session absente.')

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) throw new Error('Session invalide.')

    const adminClient = createClient(url, serviceKey)
    const { data: profile, error: profileError } = await adminClient
      .from('utilisateurs')
      .select('role,statut')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'Administrateur' || profile?.statut !== 'Actif') {
      throw new Error('Accès administrateur requis.')
    }

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) throw new Error('Courriel obligatoire.')

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: body.redirectTo,
      data: { nom: body.nom, role: body.role },
    })
    if (inviteError) throw inviteError

    const { error: upsertError } = await adminClient.from('utilisateurs').upsert({
      auth_user_id: invited.user?.id || null,
      nom: body.nom || '',
      courriel: email,
      role: body.role || 'Client',
      organisation: body.organisation || '',
      statut: 'Actif',
      client_id: body.client_id ? Number(body.client_id) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'courriel' })
    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ ok: true, user_id: invited.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Erreur inconnue' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
