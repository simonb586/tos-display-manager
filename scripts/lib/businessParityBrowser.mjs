import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function productionBrowser(session,execute,options={}){
 const origin=process.env.TDM_TEST_PORTAL_ORIGIN||'https://portail.groupetos.com';
 if(origin!=='https://portail.groupetos.com'&&new URL(origin).hostname!=='127.0.0.1')throw Error('Unexpected browser test origin');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tdm-cutover-browser-'));
 const child=spawn(process.env.TDM_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0',`--user-data-dir=${directory}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket,id=0;const pending=new Map(),errors=[],responses=[];
 const redact=value=>String(value).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted]').replace(/(https?:\/\/[^\s?#]+)[?#][^\s]+/g,'$1?[redacted]');
 try{
  let port;for(let n=0;n<200;n++){try{port=fs.readFileSync(path.join(directory,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{}await pause(100)}
  if(!port)throw Error('Test browser unavailable');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>{pending.delete(current);reject(Error('CDP timeout '+method))},60000);pending.set(current,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:current,method,params}))});
  socket.addEventListener('message',event=>{
   const m=JSON.parse(event.data);
   if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(redact(m.error.message))):p.resolve(m.result)}
   if(m.method==='Runtime.exceptionThrown')errors.push(redact(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
   if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(redact(m.params.args.map(a=>a.value||a.description).join(' ')));
   if(m.method==='Network.responseReceived'){const r=m.params.response;responses.push({requestId:m.params.requestId,url:r.url.split(/[?#]/)[0],status:r.status,type:m.params.type})}
  });
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(redact(result.exceptionDetails.exception?.description||result.exceptionDetails.text));return result.result.value};
  const waitFor=async(expression,seconds=45)=>{for(let n=0;n<seconds*5;n++){if(await evaluate(expression))return;await pause(200)}throw Error('Browser condition timed out: '+expression+'; '+redact(await evaluate('document.body.innerText.slice(0,1200)'))+'; browser errors: '+JSON.stringify(errors))};
  await send('Runtime.enable');await send('Network.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',options.mobile?{width:390,height:844,deviceScaleFactor:1,mobile:true}:{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  if(options.latency)await send('Network.emulateNetworkConditions',{offline:false,latency:options.latency,downloadThroughput:1500000,uploadThroughput:750000});
 if(options.initSource)await send('Page.addScriptToEvaluateOnNewDocument',{source:options.initSource});
 const injected=await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin===${JSON.stringify(origin)})localStorage.setItem('sb-cmdfomowtzrinywdsosy-auth-token',${JSON.stringify(JSON.stringify(session))});`});
  await send('Page.navigate',{url:origin});
  await waitFor('document.readyState==="complete" && document.body.innerText.length>40');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
  return await execute({evaluate,waitFor,pause,send,errors,responses});
 }finally{
  socket?.close();child.kill();
  for(const p of pending.values())p.reject(Error('Browser closed'));pending.clear();
  const resolved=path.resolve(directory),base=path.resolve(os.tmpdir())+path.sep;
  if(resolved.startsWith(base)&&path.basename(resolved).startsWith('tdm-cutover-browser-')){
   await pause(1000);try{fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:500})}catch{console.error('Temporary browser directory cleanup pending')}
  }
 }
}
