import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {recognizeImportPhoto} from '../src/lib/photoImportRecognition.js';

// Exercise the import service with controlled OCR output; no storage/network mutation.
const source=fs.readFileSync('src/services/massPhotoImportService.js','utf8').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'');
const catalog={supports:[{support_id:'3002-7'},{support_id:'3002-8'}],visuals:[]};
let observation;
const analyze=vm.runInNewContext(source+'\nanalyzePhotoItem',{
 readExifDate:async()=>null,readExifGps:async()=>null,sha256File:async()=>'fixture',
 readFrameIdentifier:async()=>observation,recognizeVisualReferences:async()=>[],
 importContextForPhoto:(item,c,manual)=>({recognition:recognizeImportPhoto(item,c,manual)})
});
const item={file:{},mimeType:'image/jpeg',originalFilename:'external.jpg'};
observation={supportId:null,candidates:[{support_id:'3002-7',confidence:99}],observations:[{text:'3002-7',confidence:99}],timedOut:true};
let result=await analyze(item,{catalog});
assert.equal(result.recognition.values.support,undefined,'An interrupted unverified read must not become an automatic association');
assert.equal(result.suggestions[0].support_id,'3002-7','Candidate retained for manual review');
observation={supportId:null,candidates:[{support_id:'3002-7',confidence:99},{support_id:'3002-8',confidence:96}],observations:[{text:'3002-7 3002-8',confidence:99}]};
result=await analyze(item,{catalog});assert.equal(result.recognition.values.support,undefined,'Conflicting OCR stays unresolved');
observation={supportId:'3002-7',candidates:[{support_id:'3002-7',confidence:88}],observations:[]};
result=await analyze(item,{catalog});assert.equal(result.recognition.values.support,'3002-7','Verified multi-read support is preserved');
result=await analyze({...item,manual:{support:'3002-8'}},{catalog});assert.equal(result.recognition.values.support,'3002-8','Manual selection is preserved');
console.log('PASS: interrupted read retains candidate; ambiguous OCR stays manual; verified and manual associations preserved');
