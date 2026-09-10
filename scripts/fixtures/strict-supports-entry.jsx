import './remaining-form-entry.jsx';
const original=window.testApi;
window.testApi=(file,name,args)=>{
 if(name==='loadOperationsData')return original(file,name,args).then(data=>({...data,phases:[{id:7,edt_id:1,nom:'Installation',ordre:1},{id:8,edt_id:1,nom:'Retrait',ordre:2}]}));
 if(name==='assignSupportsToEdt'){const f=fixture,fail=f.fail;f.calls.push({file,name,args});return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('SUPPORTS_ERROR')):resolve({supports_affectes:1,supports_introuvables:['MISSING']}),200))}
 return original(file,name,args);
};
