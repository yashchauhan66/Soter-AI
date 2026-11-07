// Evidence-only successors; no native process or behavior gate is launched.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {check,fact,json,own,repo,sha,OUTPUT}=require('./post-full04-contract.cjs');
const gate=require('./current-content-gate04.cjs');
const base=path.relative(repo,__dirname).replace(/\\/g,'/'),TOKEN='__F26A_AFFECTED04_BOUND__';
const pin=entry=>assert.deepEqual(fact(path.join(repo,entry.path)),{path:entry.path,bytes:entry.bytes,sha256:entry.sha256});
const emit=(name,text)=>fs.writeFileSync(own(name),text,{flag:'wx'});
function prepare(){
 const prior=json(own('affected-native-materialization-03.json'));assert.equal(fact(own('affected-native-materialization-03.json')).sha256,'05ff5cb3b95539bee8cd4542784624aa6e768d8c07a6025fdf4a6eea683a139b');assert.equal(prior.outputs.length,26);
 const correction=json(own('affected-pipe-ownership-correction-02.json'));assert.equal(fact(own('affected-pipe-ownership-correction-02.json')).sha256,'eca02522e7c155e7ae5312f55aa868657231d6ad40f94593f5f10e78a76b48fb');pin(correction.helper);
 const rows=prior.outputs.filter(x=>!x.path.endsWith('/affected-native-binding-03.ps1'));assert.equal(rows.length,25);rows.forEach(pin);
 const records=[],outputs=[];
 for(const row of rows){
  let text=fs.readFileSync(path.join(repo,row.path),'utf8');const guard="if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND')";assert.equal(text.split(guard).length,2);text=text.replace(guard,()=>"if('"+TOKEN+"' -cne 'F26A_CURRENT_FACTS_BOUND')");
  const replacements=[['affected-native-binding-03.ps1','affected-native-binding-04.ps1'],['host-current-binding-02.ps1','host-current-binding-03.ps1'],['artifact-binding-01.ps1','artifact-binding-02.ps1'],['vsix-extracted-01/extension','vsix-extracted-02/extension'],['prebuilt-native-hosts-03/','prebuilt-native-hosts-04/'],...rows.map(x=>[path.basename(x.path),path.basename(x.path).replace(/-03\.ps1$/,'-04.ps1')])];
  for(const [from,to] of replacements)text=text.split(from).join(to);
  if(row.path.endsWith('/run-current-affected-suite-03.ps1')){const expected="@('-InspectionName','01')";assert.equal(text.split(expected).length,2);text=text.replace(expected,()=>"@('-InspectionName','02')");}
  const timers=text.match(/(?:TotalSeconds -lt |WaitForExit\()[0-9]+/g)||[],before=fs.readFileSync(path.join(repo,row.path),'utf8').match(/(?:TotalSeconds -lt |WaitForExit\()[0-9]+/g)||[];assert.deepEqual(timers,before);
  assert(!/finally\s*\{\s*\$(?:taskProcess|process)[.]Dispose\(/.test(text));
  const name=path.basename(row.path).replace(/-03\.ps1$/,'-04.template.ps1');assert(name.endsWith('-04.template.ps1'));assert(!fs.existsSync(own(name)));outputs.push({name,text});records.push({source:row,target:{path:base+'/'+name,bytes:Buffer.byteLength(text),sha256:sha(Buffer.from(text))},timeouts:timers});
 }
 const template=fact(own('affected-native-binding-04.template.ps1'));assert(!fs.existsSync(own('affected-native-template-manifest-04.json')));
 outputs.forEach(x=>emit(x.name,x.text));emit('affected-native-template-manifest-04.json',JSON.stringify({status:'PREPARED_UNBOUND_FRESH990_FULL03_ATTEMPT02_REQUIRED',observedAt:new Date().toISOString(),generator:fact(__filename),priorMaterialization:fact(own('affected-native-materialization-03.json')),pipeOwnershipHelper:correction.helper,guard:template,records,limits:'Same25 pipe-safe controls with exact new full/compiler/build/artifact/host bindings. No driver equality assumption or historical PASS transfer; no native execution.'},null,2)+'\n');console.log('Prepared25 unbound current04 controls; no native execution.');
}
function materialize(){
 const checked=check();delete checked.sourceFiles;
 for(const name of ['backend-typecheck-04','backend-tests-04','native-build-04','package-04','content-inspection-02'])gate(name);
 const manifest=json(own('affected-native-template-manifest-04.json'));assert.equal(manifest.status,'PREPARED_UNBOUND_FRESH990_FULL03_ATTEMPT02_REQUIRED');assert.equal(manifest.records.length,25);pin(manifest.generator);pin(manifest.pipeOwnershipHelper);pin(manifest.guard);manifest.records.forEach(row=>{pin(row.source);pin(row.target)});
 const inspection=json(own('vsix-inspection-02.json'));assert.equal(inspection.status,'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED');assert.equal(inspection.entryCount,15);assert.equal(inspection.runtimeCount,4);assert.equal(inspection.machineSettings,82);
 const artifact=fact(path.join(repo,OUTPUT));assert.equal(inspection.sha256,artifact.sha256);
 const provenance=json(own('native-driver-provenance-04.json'));assert.equal(provenance.drivers.length,21);assert.deepEqual(provenance.inputProof,checked.inputProof);assert.deepEqual(provenance.binding,checked.binding);
 for(const row of provenance.drivers)pin({...row,path:base+'/'+row.path});
 const runtimeBindings=inspection.entries.filter(x=>/^extension\/dist\/(extension|local-ai-broker|soterai-mcp-server|pre-commit-client)\.js$/.test(x.path)).map(x=>({name:path.basename(x.path),path:base+'/vsix-extracted-02/'+x.path,bytes:x.bytes,sha256:x.sha256}));assert.equal(runtimeBindings.length,4);runtimeBindings.forEach(x=>pin(x));
 const binding={status:'F26A_FRESH990_FULL_BUILD_ARTIFACT_BOUND_NATIVE_NOT_RUN',feature:'F26a',fileCount:990,sourceProof:{path:checked.inputProof.path,bytes:checked.inputProof.bytes,sha256:checked.inputProof.sha256},postFullBinding:checked.binding,compilerReceipt:checked.compiler.receipt,fullReceipt:checked.full.receipt,driverProvenance:fact(own('native-driver-provenance-04.json')),vsix:artifact,inspection:fact(own('vsix-inspection-02.json')),hostBinding:fact(own('host-current-binding-03.ps1')),artifactBinding:fact(own('artifact-binding-02.ps1')),extensionRoot:base+'/vsix-extracted-02/extension',runtimeBindings,driverBuildReceipt:gate('native-build-04').receipt,packageReceipt:gate('package-04').receipt,backendCompilerReceipt:gate('backend-typecheck-04').receipt,backendTestsReceipt:gate('backend-tests-04').receipt,contentReceipt:gate('content-inspection-02').receipt,limits:'Actual native checks not run. Full03 is current; product fix invalidates historical native coverage.'};
 const bindingText=JSON.stringify(binding,null,2)+'\n',bindingSha=sha(Buffer.from(bindingText));assert(!fs.existsSync(own('affected-native-current-binding-04.json')));
 const outputs=[...manifest.records.map(x=>x.target),manifest.guard].map(row=>{let text=fs.readFileSync(path.join(repo,row.path),'utf8');assert(text.includes(TOKEN));text=text.split(TOKEN).join('F26A_CURRENT_FACTS_BOUND').split('__F26A_AFFECTED04_BINDING_SHA256__').join(bindingSha);assert(!/__F26A_[A-Z0-9_]+__/.test(text));return {name:path.basename(row.path).replace('.template.ps1','.ps1'),text}});
 outputs.forEach(x=>assert(!fs.existsSync(own(x.name))));assert(!fs.existsSync(own('affected-native-materialization-04.json')));
 emit('affected-native-current-binding-04.json',bindingText);outputs.forEach(x=>emit(x.name,x.text));emit('affected-native-materialization-04.json',JSON.stringify({status:'MATERIALIZED_CURRENT990_FULL03_ATTEMPT02_NOT_EXECUTED',observedAt:new Date().toISOString(),manifest:fact(own('affected-native-template-manifest-04.json')),binding:fact(own('affected-native-current-binding-04.json')),outputs:outputs.map(x=>fact(own(x.name))),pipeOwnershipHelper:manifest.pipeOwnershipHelper,syntax:'SEPARATE_PARSE_REQUIRED',nativeExecution:'NOT_RUN'},null,2)+'\n');console.log('Materialized26 fresh bound04 controls only; no native execution.');
}
assert.equal(process.argv.length,3);if(process.argv[2]==='--prepare')prepare();else if(process.argv[2]==='--materialize')materialize();else throw Error('Use explicit --prepare or --materialize.');
