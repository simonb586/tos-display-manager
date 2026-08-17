export const EDT_STATUSES=Object.freeze(['brouillon','planifie','installation_en_cours','installation_terminee','attente_fin_campagne','retrait_planifie','retrait_en_cours','retrait_termine','ferme','annule']);
export const PHASE_STATUSES=Object.freeze({installation:['non_planifiee','planifiee','en_cours','terminee','fermee'],retrait:['non_planifie','planifie','en_attente','en_cours','termine','ferme']});

export function proposedRemovalDate(campaignEnd){
  if(!campaignEnd)return null;
  const date=new Date(`${campaignEnd}T12:00:00`);
  return Number.isNaN(date.getTime())?null:date.toISOString().slice(0,10);
}

export function validatePhaseDates({phaseType,plannedStart,actualStart,actualEnd,installationClosedAt,campaignEnd,exceptionReason=''}){
  const errors=[],warnings=[];
  if(actualStart&&actualEnd&&new Date(actualEnd)<new Date(actualStart))errors.push('DATE_END_BEFORE_START');
  if(phaseType==='retrait'){
    if(!installationClosedAt)errors.push('INSTALLATION_NOT_CLOSED');
    if(plannedStart&&installationClosedAt&&new Date(plannedStart)<new Date(installationClosedAt))errors.push('REMOVAL_BEFORE_INSTALLATION');
    if(plannedStart&&campaignEnd&&plannedStart<campaignEnd){
      if(!exceptionReason.trim())errors.push('CAMPAIGN_EXCEPTION_REQUIRED');
      else warnings.push('REMOVAL_BEFORE_CAMPAIGN_END');
    }
  }
  return {valid:errors.length===0,errors,warnings};
}

export function canClosePhase({progress=0,openItems=0,blockedItems=0,photoCount=0,photoException='',anomalies=''}){
  const errors=[];
  if(Number(progress)<100)errors.push('PROGRESS_INCOMPLETE');
  if(Number(openItems)>0)errors.push('OPEN_ITEMS');
  if(Number(blockedItems)>0&&!String(anomalies).trim())errors.push('ANOMALIES_UNDOCUMENTED');
  if(Number(photoCount)<1&&!String(photoException).trim())errors.push('PHOTO_REQUIRED');
  return {valid:errors.length===0,errors};
}

export function canCloseEdt({installationStatus,retraitStatus,criticalBlocks=0}){
  const errors=[];
  if(installationStatus!=='fermee')errors.push('INSTALLATION_NOT_CLOSED');
  if(retraitStatus!=='ferme')errors.push('REMOVAL_NOT_CLOSED');
  if(Number(criticalBlocks)>0)errors.push('CRITICAL_BLOCKS');
  return {valid:errors.length===0,errors};
}

export function validateReopening({role,reason}){
  const errors=[];
  if(!['Administrateur','Coordonnateur'].includes(role))errors.push('PERMISSION_DENIED');
  if(!String(reason||'').trim())errors.push('REASON_REQUIRED');
  return {valid:errors.length===0,errors};
}

export function phasesForEdt(phases,edtId){
  return ['installation','retrait'].reduce((result,phaseType)=>{
    result[phaseType]=(phases||[]).find(phase=>String(phase.edt_id)===String(edtId)&&phase.phase_type===phaseType)||null;
    return result;
  },{});
}

export function applyPhaseTransition(phases,phaseId,targetStatus){
  return phases.map(phase=>String(phase.id)===String(phaseId)?{...phase,statut:targetStatus}:phase);
}

export function isLatestLifecycleRequest(requestId,currentRequestId){
  return requestId===currentRequestId;
}
