export function extractVisualFeatures(cv,source){
  const gray=new cv.Mat(),mask=new cv.Mat(),descriptors=new cv.Mat(),points=new cv.KeyPointVector(),detector=new cv.ORB(1000);
  try{
    if(source.channels()===1)source.copyTo(gray);else cv.cvtColor(source,gray,cv.COLOR_RGBA2GRAY);
    detector.detectAndCompute(gray,mask,points,descriptors);
    const coordinates=[];for(let i=0;i<points.size();i++){const p=points.get(i).pt;coordinates.push([Math.round(p.x*100)/100,Math.round(p.y*100)/100]);}
    return {version:1,width:source.cols,height:source.rows,points:coordinates,
      descriptors:btoa(String.fromCharCode(...descriptors.data)),columns:descriptors.cols};
  }finally{gray.delete();mask.delete();descriptors.delete();points.delete();detector.delete();}
}
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const validFeatures=value=>value?.version===1&&Array.isArray(value.points)&&value.points.length<=1000
 && value.points.length>=12&&value.columns===32&&typeof value.descriptors==='string'&&value.descriptors.length<=44000
 && value.width>0&&value.height>0&&value.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
export function compareVisualFeatures(cv,reference,photo){
  if(!validFeatures(reference)||!validFeatures(photo))return {inliers:0,reliable:false,score:0};
  let referenceBytes,photoBytes;try{referenceBytes=decode(reference.descriptors);photoBytes=decode(photo.descriptors)}catch{return {inliers:0,reliable:false,score:0}}
  if(referenceBytes.length!==reference.points.length*32||photoBytes.length!==photo.points.length*32)return {inliers:0,reliable:false,score:0};
  const a=cv.matFromArray(reference.points.length,reference.columns,cv.CV_8U,referenceBytes);
  const b=cv.matFromArray(photo.points.length,photo.columns,cv.CV_8U,photoBytes);
  const matcher=new cv.BFMatcher(cv.NORM_HAMMING,false),matches=new cv.DMatchVectorVector();
  let src,dst,mask,homography;
  try{
    matcher.knnMatch(a,b,matches,2);
    const pairs=[],used=new Set();
    for(let i=0;i<matches.size();i++){
      const pair=matches.get(i);
      if(pair.size()>=2){const first=pair.get(0),second=pair.get(1);if(first.distance<64&&first.distance<.7*second.distance&&!used.has(first.trainIdx)){pairs.push([first.queryIdx,first.trainIdx]);used.add(first.trainIdx);}}
      pair.delete();
    }
    if(pairs.length<8)return {inliers:0,reliable:false,score:0};
    src=cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(([i])=>reference.points[i]));
    dst=cv.matFromArray(pairs.length,1,cv.CV_32FC2,pairs.flatMap(([,i])=>photo.points[i]));
    mask=new cv.Mat();homography=cv.findHomography(src,dst,cv.RANSAC,4,mask);
    if(homography.empty())return {inliers:0,reliable:false,score:0};
    const accepted=pairs.filter((_,i)=>mask.data[i]),inliers=accepted.length,ratio=inliers/pairs.length;
    const xs=accepted.map(([i])=>reference.points[i][0]),ys=accepted.map(([i])=>reference.points[i][1]);
    const coverage=accepted.length?(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/(reference.width*reference.height):0;
    return {inliers,ratio,coverage,reliable:inliers>=20&&ratio>=.75&&coverage>=.25,score:Math.round(inliers*ratio*100)/100};
  }finally{a.delete();b.delete();matches.delete();matcher.delete();src?.delete();dst?.delete();mask?.delete();homography?.delete();}
}
export function rankVisualReferenceMatches(matches){
  const byVisual=new Map();
  for(const match of matches){const previous=byVisual.get(match.visual_id);if(!previous||match.score>previous.score)byVisual.set(match.visual_id,match);}
  const ranked=[...byVisual.values()].sort((a,b)=>b.score-a.score);
  // Multiple formats or similar artwork must not be silently resolved by list order.
  const winner=ranked[0];
  const unique=winner?.reliable&&(!ranked[1]||winner.score>=ranked[1].score*1.6);
  return ranked.map((row,index)=>({...row,confirmed:Boolean(unique&&index===0)}));
}
