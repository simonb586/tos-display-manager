import {resolveFrameIdentifier} from '../lib/frameIdentifierOcr.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';

let workerPromise=null,queue=Promise.resolve();
async function worker(){
  if(!workerPromise)workerPromise=import('tesseract.js').then(async({createWorker,PSM})=>{
    const instance=await createWorker('eng',1,{workerPath});
    await instance.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT,tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz- '});
    return instance;
  }).catch(error=>{workerPromise=null;throw error});
  return workerPromise;
}
function crop(bitmap,region){
  const right=region==='upper-right',x=right?Math.floor(bitmap.width*.55):0;
  const width=bitmap.width-x,height=right?Math.ceil(bitmap.height*.4):bitmap.height;
  const scale=Math.min(3,(right?1800:2400)/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,x,0,width,height,0,0,canvas.width,canvas.height);
  return canvas;
}
async function recognize(file,supports){
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}),observations=[];
  try{
    const instance=await worker();
    for(const region of ['upper-right','full-image']){
      const canvas=crop(bitmap,region);
      const {data}=await instance.recognize(canvas,{}, {text:true,blocks:true});
      observations.push({region,text:data.text,confidence:data.confidence});
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
        observations.push({region,text:line.text,confidence:line.confidence});
        for(const word of line.words||[])observations.push({region,text:word.text,confidence:word.confidence});
      }
      canvas.width=canvas.height=1;
      const resolved=resolveFrameIdentifier(observations,supports);
      if(resolved.supportId)return {...resolved,observations};
    }
    return {...resolveFrameIdentifier(observations,supports),observations};
  }finally{bitmap.close()}
}
// One worker prevents large imports from allocating an OCR engine for every image.
export function readFrameIdentifier(file,supports){
  const result=queue.then(async()=>{
    let timer;
    try{return await Promise.race([recognize(file,supports),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR_TIMEOUT')),45000)})]);}
    catch(error){const pending=workerPromise;workerPromise=null;pending?.then(w=>w.terminate(),()=>{});throw error;}
    finally{clearTimeout(timer)}
  });queue=result.catch(()=>{});return result;
}
export async function releaseFrameIdentifierOcr(){await queue;const pending=workerPromise;workerPromise=null;if(pending)await pending.then(w=>w.terminate(),()=>{});}
