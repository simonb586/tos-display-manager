// Normalize separators, never substitute letters for digits or discard leading zeroes.
export const normalizeFrameIdentifier = value => String(value ?? '').normalize('NFKC').toUpperCase()
  .replace(/[‐‑–—−]/g,'-').replace(/\s*-\s*/g,'-').trim();

export function frameIdentifierCandidates(observations,supports) {
  const candidates=new Map();
  for(const observation of observations) {
    const text=normalizeFrameIdentifier(observation.text);
    for(const support of supports) {
      const id=normalizeFrameIdentifier(support.support_id);
      if(!id)continue;
      const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      if(!new RegExp(`(^|[^A-Z0-9-])${escaped}([^A-Z0-9-]|$)`).test(text))continue;
      const previous=candidates.get(support.support_id),confidence=Number(observation.confidence)||0;
      if(!previous||confidence>previous.confidence)candidates.set(support.support_id,{support_id:support.support_id,confidence,region:observation.region});
    }
  }
  return [...candidates.values()].sort((a,b)=>b.confidence-a.confidence);
}

export function resolveFrameIdentifier(observations,supports) {
  const candidates=frameIdentifierCandidates(observations,supports);
  const reliable=candidates.filter(candidate=>candidate.confidence>=95);
  return {candidates,supportId:reliable.length===1&&candidates.filter(c=>c.confidence>=70).length===1?reliable[0].support_id:null};
}
