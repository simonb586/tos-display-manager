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
  const tile=region.startsWith('identifier-')?Number(region.split('-')[1]):null;
  const right=region!=='full-image',x=right?Math.floor(bitmap.width*(tile!==null?.5:.55)):0,y=tile!==null?Math.floor(bitmap.height*tile*.08):0;
  const width=bitmap.width-x,height=tile!==null?Math.ceil(bitmap.height*.10):right?Math.ceil(bitmap.height*.5):bitmap.height;
  const scale=Math.min(3,(right?1800:2400)/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,x,y,width,height,0,0,canvas.width,canvas.height);
  return canvas;
}
async function recognize(file,supports){
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}),observations=[];
  try{
    const instance=await worker();
    for(const region of [...Array.from({length:7},(_,i)=>`identifier-${i}`),'upper-right','full-image']){
      const canvas=crop(bitmap,region);
      const {data}=await instance.recognize(canvas,{}, {text:true,blocks:true});
      observations.push({region,text:data.text,confidence:data.confidence});
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
        observations.push({region,text:line.text,confidence:line.confidence});
        for(const word of line.words||[])observations.push({region,text:word.text,confidence:word.confidence});
      }
      if(region.startsWith('identifier-')){
        const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])).filter(line=>line.bbox&&/[A-Z]{2,}[- ]|[- ]\d{2}\b/.test(line.text)).slice(0,3);
        for(const line of lines){
          const box=line.bbox,h=box.y1-box.y0,pad=Math.max(12,h),left=Math.max(0,box.x0-4*h),top=Math.max(0,box.y0-pad),width=Math.min(canvas.width-left,box.x1-left+2*h),height=Math.min(canvas.height-top,h+2*pad);
          const focused=document.createElement('canvas');focused.width=width;focused.height=height;focused.getContext('2d').drawImage(canvas,left,top,width,height,0,0,width,height);
          await instance.setParameters({tessedit_pageseg_mode:7});
          try{const refined=await instance.recognize(focused);observations.push({region:region+'-line',text:refined.data.text,confidence:refined.data.confidence});}
          finally{await instance.setParameters({tessedit_pageseg_mode:11});focused.width=focused.height=1;}
        }
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
