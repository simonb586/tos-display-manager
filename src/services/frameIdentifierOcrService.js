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
  const corner=region.startsWith('corner-')?Number(region.split('-')[1]):null;
  const glass=region.startsWith('glass-left-')?Number(region.split('-')[2]):null;
  const right=region!=='full-image',x=glass!==null?0:right?Math.floor(bitmap.width*(region==='label'?.70:corner!==null?.62:tile!==null?.5:.55)):0;
  const y=Math.floor(bitmap.height*(glass!==null?glass*.15:corner!==null?corner*.075:tile!==null?tile*.08:0));
  const width=glass!==null?Math.ceil(bitmap.width*.55):bitmap.width-x,height=Math.min(bitmap.height-y,Math.ceil(bitmap.height*(region==='label'?.14:glass!==null?.3:corner!==null?.18:tile!==null?.10:right?.5:1)));
  const scale=Math.min(3,(right?1800:2400)/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(bitmap,x,y,width,height,0,0,canvas.width,canvas.height);
  return canvas;
}
function enhanceContrast(canvas){
  const context=canvas.getContext('2d'),pixels=context.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256);
  for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(.299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2]);pixels.data[i]=gray;histogram[gray]++;}
  const count=canvas.width*canvas.height;let low=0,high=255,total=0;
  while(low<255&&(total+=histogram[low])<count*.02)low++;
  total=0;while(high>low&&(total+=histogram[high])<count*.02)high--;
  for(let i=0;i<pixels.data.length;i+=4){const gray=high>low?(pixels.data[i]-low)*255/(high-low):pixels.data[i];pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}
  context.putImageData(pixels,0,0);
}
async function recognize(file,supports,observations){
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}),started=Date.now();
  const withinBudget=()=>Date.now()-started<35000;
  try{
    const instance=await worker();
    // Overlap preserves identifiers crossing a band boundary. Read the small
    // upper-right labels before spending the time budget on the poster itself.
    for(const region of ['label',...Array.from({length:4},(_,i)=>`corner-${i}`),'glass-left-0','glass-left-1',...Array.from({length:7},(_,i)=>`identifier-${i}`),'upper-right','full-image']){
      if(!withinBudget())break;
      const canvas=crop(bitmap,region);
      const {data}=await instance.recognize(canvas,{}, {text:true,blocks:true});
      observations.push({region,text:data.text,confidence:data.confidence});
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
        observations.push({region,text:line.text,confidence:line.confidence});
        for(const word of line.words||[])observations.push({region,text:word.text,confidence:word.confidence});
      }
      if(region!=='full-image'){
        const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])).filter(line=>line.bbox&&/\d/.test(line.text)&&/[A-Z]{2,}[- ]|\d+\s*[-–—]\s*\d+|[- ]\d+\b/i.test(line.text)).slice(0,3);
        for(const line of lines){
          if(!withinBudget())break;
          const box=line.bbox,h=box.y1-box.y0,pad=region.startsWith('corner-')?Math.max(8,h*.4):Math.max(12,h),left=Math.max(0,box.x0-4*h),top=Math.max(0,box.y0-pad),width=Math.min(canvas.width-left,box.x1-left+2*h),height=Math.min(canvas.height-top,h+2*pad);
          const focused=document.createElement('canvas');focused.width=width;focused.height=height;focused.getContext('2d').drawImage(canvas,left,top,width,height,0,0,width,height);
          await instance.setParameters({tessedit_pageseg_mode:7});
          try{
            const refined=await instance.recognize(focused);observations.push({region:region+'-line',text:refined.data.text,confidence:refined.data.confidence});
            if(withinBudget()&&!resolveFrameIdentifier(observations,supports).supportId){
              enhanceContrast(focused);
              const contrasted=await instance.recognize(focused);
              // Same region: preprocessing must not count as independent evidence.
              observations.push({region:region+'-line',text:contrasted.data.text,confidence:contrasted.data.confidence});
            }
            if(region.startsWith('corner-')&&withinBudget()&&!resolveFrameIdentifier(observations,supports).supportId){
              // Slight camera tilt is common on frame labels. Keep the entire
              // line and white margins while testing both tilt directions.
              for(const angle of [-3,3]){
                if(!withinBudget())break;
                const rotated=document.createElement('canvas');rotated.width=focused.width+32;rotated.height=focused.height+Math.ceil(focused.width*.06)+32;
                const ctx=rotated.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,rotated.width,rotated.height);ctx.translate(rotated.width/2,rotated.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(focused,-focused.width/2,-focused.height/2);
                try{const read=await instance.recognize(rotated);observations.push({region:region+'-line',text:read.data.text,confidence:read.data.confidence});}
                finally{rotated.width=rotated.height=1;}
                if(resolveFrameIdentifier(observations,supports).supportId)break;
              }
            }
          }
          finally{await instance.setParameters({tessedit_pageseg_mode:11});focused.width=focused.height=1;}
        }
      }
      if(region.startsWith('corner-')&&withinBudget()&&!resolveFrameIdentifier(observations,supports).supportId){
        enhanceContrast(canvas);
        const enhanced=await instance.recognize(canvas,{}, {text:true,blocks:true});
        observations.push({region,text:enhanced.data.text,confidence:enhanced.data.confidence});
        for(const block of enhanced.data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])
          observations.push({region,text:line.text,confidence:line.confidence});
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
    let timer;const observations=[];
    try{return await Promise.race([recognize(file,supports,observations),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR_TIMEOUT')),45000)})]);}
    catch(error){
      const pending=workerPromise;workerPromise=null;pending?.then(w=>w.terminate(),()=>{});
      // A difficult photo must not erase useful candidates already read.
      if(error.message==='OCR_TIMEOUT'&&observations.length)return {candidates:resolveFrameIdentifier(observations,supports).candidates,supportId:null,observations:[...observations],timedOut:true};
      throw error;
    }
    finally{clearTimeout(timer)}
  });queue=result.catch(()=>{});return result;
}
export async function releaseFrameIdentifierOcr(){await queue;const pending=workerPromise;workerPromise=null;if(pending)await pending.then(w=>w.terminate(),()=>{});}
