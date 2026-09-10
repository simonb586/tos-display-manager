import './portal-parity-entry.jsx';
const api=window.testApi;
window.testApi=(file,name,args)=>{
  if(name==='createMultiSupportClientRequest'){
    portalFixture.calls.push({name,args});
    const fail=portalFixture.fail;
    return new Promise((resolve,reject)=>{
      const finish=()=>fail?reject(Error('REQUEST_ERROR')):resolve({id:1});
      if(portalFixture.holdRequest) portalFixture.releaseRequest=finish;
      else setTimeout(finish,150);
    });
  }
  return api(file,name,args);
};
