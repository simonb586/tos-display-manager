import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const firstValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }
  return fallback;
};

const safeNumber = value => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizeFinalReportContext({ edt, campaign, client, requester = {}, issues = [], supports = [], photos = [] }) {
  const planned = safeNumber(firstValue(edt, [
    'supports_prevus', 'nombre_supports_prevus', 'total_prevus', 'quantite_prevue'
  ], supports.length));

  const installed = safeNumber(firstValue(edt, [
    'supports_installes', 'nombre_supports_installes', 'total_installes', 'quantite_installee'
  ], supports.filter(item => {
    const status = String(firstValue(item, ['statut', 'etat', 'installation_statut'])).toLowerCase();
    return status.includes('install');
  }).length));

  const notInstalled = Math.max(0, planned - installed);

  return {
    clientName: String(firstValue(client, ['nom', 'client', 'raison_sociale', 'organisation'], 'Client')),
    campaignName: String(firstValue(campaign, [
      'nom', 'nom_campagne', 'campagne', 'nom_de_la_campagne'
    ], firstValue(edt, ['campagne', 'nom_campagne'], 'Campagne'))),
    edtNumber: String(firstValue(edt, ['no_edt', 'numero_edt', 'edt', 'code'], '—')),
    startDate: String(firstValue(edt, ['date_debut', 'debut', 'date_debut_travaux'], '—')),
    endDate: String(firstValue(edt, ['date_fin', 'fin', 'date_fin_travaux'], new Date().toISOString().slice(0, 10))),
    coordinator: String(firstValue(edt, ['coordonnateur', 'responsable', 'assigne_a'], 'Groupe TOS')),
    requesterName: String(firstValue(requester, ['nom', 'name'], firstValue(edt,['requester_name'],'—'))),
    requesterEmail: String(firstValue(requester, ['courriel', 'email'], firstValue(edt,['requester_email'],'—'))),
    finalStatus: String(firstValue(edt,['statut','status'],'Complété')),
    completionDate: String(firstValue(edt,['date_fin','completed_at'],new Date().toISOString().slice(0,10))),
    workSummary: String(firstValue(edt,['description','commentaires','travaux_realises'],'Travaux associés à l’EDT complétés.')),
    photoCount: photos.length,
    planned,
    installed,
    notInstalled,
    issueSummary: issues.length
      ? issues.map(item => String(firstValue(item, ['enjeux', 'description', 'type_enjeux'], 'Enjeu'))).join(' • ')
      : 'Aucun enjeu majeur signalé.',
    clientLogoUrl: String(firstValue(client, ['logo_url', 'logo', 'client_logo_url'], '')),
    reportColor: String(firstValue(client, ['couleur_rapport', 'report_color'], '#4c1d95')),
    legalFooter: String(firstValue(client, ['mention_legale', 'report_footer'], '')),
    recipients: String(firstValue(client, [
      'courriels_rapport', 'courriel_rapport', 'courriel', 'email'
    ], '')).split(/[;,]/).map(value => value.trim()).filter(Boolean),
    cc: String(firstValue(client, ['courriels_cc', 'courriel_cc'], ''))
      .split(/[;,]/).map(value => value.trim()).filter(Boolean)
  };
}

async function imageToDataUrl(url) {
  if (!url) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function addSummaryLine(doc, label, value, y) {
  doc.setFont('helvetica', 'bold');
  doc.text(label, 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(value ?? '—'), 78, y);
}

export async function generateFinalReportPdf(context) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const generatedAt = new Date();
  const logo = await imageToDataUrl(context.clientLogoUrl);

  doc.setFillColor(18, 32, 58);
  doc.rect(0, 0, 216, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RAPPORT FINAL D’INSTALLATION', 20, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Groupe TOS — TOS Display Manager', 20, 27);

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 166, 7, 30, 20, undefined, 'FAST');
    } catch {
      // Le rapport reste valide sans logo si le format distant n'est pas compatible.
    }
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(context.campaignName, 20, 51);

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 56, 196, 56);

  doc.setFontSize(10);
  let y = 67;
  addSummaryLine(doc, 'Client', context.clientName, y); y += 8;
  addSummaryLine(doc, 'Numéro EDT', context.edtNumber, y); y += 8;
  addSummaryLine(doc, 'Date de début', context.startDate, y); y += 8;
  addSummaryLine(doc, 'Date de fin', context.endDate, y); y += 8;
  addSummaryLine(doc, 'Coordonnateur', context.coordinator, y); y += 13;
  addSummaryLine(doc, 'Requérant', `${context.requesterName} — ${context.requesterEmail}`, y); y += 8;
  addSummaryLine(doc, 'Statut final', context.finalStatus, y); y += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Sommaire d’exécution', 20, y);
  y += 8;

  const boxes = [
    ['Supports prévus', context.planned],
    ['Supports installés', context.installed],
    ['Non installés', context.notInstalled]
  ];

  boxes.forEach((item, index) => {
    const x = 20 + index * 59;
    doc.setFillColor(index === 1 ? 236 : 248, index === 1 ? 253 : 250, index === 1 ? 245 : 252);
    doc.roundedRect(x, y, 53, 28, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item[1]), x + 26.5, y + 12, { align: 'center' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(item[0], x + 26.5, y + 21, { align: 'center' });
  });

  y += 40;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Enjeux et observations', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const issueLines = doc.splitTextToSize(context.issueSummary, 176);
  doc.text(issueLines, 20, y);
  y += issueLines.length * 5 + 12;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, y, 176, 24, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Confirmation', 26, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Les travaux d’installation associés à cet EDT sont déclarés terminés.',
    26,
    y + 16
  );

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const footer = `Rapport généré automatiquement le ${generatedAt.toLocaleDateString('fr-CA')} à ${generatedAt.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}.`;
  doc.text(footer, 20, 260);

  if (context.legalFooter) {
    const legalLines = doc.splitTextToSize(context.legalFooter, 176);
    doc.text(legalLines, 20, 267);
  }

  return doc.output('blob');
}

export async function generateFinalReportExcel(context, supports = []) {
  const XLSX = await import('xlsx');
  const summary = [
    ['Client', context.clientName],
    ['Campagne', context.campaignName],
    ['Numéro EDT', context.edtNumber],
    ['Date de début', context.startDate],
    ['Date de fin', context.endDate],
    ['Coordonnateur', context.coordinator],
    ['Supports prévus', context.planned],
    ['Supports installés', context.installed],
    ['Supports non installés', context.notInstalled],
    ['Enjeux', context.issueSummary]
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), 'Sommaire');

  if (supports.length) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(supports),
      'Supports'
    );
  }

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

export async function uploadFinalReport({ blob, context, edtId }) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const cleanEdt = String(context.edtNumber || edtId || 'rapport')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const path = `${cleanEdt}/${Date.now()}-rapport-final.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('final-reports')
    .upload(path, blob, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) throw uploadError;

  return path;
}

export async function createCommunicationLog(payload) {
  const { data, error } = await supabase
    .from('communications_finales')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function sendFinalReportEmail(payload) {
  const { data, error } = await supabase.functions.invoke('send-final-report', {
    body: payload
  });

  if (error) throw error;
  return data;
}

export async function closeEdtAndSendFinalReport({
  edt,
  campaign,
  client,
  issues,
  supports,
  recipients,
  cc
}) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const context = normalizeFinalReportContext({
    edt,
    campaign,
    client,
    issues,
    supports
  });

  const finalRecipients = recipients?.length ? recipients : context.recipients;
  const finalCc = cc?.length ? cc : context.cc;

  if (!finalRecipients.length) {
    throw new Error('Aucun destinataire de rapport n’est configuré.');
  }

  const pdfBlob = await generateFinalReportPdf(context);
  const edtId = edt.id || edt.edt_id || edt.no_edt || edt.numero_edt;
  const reportPath = await uploadFinalReport({ blob: pdfBlob, context, edtId });

  const communication = await createCommunicationLog({
    edt_id: String(edtId || ''),
    numero_edt: context.edtNumber,
    campagne: context.campaignName,
    client: context.clientName,
    destinataires: finalRecipients,
    cc: finalCc,
    objet: `Rapport final d’installation – ${context.campaignName}`,
    statut: 'En attente',
    report_path: reportPath,
    report_snapshot: context
  });

  try {
    const result = await sendFinalReportEmail({
      communicationId: communication.id,
      recipients: finalRecipients,
      cc: finalCc,
      subject: communication.objet,
      reportPath,
      context
    });

    await supabase
      .from('communications_finales')
      .update({
        statut: 'Envoyé',
        sent_at: new Date().toISOString(),
        provider_message_id: result?.id || result?.messageId || null
      })
      .eq('id', communication.id);

    if (edt.id) {
      await supabase
        .from('suivi_des_edt')
        .update({
          statut: 'Terminé',
          date_fin: context.endDate,
          rapport_final_envoye: true,
          rapport_final_path: reportPath
        })
        .eq('id', edt.id);
    }

    return { communication, result, context, pdfBlob };
  } catch (error) {
    await supabase
      .from('communications_finales')
      .update({
        statut: 'Échec',
        erreur: error.message || String(error)
      })
      .eq('id', communication.id);

    throw error;
  }
}

export async function listFinalCommunications() {
  const { data, error } = await supabase
    .from('communications_finales')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function resendFinalCommunication(communication) {
  return sendFinalReportEmail({
    communicationId: communication.id,
    recipients: communication.destinataires || [],
    cc: communication.cc || [],
    subject: communication.objet,
    reportPath: communication.report_path,
    context: communication.report_snapshot || {}
  });
}
