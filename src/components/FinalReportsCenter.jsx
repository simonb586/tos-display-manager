import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Mail,
  RefreshCw,
  RotateCcw,
  Send
} from 'lucide-react';
import {
  closeEdtAndSendFinalReport,
  generateFinalReportExcel,
  generateFinalReportPdf,
  listFinalCommunications,
  normalizeFinalReportContext,
  resendFinalCommunication
} from '../services/finalReportService';

const first = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return fallback;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function FinalReportsCenter({ dataStore, role }) {
  const edts = dataStore?.['Suivi des EDT']?.rows || [];
  const campaigns = dataStore?.['Campagnes et visuels']?.rows || [];
  const clients = dataStore?.Clients?.rows || [];
  const infrastructures = dataStore?.Infrastructures?.rows || [];
  const issues = dataStore?.['Enjeux des cadres et supports']?.rows || [];

  const [selectedEdtId, setSelectedEdtId] = useState('');
  const [recipients, setRecipients] = useState('');
  const [cc, setCc] = useState('');
  const [communications, setCommunications] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selectedEdt = useMemo(
    () => edts.find(item =>
      String(item.id || item.edt_id || item.no_edt || item.numero_edt) === selectedEdtId
    ) || null,
    [edts, selectedEdtId]
  );

  const campaign = useMemo(() => {
    if (!selectedEdt) return null;
    const campaignId = first(selectedEdt, ['campagne_id', 'campaign_id']);
    const campaignName = first(selectedEdt, ['campagne', 'nom_campagne']);

    return campaigns.find(item =>
      (campaignId && String(item.id) === String(campaignId)) ||
      (campaignName && String(first(item, ['nom', 'nom_campagne', 'campagne'])) === String(campaignName))
    ) || {};
  }, [selectedEdt, campaigns]);

  const client = useMemo(() => {
    const clientId = first(selectedEdt, ['client_id']) || first(campaign, ['client_id']);
    const clientName = first(selectedEdt, ['client']) || first(campaign, ['client']);

    return clients.find(item =>
      (clientId && String(item.id) === String(clientId)) ||
      (clientName && String(first(item, ['nom', 'client', 'raison_sociale'])) === String(clientName))
    ) || {};
  }, [selectedEdt, campaign, clients]);

  const edtNumber = first(selectedEdt, ['no_edt', 'numero_edt', 'edt', 'code']);

  const supports = useMemo(
    () => infrastructures.filter(item =>
      String(first(item, ['edt_associe', 'EDT Associé', 'no_edt'])) === String(edtNumber)
    ),
    [infrastructures, edtNumber]
  );

  const edtIssues = useMemo(
    () => issues.filter(item =>
      String(first(item, ['edt_associe', 'no_edt'])) === String(edtNumber)
    ),
    [issues, edtNumber]
  );

  const context = useMemo(
    () => selectedEdt
      ? normalizeFinalReportContext({
          edt: selectedEdt,
          campaign,
          client,
          issues: edtIssues,
          supports
        })
      : null,
    [selectedEdt, campaign, client, edtIssues, supports]
  );

  useEffect(() => {
    if (!context) return;
    setRecipients(context.recipients.join('; '));
    setCc(context.cc.join('; '));
  }, [context]);

  async function reloadCommunications() {
    try {
      setCommunications(await listFinalCommunications());
    } catch (error) {
      setMessage(error.message || 'Impossible de charger le journal.');
    }
  }

  useEffect(() => {
    reloadCommunications();
  }, []);

  async function previewPdf() {
    if (!context) return;
    const blob = await generateFinalReportPdf(context);
    downloadBlob(blob, `rapport-final-${context.edtNumber}.pdf`);
  }

  async function downloadExcel() {
    if (!context) return;
    const array = await generateFinalReportExcel(context, supports);
    downloadBlob(
      new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `rapport-final-${context.edtNumber}.xlsx`
    );
  }

  async function closeAndSend() {
    if (!selectedEdt) return;
    setBusy(true);
    setMessage('');

    try {
      await closeEdtAndSendFinalReport({
        edt: selectedEdt,
        campaign,
        client,
        issues: edtIssues,
        supports,
        recipients: recipients.split(/[;,]/).map(value => value.trim()).filter(Boolean),
        cc: cc.split(/[;,]/).map(value => value.trim()).filter(Boolean)
      });

      setMessage('EDT clôturé et rapport PDF envoyé avec succès.');
      await reloadCommunications();
    } catch (error) {
      setMessage(`Échec : ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  async function resend(communication) {
    setBusy(true);
    try {
      await resendFinalCommunication(communication);
      setMessage('Rapport final renvoyé.');
      await reloadCommunications();
    } catch (error) {
      setMessage(`Échec du renvoi : ${error.message || error}`);
    } finally {
      setBusy(false);
    }
  }

  const canSend = ['Administrateur', 'Coordonnateur'].includes(role);

  return (
    <div className="final-report-page">
      <header className="final-report-hero">
        <div>
          <h1><Mail/> Rapports finaux d’installation</h1>
          <p>Clôture un EDT, génère le PDF officiel et l’envoie depuis noreply@groupetos.com.</p>
        </div>
        <button onClick={reloadCommunications}><RefreshCw size={17}/> Actualiser</button>
      </header>

      {message && <div className="v07-message">{message}</div>}

      <div className="final-report-layout">
        <section className="v07-card final-report-form">
          <h2>Préparer le rapport final</h2>

          <label>EDT
            <select value={selectedEdtId} onChange={event => setSelectedEdtId(event.target.value)}>
              <option value="">Sélectionner un EDT</option>
              {edts.map(item => {
                const id = String(item.id || item.edt_id || item.no_edt || item.numero_edt);
                const label = first(item, ['no_edt', 'numero_edt', 'edt', 'code'], id);
                const name = first(item, ['campagne', 'nom_campagne'], '');
                return <option key={id} value={id}>{label}{name ? ` — ${name}` : ''}</option>;
              })}
            </select>
          </label>

          {context && (
            <>
              <div className="final-report-summary">
                <div><span>Client</span><strong>{context.clientName}</strong></div>
                <div><span>Campagne</span><strong>{context.campaignName}</strong></div>
                <div><span>Supports prévus</span><strong>{context.planned}</strong></div>
                <div><span>Installés</span><strong>{context.installed}</strong></div>
                <div><span>Non installés</span><strong>{context.notInstalled}</strong></div>
                <div><span>Photos dans le PDF</span><strong>0</strong></div>
              </div>

              <label>Destinataires
                <textarea
                  rows="3"
                  value={recipients}
                  onChange={event => setRecipients(event.target.value)}
                  placeholder="client@exemple.com; autre@exemple.com"
                />
              </label>

              <label>Copies conformes
                <textarea
                  rows="2"
                  value={cc}
                  onChange={event => setCc(event.target.value)}
                  placeholder="coordonnateur@exemple.com"
                />
              </label>

              <div className="final-report-actions">
                <button className="v07-secondary" onClick={previewPdf}>
                  <FileText size={17}/> Télécharger le PDF
                </button>
                <button className="v07-secondary" onClick={downloadExcel}>
                  <Download size={17}/> Export Excel
                </button>
                <button
                  className="v07-primary"
                  disabled={!canSend || busy}
                  onClick={closeAndSend}
                >
                  <Send size={17}/> {busy ? 'Traitement...' : 'Clôturer et envoyer'}
                </button>
              </div>

              {!canSend && (
                <small>Seuls les administrateurs et coordonnateurs peuvent envoyer le rapport final.</small>
              )}
            </>
          )}
        </section>

        <section className="v07-card">
          <h2>Journal des communications</h2>
          <div className="final-communications">
            {communications.map(item => (
              <article key={item.id}>
                <div className="final-communication-icon">
                  {item.statut === 'Envoyé' ? <CheckCircle2/> : <Mail/>}
                </div>
                <div>
                  <strong>{item.objet}</strong>
                  <span>{(item.destinataires || []).join(', ')}</span>
                  <small>{item.statut} — {new Date(item.created_at).toLocaleString('fr-CA')}</small>
                </div>
                <button disabled={busy || !canSend} onClick={() => resend(item)}>
                  <RotateCcw size={16}/> Renvoyer
                </button>
              </article>
            ))}

            {!communications.length && <p>Aucun rapport final envoyé pour le moment.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
