'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const proof=read(own('full-inputs-04.json'));assert.equal(proof.fileCount,1024);
const extras=[
 {path:'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/litePSReadLineHistory.proposal06.host.ts',bytes:30341,sha256:'3632cf751787731b75457bc092a655e7a4f5fb48e5feba2eebec129f73eea7f9'},
 {path:'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/affected-preparation-artifact-cleanup01.host.ts',bytes:33875,sha256:'a4f4f34c06b13bc9308c3f9d7fd5721988d6707115eb3461ce7d02c72ce777d0'},
 {path:'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/f27-native01.host.ts',bytes:23427,sha256:'c22c09daef636db714d217bc81095de4171f0462b33548c427e4a35d05961404'},
 {"path":"docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a/f29-native03.host.ts","bytes":58440,"sha256":"e6b26882625a209d23dd2474f44f878c73d32be44df64de13a51aa7c68946bae"},
];
function check(){for(const pin of [...proof.files,...extras]){const b=fs.readFileSync(path.join(repo,pin.path));assert.equal(b.length,pin.bytes,pin.path);assert.equal(sha(b),pin.sha256,pin.path);}}
function receipt(name){const result=read(own(name+'.txt.result.json'));assert.equal(result.exitCode,0);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),result.sha256.toLowerCase());}
check();receipt('compiler-04');receipt('native-fixture-typecheck-04');
const candidate=read(own('content-inspection-02.json'));assert.equal(candidate.status,'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE');assert.equal(candidate.sourceCount,1024);assert.equal(candidate.machineSettings,85);assert.equal(candidate.protectionCenterDefault,true);
const old=fs.readFileSync(path.join(repo,'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/build-native-hosts-02.cjs'),'utf8'),entries={};
for(const match of old.matchAll(/'([a-z0-9-]+)':path\.join\(repo,'(packages\/vscode-extension\/src\/__tests__\/host\/[A-Za-z0-9.]+)'\)/g)){
 assert(proof.files.some(row=>row.path===match[2]),'Unfrozen canonical fixture refused');entries[match[1]]=path.join(repo,match[2]);
}
assert.equal(Object.keys(entries).length,20);assert(!Object.values(entries).some(file=>file.toLowerCase().includes('precommit')));
const artifact=Object.keys(entries).find(name=>path.basename(entries[name])==='liteArtifactScanner.host.ts');assert(artifact);entries[artifact]=path.join(repo,extras[1].path);
entries['lite-psreadline-history-host']=path.join(repo,extras[0].path);entries['lite-f27-self-hygiene-host']=path.join(repo,extras[2].path);
entries['lite-f29-protection-center-host']=path.join(repo,extras[3].path);
const out=own('prebuilt-native-hosts-03');assert(!fs.existsSync(out));fs.mkdirSync(out);
const {parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
esbuild.build({...parserBundleOptions(repo),metafile:true,absWorkingDir:repo,entryPoints:entries,outdir:out,bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'}).then(result=>{
 check();const drivers=fs.readdirSync(out).filter(name=>name.endsWith('.js')).sort().map(name=>{const raw=fs.readFileSync(path.join(out,name));return{path:path.relative(__dirname,path.join(out,name)).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}});assert.equal(drivers.length,23);
 const parser=Object.keys(result.metafile.inputs).filter(name=>name.replace(/\\/g,'/').includes('node_modules/jsonc-parser/'));assert(parser.some(name=>name.replace(/\\/g,'/').endsWith('jsonc-parser/lib/esm/main.js')));assert(!parser.some(name=>name.replace(/\\/g,'/').includes('/lib/umd/')));
 fs.writeFileSync(own('native-driver-provenance-03.json'),JSON.stringify({status:'BUILT_NOT_RUN_ESM_PARSER_INLINED',observedAt:new Date().toISOString(),compiler:'compiler-04',auxiliaryTypecheck:'native-fixture-typecheck-04',sourceProofSha256:sha(fs.readFileSync(own('full-inputs-04.json'))),auxiliaryInputs:extras,entryPoints:Object.fromEntries(Object.entries(entries).map(([key,value])=>[key,path.relative(repo,value).replace(/\\/g,'/')])),inputs:result.metafile.inputs,outputs:result.metafile.outputs,drivers,native06:'F26a_NOT_INCLUDED_NOT_RUN'},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'BUILT_NOT_RUN',drivers:23,f27Assertions:22,f29Assertions:30,originalAffectedFamilies:20,historyAffectedAssertions:28,emittedConsole:'SEPARATE_8_NOT_RUN',native06:'F26a_EXCLUDED_NOT_RUN'}));
}).catch(()=>{console.error('F29 native fixture build refused; all evidence retained.');process.exitCode=1;});
