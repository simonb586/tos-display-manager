import {extractVisualFeatures,compareVisualFeatures,rankVisualReferenceMatches} from '../lib/visualReferenceFeatures.js';
let engine;
async function openCv(){
  if(!engine)engine=import('@techstark/opencv-js').then(async module=>{
    const cv=await module.default;if(!cv.Mat)await new Promise(resolve=>{cv.onRuntimeInitialized=resolve});return cv;
  }).catch(error=>{engine=null;throw error});
  return engine;
}
function canvasForImage(image){
  const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
  const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return canvas;
}
async function features(canvas){const cv=await openCv(),mat=cv.imread(canvas);try{return extractVisualFeatures(cv,mat)}finally{mat.delete()}}
export async function referenceFileFeatures(file){
  if(file.type==='application/pdf'){
    const pdf=await import('pdfjs-dist');
    const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdf.GlobalWorkerOptions.workerSrc=worker.default;
    const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}),document=await task.promise;
    try{
      if(document.numPages>20)throw Error('Le PDF de référence doit contenir au maximum 20 pages.');
      const pages=[];
      for(let page=1;page<=document.numPages;page++){
        const source=await document.getPage(page),base=source.getViewport({scale:1}),viewport=source.getViewport({scale:Math.min(2,1600/Math.max(base.width,base.height))});
        const canvas=globalThis.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await source.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        pages.push({page,features:await features(canvas)});canvas.width=canvas.height=1;source.cleanup();
      }
      return pages;
    }finally{await task.destroy()}
  }
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  try{const canvas=canvasForImage(bitmap);return [{page:1,features:await features(canvas)}]}finally{bitmap.close()}
}
export async function recognizeVisualReferences(file,visuals){
  const references=visuals.flatMap(visual=>(visual.reference_assets||[]).filter(asset=>!asset.archived).flatMap(asset=>(asset.pages||[]).map(page=>({visual,asset,page}))));
  if(!references.length)return [];
  const [{features:photo}]=await referenceFileFeatures(file),cv=await openCv(),matches=[];
  for(const {visual,asset,page} of references){
    const match=compareVisualFeatures(cv,page.features,photo);
    if(match.inliers>=8)matches.push({...match,visual_id:visual.id,campaign_id:visual.campagne_id,client_id:visual.client_id,reference_id:asset.id,page:page.page});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return rankVisualReferenceMatches(matches);
}
