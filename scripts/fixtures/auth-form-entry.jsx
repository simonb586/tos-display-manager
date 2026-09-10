import React from 'react';
import {createRoot} from 'react-dom/client';
import ProductionLogin from '../../src/components/ProductionLogin';
import AccountActivation from '../../src/components/AccountActivation';
const root=createRoot(document.getElementById('root'));let key=0;
window.authFixture={calls:[],fail:false,activated:0,session:{user:{email:'local@example.test',user_metadata:{account_activated:false}}}};
window.authApi=async(name)=>{const f=window.authFixture;f.calls.push(name);const fail=f.fail;await new Promise(r=>setTimeout(r,100));if(name==='getSession')return {data:{session:f.session}};return {data:{},error:fail?{message:'AUTH_FIXTURE_ERROR'}:null}};
window.testApi=async(file,name)=>{const r=await window.authApi(name);if(r.error)throw Error(r.error.message);return r.data};
window.mount=(kind='login',state='ready',role='Client')=>{window.authFixture.calls=[];window.authFixture.fail=false;window.authFixture.session={user:{email:'local@example.test',user_metadata:{account_activated:state==='activated'}}};window.history.replaceState({},'',state==='expired'?'/?error_description=expired':'/');root.render(kind==='login'?<ProductionLogin key={++key}/>:<AccountActivation key={++key} session={state==='expired'||state==='invalid'?null:window.authFixture.session} profile={{role,invitation_statut:state==='activated'?'Compte activé':'Invitation envoyée'}} onActivated={async()=>{window.authFixture.activated++;root.render(<p>Activation fixture complete</p>)}}/>)};
