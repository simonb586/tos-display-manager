import './refresh-entry.jsx';
const original=window.testApi,originalMount=window.mount;
window.strictUser={role:'Installateur',inactive:false};
window.testApi=(file,name,args)=>{
 if(['listManagedUsers','listUsers'].includes(name))return original(file,name,args).then(rows=>rows.map(r=>({...r,role:strictUser.role,client_id:2,statut:strictUser.inactive?'Désactivé':'Actif',lifecycle_status:strictUser.inactive?'Désactivé':'Compte activé'})));
 if(name==='listClients')return original(file,name,args).then(()=>[{id:2,nom_client:'EXO'},{id:9,nom_client:'Client B'}]);
 if(name==='toggleUserStatus'){fixture.calls.push({file,name,args});const fail=fixture.fail;return new Promise((resolve,reject)=>setTimeout(()=>fail?reject(Error('REFRESH_FIXTURE_ERROR')):resolve({id:args[0].id}),fixture.delay))}
 return original(file,name,args);
};
window.mount=(module,actor='Administrateur',targetRole='Installateur',inactive=false)=>{window.strictUser={role:targetRole,inactive};originalMount(module,actor)};
