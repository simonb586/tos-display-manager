// Reproduce existing failing static suites against HEAD in memory. No checkout/revert.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
if(process.argv[2]==='--child'){
 const original=fs.readFileSync.bind(fs),cache=new Map();
 fs.readFileSync=(file,...args)=>{
  const relative=typeof file==='string'?path.relative(process.cwd(),path.resolve(file)).replaceAll('\\','/') : '';
  if(relative.startsWith('src/')||relative.startsWith('supabase/')){
   if(!cache.has(relative))cache.set(relative,execFileSync('git',['show',`HEAD:${relative}`]));
   const content=cache.get(relative);return typeof args[0]==='string'?content.toString(args[0]):content;
  }
  return original(file,...args);
 };
 await import(pathToFileURL(path.resolve(process.argv[3])).href);
}else{
 const initial=JSON.parse(fs.readFileSync('docs/stabilization-local/existing-tests.json','utf8')),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 const results=initial.filter(r=>r.exitCode!==0).map(test=>{const script=pkg.scripts[test.name].slice(5);const r=spawnSync(process.execPath,[process.argv[1],'--child',script],{encoding:'utf8',windowsHide:true});return {name:test.name,headExitCode:r.status,firstAssertion:(r.stderr||'').match(/AssertionError[^\n]*/)?.[0],output:(r.stdout+r.stderr).slice(0,2500)}});
 fs.writeFileSync('docs/stabilization-local/baseline-failures.json',JSON.stringify(results,null,2));console.log(results.map(r=>`${r.name}: HEAD=${r.headExitCode} ${r.firstAssertion}`).join('\n'));
}
