import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronRight, Clock3, FileText, MapPin } from 'lucide-react';

const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const rowsFor = (store, token) => {
  const key = Object.keys(store || {}).find(name => fold(name).includes(fold(token)));
  return key ? (store[key]?.rows || []) : [];
};
const text = (row, ...fields) => fields.map(field => row?.[field]).find(value => value !== null && value !== undefined && value !== '') ?? '';
const status = row => fold(text(row, 'statut', 'status', 'statut_campagne', 'etat'));
const dateValue = (row, ...fields) => { const raw = text(row, ...fields); if (!raw) return null; const value = new Date(raw); return Number.isNaN(value.getTime()) ? null : value; };
const isOpen = row => !['ferme', 'fermee', 'termine', 'terminee', 'annule', 'annulee', 'resolu', 'resolue'].includes(status(row));
const sameDay = (left, right) => left && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
const formatDate = value => value ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' }).format(value) : 'Non disponible';

function Metric({ label, value, hint, onClick }) {
  return <button className="command-metric" type="button" onClick={onClick} disabled={!onClick}><span>{label}</span><strong>{value === null ? 'Non disponible' : Number(value).toLocaleString('fr-CA')}</strong><small>{hint}</small></button>;
}
function Empty({ children = 'Aucune donnée réelle disponible pour cette vue.' }) { return <div className="command-empty">{children}</div>; }
function List({ rows, title, render }) { return <article className="command-panel"><h2>{title}</h2>{rows.length ? <ol className="command-list">{rows.slice(0, 8).map((row, index) => <li key={row.id || index}>{render(row)}<ChevronRight aria-hidden="true"/></li>)}</ol> : <Empty/>}</article>; }

export default function OperationalCommandCenter({ dataStore, initialView = 'today', onNavigate }) {
  const [view, setView] = useState(initialView);
  const model = useMemo(() => {
    const now = new Date();
    const infrastructure = rowsFor(dataStore, 'infrastructures');
    const campaigns = rowsFor(dataStore, 'campagnes et visuels');
    const edt = rowsFor(dataStore, 'suivi des edt');
    const photos = rowsFor(dataStore, 'photos');
    const issues = rowsFor(dataStore, 'enjeux des cadres');
    const clients = rowsFor(dataStore, 'clients');
    const reports = rowsFor(dataStore, 'rapports');
    const journal = rowsFor(dataStore, 'journal');
    const work = rowsFor(dataStore, 'bons de travail');
    const installationsToday = edt.filter(row => sameDay(dateValue(row, 'installation_date_prevue_debut', 'date_installation_prevue', 'date_prevue'), now));
    const removalsToday = edt.filter(row => sameDay(dateValue(row, 'retrait_date_prevue_debut', 'date_retrait_prevue'), now));
    const endingCampaigns = campaigns.filter(row => { const end = dateValue(row, 'date_fin', 'date_fin_campagne'); return end && end >= now && end.getTime() - now.getTime() <= 7 * 86400000; });
    const overdue = edt.filter(row => { const due = dateValue(row, 'date_fin_prevue', 'date_prevue_fin', 'date_echeance'); return due && due < now && isOpen(row); });
    const missingPhotos = infrastructure.filter(row => !text(row, 'photo_principale_url', 'photo_miniature_url', 'visuel_actuel_cadre'));
    const pendingReports = reports.filter(isOpen);
    const urgentIssues = issues.filter(row => isOpen(row) && ['urgent', 'critique', 'elevee', 'haute'].some(level => fold(text(row, 'priorite', 'gravite')).includes(level)));
    return { now, infrastructure, campaigns, edt, photos, issues, clients, reports, journal, work, installationsToday, removalsToday, endingCampaigns, overdue, missingPhotos, pendingReports, urgentIssues };
  }, [dataStore]);
  const views = [['today', "Aujourd’hui"], ['campaigns', 'Campagnes'], ['terrain', 'Terrain'], ['clients', 'Clients'], ['installers', 'Installateurs'], ['reports', 'Rapports'], ['alerts', 'Alertes'], ['activity', 'Activité']];
  const open = target => onNavigate?.(target);
  const summaries = { today: 'Priorités et échéances calculées pour la journée courante.', campaigns: 'Progression et échéances des campagnes disponibles.', terrain: 'Interventions et preuves provenant des données Terrain.', clients: 'Vue consolidée respectant les données accessibles au rôle courant.', installers: 'Charge opérationnelle sans classement individuel.', reports: 'Suivi des rapports et de leur historique.', alerts: 'Exceptions calculées à partir des échéances et statuts réels.', activity: 'Derniers événements consignés dans les journaux.' };
  return <section className="command-center">
    <header className="command-hero"><div><span className="eyebrow">Centre de commandement</span><h1>{views.find(item => item[0] === view)?.[1]}</h1><p>{summaries[view]}</p></div><div className="command-date"><CalendarDays/> {formatDate(model.now)}</div></header>
    <nav className="command-tabs" aria-label="Tableaux de bord spécialisés">{views.map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
    {view === 'today' && <><div className="command-metrics"><Metric label="Installations aujourd’hui" value={model.installationsToday.length} hint="EDT planifiés" onClick={() => open('Centre EDT et BT')}/><Metric label="Retraits aujourd’hui" value={model.removalsToday.length} hint="EDT planifiés" onClick={() => open('Centre EDT et BT')}/><Metric label="EDT en retard" value={model.overdue.length} hint="Échéance dépassée" onClick={() => open('Suivi des EDT')}/><Metric label="Rapports à envoyer" value={model.reports.length ? model.pendingReports.length : null} hint="Selon les rapports chargés" onClick={() => open('Rapports finaux')}/></div><div className="command-grid"><List title="Campagnes se terminant dans 7 jours" rows={model.endingCampaigns} render={row => <div><strong>{text(row, 'nom_campagne', 'nom', 'campagne') || 'Campagne'}</strong><small>{formatDate(dateValue(row, 'date_fin', 'date_fin_campagne'))}</small></div>}/><List title="Enjeux urgents" rows={model.urgentIssues} render={row => <div><strong>{text(row, 'titre', 'type_enjeu', 'enjeu') || 'Enjeu'}</strong><small>{text(row, 'support_id', 'statut') || 'Détail non disponible'}</small></div>}/></div></>}
    {view === 'campaigns' && <><div className="command-metrics"><Metric label="Campagnes" value={model.campaigns.length} hint="Total accessible" onClick={() => open('Campagnes maîtres')}/><Metric label="Fin prochaine" value={model.endingCampaigns.length} hint="Dans les 7 jours"/><Metric label="EDT liés" value={model.edt.filter(row => text(row, 'campagne_id', 'campagne', 'nom_campagne')).length} hint="Lien détecté"/><Metric label="Photos" value={model.photos.length} hint="Preuves accessibles" onClick={() => open('Photos et inventaire')}/></div><List title="Campagnes récentes" rows={model.campaigns} render={row => <div><strong>{text(row, 'nom_campagne', 'nom', 'campagne') || 'Campagne'}</strong><small>{status(row) || 'Statut non disponible'} · fin {formatDate(dateValue(row, 'date_fin', 'date_fin_campagne'))}</small></div>}/></>}
    {view === 'terrain' && <><div className="command-metrics"><Metric label="Interventions" value={model.work.length} hint="Bons de travail accessibles" onClick={() => open('Bons de travail')}/><Metric label="Inspections" value={model.photos.filter(row => fold(text(row, 'type_photo', 'action')).includes('inspection')).length} hint="Photos typées inspection"/><Metric label="Photos" value={model.photos.length} hint="Bibliothèque accessible" onClick={() => open('Photos et inventaire')}/><Metric label="Synchronisations" value={null} hint="Aucun état fiable disponible"/></div><Empty>Les états hors ligne et de synchronisation ne sont affichés que lorsqu’une source réelle les fournit.</Empty></>}
    {view === 'clients' && <><div className="command-metrics"><Metric label="Clients" value={model.clients.length} hint="Total accessible" onClick={() => open('Clients')}/><Metric label="Campagnes" value={model.campaigns.length} hint="Selon les permissions"/><Metric label="Supports" value={model.infrastructure.length} hint="Selon les permissions"/><Metric label="Rapports" value={model.reports.length ? model.reports.length : null} hint="Selon les données chargées"/></div><List title="Clients accessibles" rows={model.clients} render={row => <div><strong>{text(row, 'nom_client', 'nom', 'raison_sociale') || 'Client'}</strong><small>{text(row, 'statut', 'courriel') || 'Détail non disponible'}</small></div>}/></>}
    {view === 'installers' && <><div className="command-metrics"><Metric label="Installations" value={model.edt.filter(row => status(row).includes('installation')).length} hint="Phases accessibles"/><Metric label="Retraits" value={model.edt.filter(row => status(row).includes('retrait')).length} hint="Phases accessibles"/><Metric label="Anomalies" value={model.issues.filter(isOpen).length} hint="Enjeux ouverts"/><Metric label="Qualité" value={null} hint="Aucun indicateur fiable disponible"/></div><Empty>Aucun classement individuel n’est produit. Ouvrez le centre EDT pour la charge détaillée.</Empty></>}
    {view === 'reports' && <><div className="command-metrics"><Metric label="Rapports" value={model.reports.length ? model.reports.length : null} hint="Versions accessibles" onClick={() => open('Rapports finaux')}/><Metric label="En attente" value={model.reports.length ? model.pendingReports.length : null} hint="Statut non final"/><Metric label="Envoyés" value={model.reports.length ? model.reports.filter(row => Boolean(text(row, 'sent_at', 'date_envoi', 'envoye_le'))).length : null} hint="Envoi consigné"/><Metric label="Exports" value={null} hint="Action disponible dans Rapports"/></div><List title="Historique des rapports" rows={model.reports} render={row => <div><strong>{text(row, 'titre', 'type_rapport', 'phase_type') || 'Rapport'}</strong><small>{text(row, 'version', 'destinataires', 'statut') || 'Détail non disponible'}</small></div>}/></>}
    {view === 'alerts' && <div className="command-alerts">{[[model.overdue, 'EDT en retard', Clock3], [model.endingCampaigns, 'Campagnes se terminant', CalendarDays], [model.missingPhotos, 'Photos manquantes', MapPin], [model.urgentIssues, 'Enjeux urgents', AlertTriangle], [model.pendingReports, 'Rapports non envoyés', FileText]].map(([rows, label, Icon]) => <button type="button" key={label}><Icon/><span>{label}</span><strong>{rows.length.toLocaleString('fr-CA')}</strong></button>)}</div>}
    {view === 'activity' && <List title="Activité récente" rows={[...model.journal].sort((a, b) => String(text(b, 'created_at', 'date')).localeCompare(String(text(a, 'created_at', 'date'))))} render={row => <div><strong>{text(row, 'action', 'type_evenement', 'evenement') || 'Événement'}</strong><small>{text(row, 'description', 'details', 'created_at', 'date') || 'Détail non disponible'}</small></div>}/>} 
  </section>;
}
