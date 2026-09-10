import {build} from 'esbuild';
import {parse} from '@babel/parser';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';

export async function offlineBrowser(entry,execute,{mockServices=true,realServices=[],supabaseSource=null,exposeMain=false,realServiceExports={}}={}){
 const exceptions=[],consoleErrors=[],calls=[],pending=new Map();let socket,child,server,id=0;
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const plugins=mockServices?[{name:'local-service-fixtures',setup(b){
  if(exposeMain)b.onLoad({filter:/[\\/]src[\\/]main\.jsx$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace("createRoot(document.getElementById('root')).render(<App/>);",'')+'\nexport {App,TableView,Detail,Dashboard,ExecutiveDashboard};',loader:'jsx',resolveDir:path.dirname(a.path)}));
  b.onResolve({filter:/\/services\/[^/]+(?:\.js)?$/},a=>{const file=path.resolve(a.resolveDir,a.path);const resolved=fs.existsSync(file)?file:file+'.js';if(realServices.includes(path.basename(resolved)))return;return {path:resolved,namespace:'fixture-service'}});
  b.onLoad({filter:/.*/,namespace:'fixture-service'},a=>{
   const ast=parse(fs.readFileSync(a.path,'utf8'),{sourceType:'module'}),names=[];
   for(const n of ast.program.body){if(n.type!=='ExportNamedDeclaration')continue;if(n.declaration?.id)names.push(n.declaration.id.name);for(const d of n.declaration?.declarations||[])names.push(d.id.name);for(const s of n.specifiers||[])names.push(s.exported.name)}
   return {contents:[...new Set(names)].map(name=>path.basename(a.path)==='photoAccessService.js'&&name==='clearSignedPhotoUrlCache'?'export const clearSignedPhotoUrlCache=()=>{};':path.basename(a.path)==='photoAccessService.js'&&name==='PHOTO_URL_TTL'?'export const PHOTO_URL_TTL={preview:300,download:120,report:900};':realServiceExports[path.basename(a.path)]?.includes(name)?fs.readFileSync(a.path,'utf8').slice(...(()=>{const n=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name===name);return [n.start,n.end]})()):`export const ${name}=(...args)=>window.testApi(${JSON.stringify(path.basename(a.path))},${JSON.stringify(name)},args);`).join('\n'),loader:'js',resolveDir:path.dirname(a.path)};
  });
  b.onResolve({filter:/\/supabaseClient(?:\.js)?$/},()=>({path:'supabase',namespace:'fixture-client'}));
  b.onLoad({filter:/.*/,namespace:'fixture-client'},()=>({contents:supabaseSource||'export const supabaseConfigured=true; export const supabase={auth:{getSession:async()=>({data:{session:null}}),signOut:async()=>({error:null})}};'}));
 }}]:[];
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'},plugins});
 const content=bundle.outputFiles[0].contents;
 server=http.createServer((req,res)=>{const js=req.url==='/bundle.js';res.setHeader('Content-Type',js?'text/javascript':'text/html');res.end(js?content:'<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tos-followup-edge-'));
 child=spawn(process.env.TOS_TEST_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0',`--user-data-dir=${temp}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 try{
  let port;for(let n=0;n<100;n++){try{port=fs.readFileSync(path.join(temp,'DevToolsActivePort'),'utf8').split('\n')[0];break}catch{}await sleep(100)}if(!port)throw Error('Browser unavailable');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(10000)})).json();socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
  function send(method,params={}){return new Promise((resolve,reject)=>{const current=++id,timer=setTimeout(()=>reject(Error('CDP timeout '+method)),20000);pending.set(current,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id:current,method,params}))})}
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')consoleErrors.push(m.params.args.map(a=>a.value||a.description).join(' '));if(m.method==='Fetch.requestPaused'){const local=m.params.request.url.startsWith(origin);send(local?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(!local?{errorReason:'BlockedByClient'}:{})}).catch(()=>{})}});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression:`(()=>{const value=(0,eval)(${JSON.stringify(expression)});return value instanceof Node?true:value})()`,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value};
  const waitFor=async expression=>{for(let n=0;n<160;n++){if(await evaluate(expression))return;await sleep(50)}throw Error('Timeout: '+expression+'\n'+await evaluate('document.body.innerText.slice(0,1500)'))};
  await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});await send('Page.navigate',{url:origin});await waitFor('Boolean(window.mount)');
  return await execute({evaluate,waitFor,sleep,exceptions,consoleErrors,send,origin});
 }finally{socket?.close();child?.kill();server?.close();}
}
