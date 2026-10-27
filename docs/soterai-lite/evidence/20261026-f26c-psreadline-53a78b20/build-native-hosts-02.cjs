const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const proof=read(own('native-source-inputs-03.json'));function check(){for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}}
check();const compiler=read(own('compiler-07.txt.result.json'));assert.equal(compiler.exitCode,0);assert.equal(sha(fs.readFileSync(own('compiler-07.txt'))),compiler.sha256.toLowerCase());
const old=fs.readFileSync(path.join(repo,'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/build-native-hosts-02.cjs'),'utf8'),entries={};
for(const match of old.matchAll(/'([a-z0-9-]+)':path\.join\(repo,'(packages\/vscode-extension\/src\/__tests__\/host\/[A-Za-z0-9.]+)'\)/g))entries[match[1]]=path.join(repo,match[2]);
assert.equal(Object.keys(entries).length,20);assert(!Object.values(entries).some(file=>file.toLowerCase().includes('precommit')));
entries['lite-psreadline-history-host']=path.join(repo,'packages/vscode-extension/src/__tests__/host/litePSReadLineHistory.host.ts');
const out=own('prebuilt-native-hosts-02');assert(!fs.existsSync(out));fs.mkdirSync(out);
const {parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
esbuild.build({...parserBundleOptions(repo),metafile:true,absWorkingDir:repo,entryPoints:entries,outdir:out,bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'}).then(result=>{
 check();const drivers=fs.readdirSync(out).filter(name=>name.endsWith('.js')).sort().map(name=>{const raw=fs.readFileSync(path.join(out,name));return{path:path.relative(__dirname,path.join(out,name)).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}});assert.equal(drivers.length,21);
 const parser=Object.keys(result.metafile.inputs).filter(name=>name.replace(/\\/g,'/').includes('node_modules/jsonc-parser/'));assert(parser.some(name=>name.replace(/\\/g,'/').endsWith('jsonc-parser/lib/esm/main.js')));assert(!parser.some(name=>name.replace(/\\/g,'/').includes('/lib/umd/')));
 fs.writeFileSync(own('native-driver-provenance-02.json'),JSON.stringify({status:'BUILT_NOT_RUN_ESM_PARSER_INLINED',observedAt:new Date().toISOString(),compiler:'compiler-07',sourceProofSha256:sha(fs.readFileSync(own('native-source-inputs-03.json'))),inputs:result.metafile.inputs,outputs:result.metafile.outputs,drivers,native06:'NOT_INCLUDED_NOT_RUN'},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'BUILT_NOT_RUN',drivers:21,newHistoryOracles:28,priorAcceptedFamilies:20,native06:'EXCLUDED_NOT_RUN'}));
}).catch(()=>{console.error('F26c native driver build refused; evidence retained.');process.exitCode=1});
