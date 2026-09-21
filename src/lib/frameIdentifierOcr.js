// Normalize separators, never substitute letters for digits or discard leading zeroes.
export const normalizeFrameIdentifier = value => String(value ?? '').normalize('NFKC').toUpperCase()
  .replace(/[‐‑–—−]/g,'-').replace(/\s*-\s*/g,'-').trim();

const supportPatterns=new WeakMap();
function patterns(supports){let rows=supportPatterns.get(supports);if(rows)return rows;rows=supports.filter(s=>normalizeFrameIdentifier(s.support_id)).map(s=>{const escaped=normalizeFrameIdentifier(s.support_id).split(/[-\s]+/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[-\\s]+');return {support:s,pattern:new RegExp(`(^|[^A-Z0-9-])${escaped}([^A-Z0-9-]|$)`)};});supportPatterns.set(supports,rows);return rows;}

export function frameIdentifierCandidates(observations,supports) {
  const candidates=new Map();
  for(const observation of observations) {
    const text=normalizeFrameIdentifier(observation.text);
    for(const {support,pattern} of patterns(supports)) {
      if(!pattern.test(text))continue;
      const previous=candidates.get(support.support_id),confidence=Number(observation.confidence)||0;
      const regions={...(previous?.regions||{})};regions[observation.region]=Math.max(regions[observation.region]||0,confidence);
      candidates.set(support.support_id,{support_id:support.support_id,confidence:Math.max(previous?.confidence||0,confidence),region:!previous||confidence>previous.confidence?observation.region:previous.region,regions});
    }
  }
  return [...candidates.values()].sort((a,b)=>b.confidence-a.confidence);
}

export function resolveFrameIdentifier(observations,supports) {
  const candidates=frameIdentifierCandidates(observations,supports);
  const reliable=candidates.filter(candidate=>candidate.confidence>=95 || candidate.confidence>=85&&Object.values(candidate.regions).filter(score=>score>=70).length>=2 || candidate.confidence>=75&&Object.values(candidate.regions).filter(score=>score>=55).length>=3);
  return {candidates,supportId:reliable.length===1&&candidates.filter(c=>c.confidence>=70).length===1?reliable[0].support_id:null};
}
