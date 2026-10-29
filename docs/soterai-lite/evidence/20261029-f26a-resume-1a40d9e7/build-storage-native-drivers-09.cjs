const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),esbuild=require('esbuild');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fact=p=>{const b=fs.readFileSync(p);return {path:path.relative(repo,p).replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)};};
function verify(){const p=read(own('full-inputs-09.json'));assert.equal(p.fileCount,1037);for(const r of p.files){const b=fs.readFileSync(path.join(repo,r.path));assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}return p;}
(async()=>{
 const proof=verify(),content=read(own('content-inspection-09.json'));assert.equal(content.sourceCount,1037);assert.deepEqual(content.full,{tests:4475,pass:4471,fail:0,cancelled:0,skipped:4});
 const prior=read(path.resolve(__dirname,'../20261028-f30-setup-verification-847d2f09/native-driver-provenance-02.json'));
 for(const r of prior.auxiliaryInputs){const b=fs.readFileSync(path.join(repo,r.path));assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);}
 const entryPoints={...prior.entryPoints,'lite-precommit-guard-host':'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/f26a-install-diagnostics-08.host.ts'};
 assert.equal(Object.keys(entryPoints).length,25);const out=own('prebuilt-native-hosts-09');assert(!fs.existsSync(out));
 const {parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const built=await esbuild.build({...parserBundleOptions(repo),metafile:true,absWorkingDir:repo,entryPoints,outdir:out,bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'});
 assert(!Object.keys(built.metafile.inputs).some(p=>/phase2\/|vscode-stub/.test(p.replace(/\\/g,'/'))));
 const drivers=fs.readdirSync(out).filter(p=>p.endsWith('.js')).sort().map(p=>({...fact(path.join(out,p)),path:'prebuilt-native-hosts-09/'+p}));assert.equal(drivers.length,25);
 const previous=read(own('native-driver-provenance-07.json'));for(const r of previous.drivers){const now=drivers.find(p=>path.basename(p.path)===path.basename(r.path));assert(now);assert.equal(now.bytes,r.bytes);assert.equal(now.sha256,r.sha256);}
 verify();const result={status:'BUILT_CURRENT1037_DRIVERS25_NOT_NATIVE_ACCEPTANCE',feature:'F26a',observedAt:new Date().toISOString(),sourceProof:fact(own('full-inputs-09.json')),compiler:'compiler-09',strictPrecommitTypecheck:fact(own('native-typecheck-08.txt.result.json')),entryPoints,sourceInputs:Object.keys(built.metafile.inputs).sort().map(p=>fact(path.resolve(repo,p))),auxiliaryInputs:prior.auxiliaryInputs,drivers,unchangedDriverCount:25,originalOracles:34,native07:'CONSUMED_FAILED_NOT_RETRIED',native08:'NOT_AUTHORIZED_NOT_RUN'};
 fs.writeFileSync(own('native-driver-provenance-09.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,sourceCount:1037,drivers:25,allExactPreviousDriverBytes:true,precommit:drivers.find(p=>p.path.endsWith('/lite-precommit-guard-host.js'))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
