import React from 'react';
import {createRoot} from 'react-dom/client';
import {TableView,Detail} from '../../src/main.jsx';
window.mainFixture={calls:[],fail:false,maps:[],saved:[]};
window.testApi=(file,name,args)=>{
 const f=mainFixture;
 if(name==='primaryKeyFor')return {field:'support_id',value:args[1].support_id};
 if(name==='loadAutomaticFieldRules')return Promise.resolve({});
 if(name==='loadSupport360')return Promise.resolve({history:[],issues:[],inspections:[],workOrders:[],edtLinks:[],logs:[]});
 if(name==='listSupportPhotos')return Promise.resolve([]);
 if(name==='isAutomaticField')return false;
 if(name==='inferInputType')return 'text'; // Site is text; actual inference has its historical service tests.
 if(name==='updateUniversalRow'||name==='updateUniversalRows'){f.calls.push({name,args});const fail=f.fail;return new Promise((resolve,reject)=>{const finish=()=>fail?reject(Error('MAIN_FIXTURE_ERROR')):resolve(name==='updateUniversalRows'?args[0].entries.map(u=>({...u.originalRow,...u.changes})):{...args[0].originalRow,...args[0].changes});if(f.hold)(f.pending||=[]).push(finish);else setTimeout(finish,100)})}
 throw Error('Unconfigured main service '+file+':'+name);
};
const root=createRoot(document.getElementById('root'));let key=0;
const row={support_id:'SUP-2',site:'Local site',latitude:45,longitude:-73};
window.mount=(kind='grid',role='Administrateur',readOnly=false)=>{window.mainFixture={calls:[],fail:false,maps:[],saved:[]};root.render(kind==='grid'?<TableView key={++key} name="Infrastructures" dataStore={{Infrastructures:{rows:[row]}}} rolePermission={{visible_tables:['Infrastructures'],visible_columns:{}}} role={role} onRowsUpdated={(...args)=>mainFixture.saved.push(args)} onOpenMap={(...args)=>mainFixture.maps.push(args)}/>:<Detail key={++key} name="Infrastructures" row={row} role={role} config={{table:'infrastructures',primaryKey:'support_id',readOnly}} onSaved={updated=>mainFixture.saved.push(updated)} onClose={()=>root.render(<p>Closed</p>)} onOpenMap={id=>mainFixture.maps.push(id)}/>)};
