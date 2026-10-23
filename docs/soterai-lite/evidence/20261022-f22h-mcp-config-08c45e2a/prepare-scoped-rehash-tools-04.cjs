'use strict';
const e=require('./evidence-lib-01.cjs');
function put(from,to,change){const old=e.bytes(e.own(from)).toString('utf8'),text=change(old);e.assert.notEqual(text,old,to);if(to.endsWith('.cjs'))new(require('node:vm').Script)(text,{filename:to});e.fs.writeFileSync(e.own(to),text,{flag:'wx'});}
put('confirm-failed-byte-exit-01.ps1','confirm-failed-byte-exit-02.ps1',s=>s.replaceAll('durable-byte-01.json','durable-byte-02.json').replaceAll('byte-barriers-run-01.txt','byte-barriers-run-02.txt').replaceAll('durable-byte-failed-exit-01.json','durable-byte-failed-exit-02.json'));
put('prepare-transition-01.cjs','prepare-transition-02.cjs',s=>{
 s=s.replaceAll("'source-staged-byte-verification-01'","'source-staged-byte-verification-02'");
 const marker="indexPath=e.base+'/f22h-transition-index-01.json',allowPath=";e.assert(s.includes(marker));
 s=s.replace(marker,"indexPath=e.base+'/f22h-transition-index-01.json',allowPath=");
 const before="e.fs.writeFileSync(e.path.join(e.repo,allowPath),expected.join('\\n')+'\\n',{flag:'wx'});";e.assert(s.includes(before));
 return s.replace(before,`// Bind all retained late diagnostics and failed/successful byte logs too.
const tracked=new Set(e.lines(e.git('ls-files'))),late=[];
function walkLate(dir){for(const item of e.fs.readdirSync(dir,{withFileTypes:true})){e.assert(!item.isSymbolicLink());const file=e.path.join(dir,item.name);if(item.isDirectory()){if(/^(?:vsix-extracted-|prebuilt-)/.test(item.name)||['extension','extensions','profile','profiles','node_modules','dist','builds','runtime','.git'].includes(item.name))continue;walkLate(file);}else if(/\\.(?:json|jsonl|txt|md|ps1|cjs|ts|js|map|log)$/.test(item.name)){if(dir===__dirname&&['durable-byte-03.stdout.txt','durable-byte-03.stderr.txt'].includes(item.name))continue;const relative=e.relative(file);if(!tracked.has(relative)&&!names.includes(relative)&&relative!==indexPath&&relative!==allowPath)late.push(relative);}}}
walkLate(__dirname);names.push(...late);expected.push(...late);expected.sort();
e.fs.writeFileSync(e.path.join(e.repo,allowPath),expected.join('\\n')+'\\n',{flag:'wx'});`);
});
put('complete-byte-barriers-06.ps1','complete-byte-barriers-07.ps1',s=>{
 const start=s.indexOf("Invoke-Checked 'prepare-acceptance-run-02'");const end=s.indexOf('$taskGit=@(',start);e.assert(start>=0&&end>start);s=s.slice(0,start)+s.slice(end);
 const old="Invoke-Checked 'stage-source-run-01' 'git' ($taskGit+@('add','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'f22h-commit-allowlist-01.txt'))))";e.assert(s.includes(old));
 return s.replace(old,"Invoke-Checked 'stage-source-rehash-run-01' 'git' ($taskGit+@('add','--renormalize','-f',('--pathspec-from-file='+(Join-Path $PSScriptRoot 'staged-rehash-allowlist-01.txt'))))").replaceAll('source-staged-byte-verification-01','source-staged-byte-verification-02').replaceAll('prepare-transition-01.cjs','prepare-transition-02.cjs');
});
put('run-byte-entry-06.ps1','run-byte-entry-07.ps1',s=>s.replaceAll('complete-byte-barriers-06.ps1','complete-byte-barriers-07.ps1').replaceAll('byte-barriers-run-02.txt','byte-barriers-run-03.txt'));
put('start-durable-byte-03.ps1','start-durable-byte-04.ps1',s=>s.replaceAll('run-byte-entry-06.ps1','run-byte-entry-07.ps1').replaceAll('durable-byte-02','durable-byte-03').replaceAll('durable-byte-failed-exit-01.json','durable-byte-failed-exit-02.json'));
e.write('scoped-rehash-tools-04.json',{status:'PREPARED_NOT_EXECUTED_EXACT19_TRACKED_BYTE_REHASH',diagnosis:e.fact(e.own('staged-byte-diagnostics-01.json')),allowlist:e.fact(e.own('staged-rehash-allowlist-01.txt')),sourceIndex:e.fact(e.own('f22h-evidence-index-01.json')),sourceVerifier:'verify-source-01.cjs unchanged exhaustive contract',launcher:'start-durable-byte-04.ps1',entry:'run-byte-entry-07.ps1',transition:'prepare-transition-02.cjs',scope:'Reuse exact1955-entry prepared source index and expected1890paths; every working byte still matches. Force Git rehash for19 listed task-owned cached tracked files with core.autocrlf=false and --renormalize; no file modification or index reset. Original staged LF representations/failed byte checks retained. Every new late helper/diagnostic/archive/log is added to separate transition index after source proof, excluding only active new byte-wrapper streams. Application/runtime/unit/native inputs unchanged; no test rerun needed.'});
console.log(JSON.stringify({status:'PREPARED_EXACT19_REHASH_NOT_EXECUTED'}));
