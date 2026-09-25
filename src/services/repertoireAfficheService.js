import {supabase,supabaseConfigured} from '../lib/supabaseClient';

// Temporary opt-in diagnostics: sessionStorage.setItem('tos-terrain-material-debug','1').
// No photo, session, or complete catalog is logged.
export async function resolveRepertoireAffiche({repertoireAfficheId,visuel,format,campagne,mediumAffichage,supportId,phaseId,interventionReference}) {
  if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');
  const {data,error}=await supabase.rpc('resolve_repertoire_affiche',{
    p_visual_id:Number(visuel?.id??visuel),p_support_id:String(supportId),
    p_edt_phase_id:phaseId?Number(phaseId):null,p_repertoire_affiche_id:repertoireAfficheId?Number(repertoireAfficheId):null,
    p_intervention_reference:interventionReference||null
  });
  if(error)throw error;
  try {
    if(sessionStorage.getItem('tos-terrain-material-debug')==='1')console.debug('[Terrain Répertoire]',{
      visuel:data?.visuel??visuel?.nom_visuel,visualId:visuel?.id??visuel,
      format:data?.format??format,campagne:data?.campagne??campagne,
      mediumAffichage:data?.medium_affichage??mediumAffichage,
      repertoireAfficheId:data?.record?.id??null,matches:data?.match_count??0,status:data?.status
    });
  }catch{/* Diagnostics must not interfere with an intervention. */}
  return data;
}

export function requireRepertoireAffiche(resolution) {
  const id=resolution?.status==='resolved'?resolution.record?.id:null;
  if(id==null)throw Object.assign(new Error(resolution?.message||'Aucun article correspondant trouvé dans le Répertoire des affiches pour ce visuel et ce format. Votre intervention et votre photo sont conservées.'),{code:'material_'+(resolution?.status||'not_found')});
  return id;
}
