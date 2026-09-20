import {projectCampaignHistory, normalizeEdtNumber} from './campaignHistory.js';

const text = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('fr-CA');
const same = (a,b) => a != null && b != null && String(a) === String(b);
const tenantMatch = (a,b) => same(a.client_id,b.client_id);
const timestamp = value => value ? Date.parse(value) || 0 : 0;
const supportKey = row => JSON.stringify([row.client_id,row.support_id]);
const visualName = row => row.visuel || row.visuel_terrain || row.visuel_message || row.visuel_attendu;
const cancelled = (row,kind) => Boolean(row.movement_meta?.cancellations?.[kind]);
const campaignName = value => text(value).replace(/[^a-z0-9]/g,'');
const displayValue = value => value && !/^(aucun|aucune|sans objet|n\/a|[-—])(?:\s|$)/.test(text(value)) ? value : '';

// A projection of the existing movement ledger, never a second deployment store.
// Photos and audit records do not participate in the identity of an installation.
export function projectSiteSupportDeployments({history=[],assignments=[],campaigns=[],supports=[],visuals=[]}={}) {
  // Legacy movements may omit the tenant. Resolve only an exact, unique support
  // already returned by the caller's scoped infrastructure query.
  history=history.map(row=>{
    if(row.client_id!=null)return row;
    const matches=supports.filter(s=>same(s.support_id,row.support_id)&&s.client_id!=null);
    return matches.length===1?{...row,client_id:matches[0].client_id}:row;
  });
  const latest = new Map();
  for (const row of history) for (const kind of ['installation','retrait']) {
    const date = row[`date_${kind}`];
    if (!date || cancelled(row,kind)) continue;
    const event = {id:row.id,kind,time:timestamp(date)};
    const previous = latest.get(supportKey(row));
    if (!previous || event.time > previous.time || (event.time === previous.time && Number(event.id) >= Number(previous.id))) latest.set(supportKey(row),event);
  }
  const enriched = history.map(row => {
    const state = row.movement_meta?.installation?.state || row.movement_meta?.retrait?.state || {};
    const visualId = row.visual_id || row.raw_data?.visual_id || row.raw_data?.visuel_id || state.visuel_id;
    const visual = visuals.find(v=>tenantMatch(v,row)&&same(v.id,visualId));
    return {...row,visual_id:visual?.id || visualId,campagne_id:row.campagne_id || row.raw_data?.campaign_id || row.raw_data?.campagne_id || visual?.campagne_id,
      format_visuel:state.format_visuel || visual?.format_support || row.format_visuel,
      deployment_installation_at:row.date_installation,deployment_retrait_at:row.date_retrait};
  });
  const movements = projectCampaignHistory(enriched,{campaigns,supports}).map(row=>{
    const support = supports.find(s=>tenantMatch(s,row)&&same(s.support_id,row.support_id));
    const campaign = campaigns.find(c=>tenantMatch(c,row)&&same(c.id,row.campaign_id));
    const candidates = visuals.filter(v=>tenantMatch(v,row)&&same(v.campagne_id,row.campaign_id)&&text(v.nom_visuel)===text(row.visuel));
    const visual = visuals.find(v=>tenantMatch(v,row)&&same(v.id,row.visual_id)) || (candidates.length===1?candidates[0]:null);
    const last = latest.get(supportKey(row));
    const installationCancelled = cancelled(row,'installation');
    const removed = row.date_retrait && !cancelled(row,'retrait');
    const current = !installationCancelled && !removed && last?.kind==='installation' && same(last.id,row.id);
    const state = installationCancelled?'Annulé':removed?'Retiré':current?'En exposition':'Historique';
    return {...row,source_table:'historique_des_campagnes',_assignment_table:null,
      nom_campagne:row.campagne,message:row.campagne,visuel_terrain:row.visuel,visuel_message:row.visuel,
      client:campaign?.client || String(row.client_id ?? ''),infrastructure_id:support?.id,
      emplacement:support?.emplacement_visibilite || '',visual_id:visual?.id || row.visual_id,
      format_visuel:row.format_visuel || visual?.format_support || '',
      statut:state,statut_campagne:state,etat_courant:current?'Oui':'Non',
      date_completion:row.deployment_installation_at,date_installation:row.deployment_installation_at,date_retrait:row.deployment_retrait_at,
      photo:row.photo_installation || '',no_edt:row.no_edt || ''};
  });
  const unique = new Map();
  for (const row of movements) {
    const key = JSON.stringify([row.client_id,row.support_id,row.campaign_id || text(row.campagne),row.visual_id || text(row.visuel),
      normalizeEdtNumber(row.no_edt),row.date_installation,row.date_retrait,row.movement_meta?.cancellations || null]);
    const existing=unique.get(key);
    if (existing) {
      existing.photo ||= row.photo;
      if(row.etat_courant==='Oui'){existing.etat_courant='Oui';existing.statut=existing.statut_campagne=row.statut;}
    } else unique.set(key,{...row,logical_key:`movement:${key}`});
  }
  const deployments = [...unique.values()];
  // Infrastructure is the canonical current display, including legacy installations
  // with no assignment or ledger row. Resolve a campaign relation, then use its context.
  for (const support of supports) {
    const visual = visuals.find(v=>tenantMatch(v,support)&&same(v.id,support.visuel_id));
    const campaignId = visual?.campagne_id;
    const campaignNames = [support.campagne_selon_visuel,support.campagne_actuelle].filter(Boolean).map(campaignName);
    const candidates = campaigns.filter(c=>tenantMatch(c,support)&&(campaignId?same(c.id,campaignId):campaignNames.includes(campaignName(c.nom_campagne))));
    const campaign = candidates.length===1?candidates[0]:null;
    const name = visual?.nom_visuel || displayValue(support.visuel_en_expo) || displayValue(support.visuel_campagne);
    const hasDisplay = name || displayValue(support.campagne_actuelle);
    if(!hasDisplay) {
      for(const row of deployments.filter(r=>tenantMatch(r,support)&&same(r.support_id,support.support_id))) {
        row.etat_courant='Non'; if(row.statut==='En exposition')row.statut=row.statut_campagne='Historique';
      }
      continue;
    }
    const matches=deployments.filter(row=>tenantMatch(row,support)&&same(row.support_id,support.support_id)
      && (visual?same(row.visual_id,visual.id):text(row.visuel)===text(name))
      && (!campaign || same(row.campaign_id,campaign.id)) && !cancelled(row,'installation')
      && (!row.date_retrait || cancelled(row,'retrait'))
      && (!support.date_visuel_actuel || timestamp(row.date_installation)===timestamp(support.date_visuel_actuel)));
    const match=matches.sort((a,b)=>timestamp(b.date_installation)-timestamp(a.date_installation))[0];
    for(const row of deployments.filter(r=>tenantMatch(r,support)&&same(r.support_id,support.support_id))) {
      row.etat_courant='Non'; if(row.statut==='En exposition')row.statut=row.statut_campagne='Historique';
    }
    if(match) {
      match.etat_courant='Oui';match.statut=match.statut_campagne='En exposition';
      match.photo ||= support.photo_principale_url || support.photo_miniature_url || '';
      continue;
    }
    deployments.push({id:`infrastructure:${support.id}`,logical_key:`infrastructure:${support.client_id}:${support.id}`,
      source_table:'infrastructures',_assignment_table:null,client_id:support.client_id,client:campaign?.client || String(support.client_id ?? ''),
      support_id:support.support_id,infrastructure_id:support.id,site:support.site,emplacement:support.emplacement_visibilite,
      campaign_id:campaign?.id,nom_campagne:campaign?.nom_campagne || support.campagne_selon_visuel || support.campagne_actuelle,
      message:campaign?.nom_campagne || support.campagne_selon_visuel || support.campagne_actuelle,
      business_context:campaign?.business_context || null,context_status:campaign?'Confirmé':'À valider',
      visual_id:visual?.id,visuel_terrain:name,visuel_message:name,format_visuel:support.format_visuel || visual?.format_support,
      format_support:support.format_affichage,no_edt:support.edt_associe || '',
      date_installation:support.date_visuel_actuel || null,date_completion:support.date_visuel_actuel || null,date_retrait:null,
      statut:'En exposition',statut_campagne:'En exposition',etat_courant:'Oui',
      photo:support.photo_principale_url || support.photo_miniature_url || '',raw_data:support});
  }
  for (const assignment of assignments) {
    const matching = deployments.filter(row=>tenantMatch(row,assignment)&&same(row.support_id,assignment.support_id)
      && (same(row.campaign_id,assignment.campaign_id) || text(row.campagne)===text(assignment.nom_campagne || assignment.message))
      && text(visualName(row))===text(visualName(assignment))
      && (!assignment.no_edt || normalizeEdtNumber(row.no_edt)===normalizeEdtNumber(assignment.no_edt))
      && (!assignment.date_completion || timestamp(row.date_installation)===timestamp(assignment.date_completion)));
    if(matching.length) {
      // Preserve the existing assignment edit capability without editing the ledger.
      const row=matching.find(r=>r.etat_courant==='Oui') || matching[matching.length-1];
      row.assignment = assignment;
      continue;
    }
    if(!assignment.date_completion) continue; // A planned assignment is not an installation.
    deployments.push({...assignment,date_installation:assignment.date_completion || null,date_retrait:assignment.date_retrait || null,
      etat_courant:'À confirmer',photo:assignment.photo || assignment.photo_url || '',
      logical_key:`assignment:${JSON.stringify([assignment.client_id,assignment.logical_key || assignment.id,assignment.source_table])}`});
  }
  return deployments;
}
