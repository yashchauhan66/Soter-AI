const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const C=require('./current-admission-01.cjs'),{repo,read,fact,sha,own}=C;
(async()=>{
 const binding=await C.guard();
 for(const name of ['native-typecheck-08','install-diagnostics-component-07','diagnostic-delegation-08'])assert.equal(read(own(name+'.txt.result.json')).exitCode,0);
 const out=own('prebuilt-native-hosts-07');assert(!fs.existsSync(out));fs.mkdirSync(out);
 const parent=read(own('native-driver-provenance-02.json'));
 for(const row of parent.drivers){if(row.path.endsWith('/lite-precommit-guard-host.js'))continue;assert.equal(sha(fs.readFileSync(own(row.path))),row.sha256);fs.copyFileSync(own(row.path),path.join(out,path.basename(row.path)),fs.constants.COPYFILE_EXCL);}
 const source=own('f26a-install-diagnostics-08.host.ts'),{parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const result=await esbuild.build({...parserBundleOptions(repo),metafile:true,absWorkingDir:repo,entryPoints:{'lite-precommit-guard-host':source},outdir:out,bundle:true,platform:'node',format:'cjs',external:['vscode'],tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),sourcemap:false,logLevel:'warning'});
 assert.equal(Object.keys(result.metafile.inputs).length,2);assert(!Object.keys(result.metafile.inputs).some(n=>/node_modules|phase2|vscode-stub/.test(n)));
 const drivers=fs.readdirSync(out).filter(n=>n.endsWith('.js')).sort().map(n=>({...fact(path.join(out,n)),path:'prebuilt-native-hosts-07/'+n}));assert.equal(drivers.length,25);
 const selected=drivers.find(n=>n.path.endsWith('/lite-precommit-guard-host.js'));
 const provenance={...parent,observedAt:new Date().toISOString(),native06:'CONSUMED_FAILED_NOT_RETRIED',native07:'NOT_AUTHORIZED_NOT_RUN',diagnosticOnly:true,parentProvenance:fact(own('native-driver-provenance-02.json')),freshPrecommitDriver:selected,reusedExactCurrentDrivers:24,sourceInputs:Object.keys(result.metafile.inputs).map(n=>fact(path.resolve(repo,n))),drivers,transform:fact(own('diagnostic-transform-08.json')),componentEvidence:['native-typecheck-08','install-diagnostics-component-07','diagnostic-delegation-08'].map(n=>fact(own(n+'.txt.result.json')))};
 await C.guard();fs.writeFileSync(own('native-driver-provenance-07.json'),JSON.stringify(provenance,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'DIAGNOSTIC07_BUILT_NOT_AUTHORIZED_NOT_RUN',driver:selected,sourceCount:binding.fileCount,originalCallbacks:34,unchangedOtherDrivers:24}));
})().catch(e=>{console.error(e);process.exitCode=1;});
