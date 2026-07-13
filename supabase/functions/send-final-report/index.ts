import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const json = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  }
);

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'Authentification requise.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const sender = Deno.env.get('REPORT_FROM_EMAIL') || 'noreply@groupetos.com';

    if (!resendApiKey) {
      return json({ error: 'Le secret RESEND_API_KEY est absent.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) {
      return json({ error: 'Session invalide.' }, 401);
    }

    const { data: profile } = await userClient
      .from('utilisateurs')
      .select('role, statut')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();

    if (!profile || profile.statut !== 'Actif' || !['Administrateur', 'Coordonnateur'].includes(profile.role)) {
      return json({ error: 'Accès refusé.' }, 403);
    }

    const body = await request.json();
    const recipients = Array.isArray(body.recipients) ? body.recipients : [];
    const cc = Array.isArray(body.cc) ? body.cc : [];

    if (!recipients.length || !body.reportPath) {
      return json({ error: 'Destinataire ou rapport manquant.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: report, error: reportError } = await admin.storage
      .from('final-reports')
      .download(body.reportPath);

    if (reportError || !report) {
      return json({ error: 'Le PDF archivé est introuvable.' }, 404);
    }

    const bytes = new Uint8Array(await report.arrayBuffer());
    let binary = '';

    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }

    const base64 = btoa(binary);
    const context = body.context || {};

    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:680px;margin:auto">
        <div style="background:#111827;color:white;padding:24px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:23px">Rapport final d’installation</h1>
          <p style="margin:8px 0 0;color:#ddd6fe">${context.campaignName || ''}</p>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0">
          <p>Bonjour,</p>
          <p>Les travaux d’installation associés à l’EDT <strong>${context.edtNumber || ''}</strong> sont maintenant terminés.</p>
          <table style="border-collapse:collapse;width:100%;margin:18px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Supports prévus</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${context.planned ?? ''}</strong></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Supports installés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${context.installed ?? ''}</strong></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Supports non installés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right"><strong>${context.notInstalled ?? ''}</strong></td></tr>
          </table>
          <p>Le rapport PDF officiel est joint à ce courriel. Les photos d’installation demeurent accessibles dans le portail client.</p>
          <p>Merci de votre confiance.</p>
          <p><strong>Groupe TOS</strong></p>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: sender,
        to: recipients,
        cc,
        subject: body.subject || `Rapport final d’installation – ${context.campaignName || ''}`,
        html,
        attachments: [
          {
            filename: `Rapport-final-${context.edtNumber || 'installation'}.pdf`,
            content: base64
          }
        ]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return json({ error: result?.message || 'Échec de l’envoi du courriel.', details: result }, response.status);
    }

    return json(result);
  } catch (error) {
    return json({ error: error.message || String(error) }, 500);
  }
});
