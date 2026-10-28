// Evidence-only F29 fixture replacement. Retain the original 23-driver build.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=f=>{const b=fs.readFileSync(f);return{path:path.relative(repo,f).replace(/\\/g,'/'),bytes:b.length,sha256:sha(b)}};
const proof=read(own('full-inputs-03.json')),old=read(own('native-driver-provenance-01.json'));assert.equal(proof.files.length,1024);assert.equal(old.drivers.length,23);assert.equal(old.sourceProofSha256,fact(own('full-inputs-03.json')).sha256);
const candidate=fact(own('f29-native03.host.ts')),extras=[...old.auxiliaryInputs.filter(row=>path.basename(row.path)!=='f29-native02.host.ts'),candidate];
function check(){for(const row of [...proof.files,...extras]){const b=fs.readFileSync(path.join(repo,row.path));assert.equal(b.length,row.bytes,row.path);assert.equal(sha(b),row.sha256,row.path);}for(const row of old.drivers){const b=fs.readFileSync(own(row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}}
function receipt(name){const r=read(own(name+'.txt.result.json')),c=read(own(name+'-owned-close.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());assert(c.actualClose&&c.stdoutEOF&&c.stderrEOF&&!c.deadlineExceeded&&!c.streamError&&!c.overflow);assert.equal(c.exitCode,0);assert.equal(c.signal,null);assert.equal(c.signalsRequested,0);}
async function main(){
 check();receipt('native-fixture-typecheck-03');const out=own('prebuilt-native-hosts-02');assert(!fs.existsSync(out));fs.mkdirSync(out);
 const {parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const result=await esbuild.build({...parserBundleOptions(repo),metafile:true,absWorkingDir:repo,entryPoints:{'lite-f29-protection-center-host':path.join(repo,candidate.path)},outdir:out,bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'});
 const built=path.join(out,'lite-f29-protection-center-host.js'),replacement=fact(built),drivers=old.drivers.map(row=>path.basename(row.path)==='lite-f29-protection-center-host.js'?{path:path.relative(__dirname,built).replace(/\\/g,'/'),bytes:replacement.bytes,sha256:replacement.sha256}:row);
 assert.equal(drivers.length,23);assert.equal(drivers.filter(row=>row.path.startsWith('prebuilt-native-hosts-02/')).length,1);check();
 for(const row of drivers){const b=fs.readFileSync(own(row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
 const value={...old,status:'BUILT_NOT_RUN_ESM_PARSER_INLINED',observedAt:new Date().toISOString(),compiler:'compiler-03',auxiliaryTypecheck:'native-fixture-typecheck-03',auxiliaryInputs:extras,entryPoints:{...old.entryPoints,'lite-f29-protection-center-host':candidate.path},inputs:{...old.inputs,...result.metafile.inputs},outputs:{...old.outputs,...result.metafile.outputs},drivers,supersededUnexecutedBuild:fact(own('native-driver-provenance-01.json')),replacementScope:'Exactly one new F29 evidence fixture/driver; other22 source and built bytes retained unchanged. No native behavior run.',native06:'F26a_NOT_INCLUDED_NOT_RUN'};
 fs.writeFileSync(own('native-driver-provenance-02.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'23_DRIVERS_BUILT_NOT_RUN_22_EXACT_UNCHANGED',candidate,driver:replacement,proof:value.sourceProofSha256,native06:'EXCLUDED_NOT_RUN'}));
}
main().catch(error=>{console.error('F29 successor driver build refused: '+(error instanceof Error?error.name:'UnknownFailure'));process.exitCode=1;});
