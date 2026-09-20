import {readFrameIdentifier,releaseFrameIdentifierOcr} from '../../src/services/frameIdentifierOcrService';
import {referenceFileFeatures,recognizeVisualReferences} from '../../src/services/visualReferenceRecognitionService';
import {jsPDF} from 'jspdf';
const fileOf=async(canvas,name)=>new File([await new Promise(r=>canvas.toBlob(r,'image/png'))],name,{type:'image/png'});
window.runRecognition=async()=>{
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1200;
 const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1000,1200);
 let seed=12345;
 for(let i=0;i<150;i++){seed=(seed*1664525+1013904223)>>>0;const x=40+seed%870;seed=(seed*1664525+1013904223)>>>0;const y=260+seed%870;c.strokeStyle=`rgb(${seed%170},${(seed>>>8)%170},${(seed>>>16)%170})`;c.lineWidth=4;c.strokeRect(x,y,20+seed%70,20+(seed>>>8)%80);}
 c.fillStyle='black';c.font='bold 50px Arial';c.fillText('REFERENCE VISUELLE',110,450);
 const reference=await fileOf(canvas,'reference.png');
 window.recognitionProgress='references';
 const pages=await referenceFileFeatures(reference);
 const pdf=new jsPDF({unit:'px',format:[1000,1200]});pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,1000,1200);
 const pdfPages=await referenceFileFeatures(new File([pdf.output('blob')],'reference.pdf',{type:'application/pdf'}));
 const photo=document.createElement('canvas');photo.width=1300;photo.height=1400;
 const p=photo.getContext('2d');p.fillStyle='#bbb';p.fillRect(0,0,1300,1400);p.save();p.transform(.95,.03,.07,.95,50,100);p.drawImage(canvas,0,0);p.restore();
 p.fillStyle='white';p.fillRect(770,20,500,130);p.fillStyle='black';p.font='bold 70px Arial';p.fillText('3002-7',810,110);
 const imported=await fileOf(photo,'IMG_001.png');
 const visuals=[{id:1,client_id:2,campagne_id:7,reference_assets:[{id:'photo',pages}]},{id:2,client_id:2,campagne_id:8,reference_assets:[]}];
 window.recognitionProgress='visual-match';
 const matches=await recognizeVisualReferences(imported,visuals);
 window.recognitionProgress='frame-ocr';
 const ocr=await readFrameIdentifier(imported,[{support_id:'3002-7'},{support_id:'3002-8'}]);
 await releaseFrameIdentifierOcr();
 return {photoPoints:pages[0].features.points.length,pdfPoints:pdfPages[0].features.points.length,pdfPages:pdfPages.length,matches,ocr:{supportId:ocr.supportId,candidates:ocr.candidates}};
};
document.body.innerText='Local reference recognition test ready — photo, PDF and frame identifier';
