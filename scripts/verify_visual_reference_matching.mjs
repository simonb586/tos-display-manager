import assert from 'node:assert/strict';
import cvModule from '@techstark/opencv-js';
import {extractVisualFeatures,compareVisualFeatures,rankVisualReferenceMatches} from '../src/lib/visualReferenceFeatures.js';
const cv=await cvModule;
function artwork(seed){const mat=new cv.Mat(700,500,cv.CV_8UC4,new cv.Scalar(255,255,255,255));
 for(let i=0;i<80;i++){seed=(seed*1664525+1013904223)>>>0;const x=30+seed%440;seed=(seed*1664525+1013904223)>>>0;const y=30+seed%640;cv.circle(mat,new cv.Point(x,y),6+seed%17,new cv.Scalar(seed%200,(seed>>>8)%200,(seed>>>16)%200,255),3);}
 cv.putText(mat,'TOS REFERENCE '+seed,new cv.Point(35,350),cv.FONT_HERSHEY_SIMPLEX,.7,new cv.Scalar(0,0,0,255),2);return mat;}
const original=artwork(12),other=artwork(970),scene=new cv.Mat(),src=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,500,0,500,700,0,700]),dst=cv.matFromArray(4,1,cv.CV_32FC2,[130,80,600,120,650,760,90,730]);
const transform=cv.getPerspectiveTransform(src,dst);
try{
 cv.warpPerspective(original,scene,transform,new cv.Size(800,850),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(220,220,220,255));
 const a=extractVisualFeatures(cv,original),b=extractVisualFeatures(cv,scene),c=extractVisualFeatures(cv,other);
 const match=compareVisualFeatures(cv,a,b),wrong=compareVisualFeatures(cv,c,b);
 assert(match.reliable,JSON.stringify(match));assert(!wrong.reliable,JSON.stringify(wrong));
 assert(rankVisualReferenceMatches([{...match,visual_id:1},{...wrong,visual_id:2}])[0].confirmed);
 assert(rankVisualReferenceMatches([{...match,visual_id:1},{...match,visual_id:2}]).every(m=>!m.confirmed),'Similar artwork remains ambiguous');
 console.log('PASS: reference artwork recognized under perspective, unrelated artwork rejected, ambiguity retained',match);
}finally{original.delete();other.delete();scene.delete();src.delete();dst.delete();transform.delete();}
