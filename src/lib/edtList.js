import {compareNatural} from './gridSorting.js';
import {normalize} from './utils.js';

export function edtStatus(edt) {
  if (edt.archived_at || ['archive','archivee'].includes(normalize(edt.statut)) || ['archive','archivee'].includes(normalize(edt.lifecycle_status))) return 'Archivé';
  if (['termine','terminee','ferme','fermee'].includes(normalize(edt.statut)) || ['ferme','retrait_termine'].includes(edt.lifecycle_status)) return 'Terminé';
  return edt.statut || 'Planifié';
}

export function filterEdts(rows, query='', status='Tous', direction='asc') {
  const needle=normalize(query), identifier=needle.replace(/[^a-z0-9]/g,'');
  return rows.filter(edt=>{
    const state=edtStatus(edt);
    const matchesStatus=status==='Tous' || (status==='Planifiés' ? ['planifie','en preparation','brouillon'].includes(normalize(state)) : status==='En cours' ? ['en cours','en attente'].includes(normalize(state)) : state===(status==='Terminés'?'Terminé':'Archivé'));
    const text=normalize([edt.no_edt,edt.nom,edt.campagne,edt.client,state,edt.statut,edt.visual_names,edt.raw_data?.visuel].join(' '));
    return matchesStatus && (!needle || text.includes(needle) || (identifier && normalize(edt.no_edt).replace(/[^a-z0-9]/g,'').includes(identifier)));
  }).sort((a,b)=>(direction==='desc'?-1:1)*(compareNatural(a.no_edt,b.no_edt) || String(a.no_edt||'').length-String(b.no_edt||'').length || compareNatural(a.id,b.id)));
}
