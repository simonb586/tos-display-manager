const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const skeleton=value=>normalized(value).replace(/\s/g,'').replace(/[OQ]/g,'0').replace(/[IL]/g,'1');
function near(a,b){if(!a||!b||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)<=1;}
function meters(gps,support){const lat=Number(support.latitude),lon=Number(support.longitude);if(!gps||support.latitude==null||support.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(Number(gps.latitude))||!Number.isFinite(Number(gps.longitude)))return Infinity;const rad=n=>n*Math.PI/180;const a=Math.sin(rad(lat-Number(gps.latitude))/2)**2+Math.cos(rad(lat))*Math.cos(rad(Number(gps.latitude)))*Math.sin(rad(lon-Number(gps.longitude))/2)**2;return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
export function rankImportSupports(item,supports){
 const ocr=normalized(item.ocrText),filename=normalized(item.originalFilename),words=ocr.split(' '),windowSet=new Set();
 for(let i=0;i<words.length;i++)for(let n=1;n<=4;n++)windowSet.add(skeleton(words.slice(i,i+n).join(' ')));
 const windowsByLength=new Map();for(const w of windowSet){if(w.length<5)continue;const list=windowsByLength.get(w.length)||[];list.push(w);windowsByLength.set(w.length,list);}
 return supports.map(s=>{
  const evidence=[],key=normalized(s.support_id),shape=skeleton(s.support_id);let score=0,automatic=false;const exactOcr=(' '+ocr+' ').includes(' '+key+' ');
  if((' '+filename+' ').includes(' '+key+' ')){score=99;automatic=true;evidence.push('Numéro exact dans le nom de fichier');}
  if(exactOcr){score=Math.max(score,Math.min(98,Math.max(50,Number(item.ocrConfidence)||0)));automatic ||=Number(item.ocrConfidence)>=95;evidence.push('Numéro exact lu sur la photo');}
  if(item.ocrVerifiedSupport===s.support_id&&exactOcr){score=Math.max(score,95);automatic=true;evidence.push('Numéro exact confirmé par plusieurs lectures OCR');}
  if(item.supportId===s.support_id){score=Math.max(score,85);evidence.push('Proposition du lot à confirmer');}
  if(!score&&[shape.length-1,shape.length,shape.length+1].some(length=>(windowsByLength.get(length)||[]).some(w=>near(w,shape)))){score=65;evidence.push('Numéro OCR approchant');}
  const distance=meters(item.gps,s);if(distance<=100){score=Math.min(99,score+ (score?5:55));evidence.push(`GPS à ${Math.round(distance)} m`);}
  return {support:s,support_id:s.support_id,score,automatic,evidence,distance:Number.isFinite(distance)?Math.round(distance):null};
 }).filter(c=>c.score).sort((a,b)=>b.score-a.score||a.support_id.localeCompare(b.support_id));
}
