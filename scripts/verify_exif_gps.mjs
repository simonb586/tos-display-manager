import assert from 'node:assert/strict';import {readExifGps} from '../src/lib/exifGps.js';
function photo(little=true){const b=new Uint8Array(180),v=new DataView(b.buffer);b.set([255,216,255,225]);v.setUint16(4,176);b.set([69,120,105,102,0,0],6);const t=12;v.setUint16(t,little?0x4949:0x4d4d);const u16=(p,x)=>v.setUint16(t+p,x,little),u32=(p,x)=>v.setUint32(t+p,x,little);u16(2,42);u32(4,8);u16(8,1);u16(10,0x8825);u16(12,4);u32(14,1);u32(18,26);u16(26,4);
for(let i=0;i<4;i++){const p=28+i*12;u16(p,i+1);u16(p+2,i%2?5:2);u32(p+4,i%2?3:2);if(i%2)u32(p+8,i===1?80:104);else b[t+p+8]=i===0?78:87;}
for(const [p,vals]of [[80,[45,30,0]],[104,[73,35,0]]])for(let i=0;i<3;i++){u32(p+i*8,vals[i]);u32(p+i*8+4,1);}return new File([b],'gps.jpg',{type:'image/jpeg'});}
for(const little of [true,false]){const gps=await readExifGps(photo(little));assert.equal(gps.latitude,45.5);assert.equal(gps.longitude,-(73+35/60));}
assert.equal(await readExifGps(new File([new Uint8Array(4)],'broken.jpg',{type:'image/jpeg'})),null);assert.equal(await readExifGps(new File(['x'],'no.png',{type:'image/png'})),null);console.log('PASS: EXIF GPS little/big endian, western hemisphere, truncated and non-JPEG originals');
