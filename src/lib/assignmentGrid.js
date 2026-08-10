import { BUSINESS_CONTEXT } from './businessContext.js';

const dateKeys = new Set(['date_debut', 'date_fin', 'date_completion', 'date_mise_a_jour', 'created_at', 'updated_at']);
const dateFormatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Toronto', day: '2-digit', month: 'short', year: 'numeric' });
const campaign = [['id','ID'],['nom_campagne','Nom campagne'],['visuel_terrain','Visuel terrain'],['date_debut','Date début'],['date_fin','Date fin'],['statut_campagne','Statut'],['support_id','Support'],['emplacement','Infrastructure'],['no_edt','EDT'],['date_completion','Installation'],['date_mise_a_jour','Date mise à jour'],['created_at','Créé le'],['updated_at','Modifié le'],['raw_data','Données source']];
const operational = [['id','ID'],['emplacement','Emplacement'],['message','Communication'],['date_debut','Date début'],['date_fin','Date fin'],['statut','Statut'],['no_arret','No arrêt'],['site_ou_arret','Site ou arrêt'],['support_id','Support'],['no_edt','EDT'],['date_completion','Installation'],['related_voiture','Voiture'],['visuel_message','Visuel message'],['visuel_terrain','Visuel terrain'],['created_at','Créé le'],['updated_at','Dernière activité'],['raw_data','Données source']];
const enrichment = [['site','Site'],['infrastructure_id','Infrastructure ID'],['campaign_id','Relation campagne'],['visual_id','Relation visuel'],['business_context','Contexte métier'],['legacy_id','ID historique']];

const definition = ([id, label]) => Object.freeze({ id, label, accessor: row => row?.[id], formatter: value => formatAssignmentCell(id, value), type: dateKeys.has(id) ? 'date' : id === 'id' || id.endsWith('_id') ? 'identifier' : 'text', sortable: id !== 'raw_data', filterable: id !== 'raw_data' });
export const ASSIGNMENT_COLUMNS = Object.freeze({
  [BUSINESS_CONTEXT.MARKETING]: Object.freeze([...campaign, ...enrichment].map(definition)),
  [BUSINESS_CONTEXT.OPERATIONAL]: Object.freeze([...operational, ...enrichment].map(definition))
});
export const assignmentColumns = context => ASSIGNMENT_COLUMNS[context] || ASSIGNMENT_COLUMNS[BUSINESS_CONTEXT.MARKETING];
export function formatAssignmentCell(key, value) { if (value === null || value === undefined || value === '') return '—'; if (dateKeys.has(key)) { const date = new Date(value); if (!Number.isNaN(date.getTime())) return dateFormatter.format(date); } return typeof value === 'object' ? JSON.stringify(value) : String(value); }
export function mergeAssignmentPreferences(definitions, saved) { const byId = new Map(definitions.map(column => [column.id, column])); const order = Array.isArray(saved?.order) ? saved.order.filter((id, index, ids) => byId.has(id) && ids.indexOf(id) === index) : []; const columns = order.length ? order.map(id => byId.get(id)) : definitions; const widths = Object.fromEntries(Object.entries(saved?.widths || {}).filter(([id, width]) => byId.has(id) && Number.isFinite(Number(width)) && Number(width) > 0).map(([id, width]) => [id, Number(width)])); return { columns, widths }; }
export const isLatestAssignmentRequest = (requestId, currentRequestId, signal) => requestId === currentRequestId && !signal?.aborted;
