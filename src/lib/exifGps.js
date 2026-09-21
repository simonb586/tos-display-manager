// Read only GPS coordinates from a bounded JPEG EXIF header. Never infer a support from GPS alone.
export async function readExifGps(file,maxBytes=262144){
 if(!file?.slice||!/^image\/jpe?g$/i.test(file.type||''))return null;
 const bytes=new Uint8Array(await file.slice(0,Math.min(file.size,maxBytes)).arrayBuffer()),view=new DataView(bytes.buffer);
 try{for(let offset=2;offset+10<bytes.length;){
  if(bytes[offset]!==255)break;const marker=bytes[offset+1],size=view.getUint16(offset+2);if(size<2||marker===0xda)break;
  if(marker===0xe1&&String.fromCharCode(...bytes.slice(offset+4,offset+10))==='Exif\0\0'){
   const tiff=offset+10,end=Math.min(bytes.length,offset+size+2),little=view.getUint16(tiff)===0x4949;
   if(!little&&view.getUint16(tiff)!==0x4d4d)return null;
   const u16=p=>view.getUint16(p,little),u32=p=>view.getUint32(p,little);
   const entries=dir=>{if(dir<tiff||dir+2>end)return [];const count=u16(dir);if(count>1024||dir+2+count*12>end)return [];return Array.from({length:count},(_,i)=>dir+2+i*12);};
   const pointer=entries(tiff+u32(tiff+4)).find(e=>u16(e)===0x8825);if(!pointer)return null;
   const tags=new Map(entries(tiff+u32(pointer+8)).map(e=>[u16(e),e]));
   const coordinate=tag=>{const e=tags.get(tag);if(!e||u16(e+2)!==5||u32(e+4)!==3)return null;const p=tiff+u32(e+8);if(p<tiff||p+24>end)return null;const values=[0,8,16].map(n=>{const d=u32(p+n+4);return d?u32(p+n)/d:NaN;});if(!values.every(Number.isFinite)||values[1]>=60||values[2]>=60)return null;return values[0]+values[1]/60+values[2]/3600;};
   const ref=tag=>{const e=tags.get(tag);return e&&u16(e+2)===2&&u32(e+4)===2?String.fromCharCode(bytes[e+8]):'';};
   const lat=coordinate(2),lon=coordinate(4),north=ref(1),east=ref(3);if(lat===null||lon===null||lat>90||lon>180||!['N','S'].includes(north)||!['E','W'].includes(east))return null;
   return {latitude:lat*(north==='S'?-1:1),longitude:lon*(east==='W'?-1:1)};
  }offset+=size+2;
 }}catch{return null;}return null;
}
