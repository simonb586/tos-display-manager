import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import FieldCatalogDrawer from '../../src/components/field-catalog/FieldCatalogDrawer';
const field={id:'field-local-1',fieldId:'infrastructures.notes',tableName:'infrastructures',technicalName:'notes',label:'Notes',field_type:'short_text',updated_at:'2026-09-08T00:00:00Z',configurationStatus:'draft',physical:{dataType:'text',udtName:'text',nullable:true},system:false,is_virtual:false};
window.drawerFixture={calls:[],fail:false,closed:0,saved:0};
window.testApi=(file,name,args)=>{const f=window.drawerFixture,fail=f.fail;f.calls.push({file,name,args});return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('DRAWER_FIXTURE_ERROR')):resolve({changed:true,updatedAt:'2026-09-08T01:00:00Z'}),100))};
function Fixture(){const [open,setOpen]=useState(true);return <><button id="open-drawer" onClick={()=>setOpen(true)}>Open</button>{open&&<FieldCatalogDrawer field={field} role="Administrateur" catalogFields={[field]} onClose={()=>{drawerFixture.closed++;setOpen(false)}} onSaved={async()=>{drawerFixture.saved++}}/>}</>}
const root=createRoot(document.getElementById('root'));let key=0;
window.mount=()=>{window.drawerFixture={calls:[],fail:false,closed:0,saved:0};root.render(<Fixture key={++key}/>)};
