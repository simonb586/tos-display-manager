import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const git=(...args)=>execFileSync('git',['-c','core.safecrlf=false',...args],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const output='docs/stabilization-local/certification/remote/coordinated-cutover';
fs.mkdirSync(output,{recursive:true});
const excludedChecks=new Set(['verify_anon_regression','verify_anon_table_closure','verify_canonical_photo_role','verify_final_blockers_local','verify_final_concurrency','verify_final_concurrency_evidence','verify_four_rpc_regression','verify_four_rpcs_local','verify_global_security_blockers','verify_live_cutover_compatibility','verify_rpc_authorization_three','verify_rpc_extension_local','verify_tenant_phase_regression','verify_terrain_private_policies']);
const candidates=git('diff','--name-only','HEAD').concat(git('ls-files','--others','--exclude-standard').filter(file=>
 /^src\//.test(file)||/^supabase\/migrations\/202609/.test(file)||/^scripts\/(fixtures|lib)\//.test(file)||
 (file.startsWith('scripts/verify_')&&!excludedChecks.has(path.basename(file,'.mjs')))||file==='scripts/stabilization-browser-entry.jsx'||file==='scripts/audit_cutover_commit.mjs'
));
// Reports with production row payloads, temporary SQL fixtures and generated
// exports stay local. Only deterministic test inputs required by check are added.
candidates.push('.gitattributes','.vercelignore','scripts/audit_stabilization_controls.mjs','docs/stabilization-local/existing-tests.json');
for(const dir of ['followup','certification','certification/strict','certification/remote/photo-private', 'certification/remote/coordinated-cutover']){
 const location='docs/stabilization-local/'+dir;
 fs.mkdirSync(location,{recursive:true});fs.writeFileSync(location+'/.gitkeep','');candidates.push(location+'/.gitkeep');
}
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['supabase-secret',/\bsb_secret_[A-Za-z0-9_-]{15,}/],
 ['access-token',/\b(?:sbp_|ghp_|github_pat_|vercel_)[A-Za-z0-9_-]{20,}/],
 ['provider-key',/\b(?:re_|sk_live_)[A-Za-z0-9_-]{24,}/],
 ['credential-url',/postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"$]+@/],
 ['jwt',/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/]
];
const findings=[],files=[...new Set(candidates)].sort().map(file=>{
 const buffer=fs.readFileSync(file),text=buffer.toString('utf8');
 for(const [kind,pattern] of patterns)if(pattern.test(text))findings.push({file,kind});
 if(/(?:^|\/)\.env(?!\.example$)|\.log$|\.vercel\/|\.cache\/|scripts\/sql\//.test(file))findings.push({file,kind:'temporary-or-config'});
 return {file,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
});
const result={date:new Date().toISOString(),branch:git('branch','--show-current')[0],base:git('rev-parse','HEAD')[0],files,findings,scope:'Validated stabilization and private photo readers; Edge source is prepared, not deployed. Deterministic browser test fixtures are source inputs, not production fixtures.'};
fs.writeFileSync(output+'/commit-candidates.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),findings},null,2));
if(findings.length)process.exitCode=1;
