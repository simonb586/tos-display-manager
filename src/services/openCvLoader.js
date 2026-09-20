import openCvUrl from '@techstark/opencv-js/dist/opencv.js?url';

let engine;
function loadScript(url) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const finish=(error,cv)=>{clearTimeout(timer);script.remove();error?reject(error):resolve(cv)};
    const timer=setTimeout(()=>finish(new Error('Délai de chargement OpenCV dépassé.')),45000);
    script.src=url;script.async=true;
    script.onerror=()=>finish(new Error('Moteur de reconnaissance indisponible.'));
    script.onload=async()=>{
      try { const cv=await globalThis.cv;if(!cv?.Mat)throw Error('Initialisation OpenCV incomplète.');finish(null,cv) }
      catch(error){finish(error)}
    };
    document.head.appendChild(script);
  });
}

export function openCv() {
  if(!engine) engine=(async()=>{
    try {return await loadScript(openCvUrl)}
    catch {return await loadScript(`${openCvUrl}${openCvUrl.includes('?')?'&':'?'}retry=${Date.now()}`)}
  })().catch(error=>{
    engine=null;
    throw new Error('La reconnaissance est temporairement indisponible. Votre formulaire est conservé. Réessayez l’ajout du fichier ; si nécessaire, actualisez la page.',{cause:error});
  });
  return engine;
}
