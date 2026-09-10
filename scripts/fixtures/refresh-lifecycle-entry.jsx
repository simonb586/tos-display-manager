import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import useRefreshRequest from '../../src/hooks/useRefreshRequest';

function Probe({scope}) {
 const refresh=useRefreshRequest(scope,80);
 const [value,setValue]=useState('empty');
 const [error,setError]=useState('');
 window.startRead=async(label,delay,fail=false)=>{
  const request=refresh.start();
  setError('');
  try {
   const result=await request.wait(new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error(label)):resolve(label),delay)));
   setValue(result);
  }catch(cause){if(request.isCurrent())setError(cause.message)}
  finally{request.finish()}
 };
 return <div data-scope={scope} data-busy={refresh.refreshing}><output>{value}</output><p role="alert">{error}</p></div>;
}
const root=createRoot(document.getElementById('root'));
window.mount=(scope='A')=>root.render(<Probe scope={scope}/>);
window.unmount=()=>root.render(null);
