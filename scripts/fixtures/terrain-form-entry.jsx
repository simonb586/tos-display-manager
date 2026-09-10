import React from 'react';
import {createRoot} from 'react-dom/client';
import TerrainApp from '../../src/components/TerrainApp';
const root=createRoot(document.getElementById('root'));let id=0;
window.terrainFixture={calls:[],fail:false};
window.testApi=(file,name,args)=>{
 const f=window.terrainFixture, fail=f.fail&&name.startsWith('finalize');f.calls.push({name,args});
 const results={listTerrainIssueContexts:[{phase_id:7,phase_type:'installation',edt_id:1,no_edt:'EDT1'}],diagnoseCompatibleVisualsForSupport:{visuals:[{id:34,nom_visuel:'Visual34',campagne:{nom_campagne:'Fixture'}}],diagnostic:{eligibleCount:1}},uploadTerrainPhoto:{path:'local/photo.png',normalizedFilename:'photo.png',publicUrl:''},rollbackUploadedPhoto:{},finalizeTerrainInstallation:{ok:true,reference:'LOCAL-1'},finalizeTerrainIntervention:{ok:true,reference:'LOCAL-1'}};
 if(!(name in results))throw Error('Unconfigured terrain service '+name);
 return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('TERRAIN_FIXTURE_ERROR')):resolve(results[name]),50));
};
window.mount=(role='Installateur')=>{window.terrainFixture={calls:[],fail:false};root.render(<TerrainApp key={++id} role={role} session={{user:{email:'installer@example.test'}}} dataStore={{Infrastructures:{rows:[{support_id:'VH-VAUD-16',site:'Fixture'}]}}}/>)};
