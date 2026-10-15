// Deferred F09 acceptance. Requires a later explicit final-facts bindings JSON.
// Authoring this script neither executes checks nor certifies any pending fact.
const h=require('./f09-evidence-lib.cjs');
const{fs,path,assert,repo,base,bytes,hash,read,relative,inside,own,source,fileFact,bound,git,lines,noOutputs,write,check}=h;
const planFile=own(process.argv[2]??''),plan=read(planFile);
assert.equal(plan.schemaVersion,1);assert.equal(plan.feature,'F09');
const parent='583e4f79e8bbfd2c18a4bbe64c9fbd08d091f2cc';
assert.equal(plan.parentCommit,parent);assert.equal(lines(git('rev-parse','HEAD'))[0],parent);
assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
const artifact='packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix';
assert.equal(plan.artifact.path,artifact);assert.match(plan.artifact.sha256??'',/^[a-f0-9]{64}$/);
const artifactFile=inside(repo,artifact);assert.equal(hash(artifactFile),plan.artifact.sha256);
const inspectionFile=bound(plan.inspection),inspection=read(inspectionFile);
assert.equal(path.resolve(inspection.vsix),artifactFile);assert.equal(inspection.sha256,plan.artifact.sha256);
assert.equal(inspection.status,'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED');assert.equal(inspection.entryCount,14);assert.equal(inspection.runtimeCount,3);
assert.equal(inspection.forbiddenRuntimeInputs,0);assert.equal(inspection.machineSettings,48);assert.equal(inspection.runtimeFlag,'soterai.lite.vaultRuntime');
assert.deepEqual([...inspection.runtimeCommands].sort(),['soterai.configureVaultApp','soterai.runVaultApp','soterai.stopVaultApp','soterai.vaultAppStatus'].sort());
assert.equal(inspection.taskType,'soterai-vault');assert.equal(inspection.debugType,'soterai-vault');
assert.deepEqual(inspection.sourceProvenance.inventory.map(row=>row.name).sort(),['extension.js','local-ai-broker.js','soterai-mcp-server.js'].sort());
const runtime=inspection.sourceProvenance.inventory.find(row=>row.name==='extension.js').sha256,inputs=new Map();
for(const output of inspection.sourceProvenance.inventory){
 const extracted=inside(inspection.extractedExtensionRoot,'dist/'+output.name);assert.equal(hash(extracted),output.sha256);assert.equal(fs.statSync(extracted).size,output.bytes);
 for(const input of output.inputs){const file=inside(repo,input.path);assert.equal(hash(file),input.sha256);assert.equal(fs.statSync(file).size,input.bytes);if(inputs.has(input.path))assert.equal(inputs.get(input.path).sha256,input.sha256);inputs.set(input.path,{path:input.path,bytes:input.bytes,sha256:input.sha256});}
}
assert.ok(Array.isArray(plan.checks));const requiredRoles=['typecheck','focused','full','metadata','readiness','package','inspection','hostBuild','native','affected'];
assert.deepEqual(plan.checks.map(row=>row.role).sort(),requiredRoles.sort());
for(const role of ['focused','full'])assert.equal(plan.checks.find(row=>row.role===role).kind,'tap');
const checks=plan.checks.map(check),focused=checks.find(row=>row.role==='focused').counts,full=checks.find(row=>row.role==='full').counts;
const nativeFile=bound(plan.native.result),native=read(nativeFile),probeFile=bound(plan.native.probe);
const expectedNative=Array.from({length:12},(_,index)=>'F09-H'+String(index+1).padStart(2,'0'));
assert.deepEqual(native.observations.map(row=>row.id),expectedNative);assert.equal(native.passed,12);assert.equal(native.failed,0);assert.equal(native.notRun,0);
assert.ok(native.observations.every(row=>row.status==='PASS'));assert.equal(native.driverFailure,undefined);assert.equal(native.syntheticOnly,true);assert.equal(native.independence,'LOW');
assert.equal(native.extensionBundleSha256,runtime);assert.equal(native.currentDeveloperBundleSha256,runtime);assert.equal(native.hostProbeSha256,hash(probeFile));
assert.equal(native.sourceDocumentCalls,0);assert.equal(native.sourceDocumentEvents,0);assert.ok(native.secretStorageApi.keyGets>0&&native.secretStorageApi.keyStores>0);
assert.ok(native.taskRuns.length>0&&native.taskRuns.every(row=>row.closed===true&&row.taskEnded===true&&row.safe===true));
assert.ok(native.debugRuns.length>0&&native.debugRuns.every(row=>row.terminated===true&&row.safe===true));
const freeze=read(path.join(path.dirname(nativeFile),'freeze.json')),execution=path.resolve(freeze.executionEvidenceRoot);
assert.ok(execution.toLowerCase().startsWith(path.resolve('D:/SoterAI-Lite-test-profiles').toLowerCase()+path.sep));
assert.equal(freeze.hostProbeSha256,native.hostProbeSha256);
const nativeSource=path.join(execution,'runtime-results.json');assert.equal(hash(nativeSource),hash(nativeFile));
const affectedFile=bound(plan.affected.summary),affected=read(affectedFile);
const functionalFile=bound(plan.affected.functional),securityFile=bound(plan.affected.security),comparisonFile=bound(plan.affected.comparison);
assert.equal(affected.status,'PASS_SCOPED');assert.equal(affected.extensionBundleSha256,runtime);assert.equal(affected.functionalPassed,10);assert.equal(affected.securityCompared,17);assert.equal(affected.changed,0);
assert.equal(path.resolve(affected.functionalResult),functionalFile);assert.equal(path.resolve(affected.securityResult),securityFile);
const functional=read(functionalFile),security=read(securityFile),comparison=read(comparisonFile);
assert.equal(functional.extensionBundleSha256,runtime);assert.equal(functional.passed,10);assert.equal(functional.failed,0);
assert.equal(functional.observations.length,10);assert.ok(functional.observations.every(row=>row.status==='PASS'));
assert.equal(security.extensionBundleSha256,runtime);assert.equal(security.results.length,17);assert.equal(comparison.changed,0);assert.equal(comparison.comparedRows,17);
assert.equal(security.results.filter(row=>row.status==='BLOCKED_SCOPED').length,8);assert.equal(security.results.filter(row=>row.status==='LEAK_CONFIRMED').length,9);
assert.ok(Array.isArray(plan.reviews)&&plan.reviews.length>0);assert.equal(plan.reviewDisposition,'NO_OPEN_SCOPED_BLOCKERS');
const reviews=plan.reviews.map(spec=>fileFact(bound(spec)));
assert.ok(Array.isArray(plan.sourcePaths)&&plan.sourcePaths.length>0&&plan.sourcePaths.length<=96);
const sources=plan.sourcePaths.map(name=>relative(source(name)));
for(const mandatory of ['docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md','packages/vscode-extension/package.json','packages/soterai-lite/package.json'])assert.ok(sources.includes(mandatory));
const queue=read(inside(repo,'docs/soterai-lite/FEATURE-QUEUE.json'));assert.equal(queue.activeFeature,'F09');
const outputs=['external-phase-evidence-01.json','f09-acceptance-01.json','f09-evidence-index-01.json','f09-commit-allowlist-01.txt'];noOutputs(outputs);
const ledgerPath=inside(repo,'docs/soterai-lite/ledger.md');
write('external-phase-evidence-01.json',{status:'PASS_BYTE_IDENTICAL',syntheticOnly:true,profilesRetained:true,sqliteContentsRead:false,
 entries:[{source:nativeSource,retainedCopy:relative(nativeFile),sha256:hash(nativeFile),bytes:fs.statSync(nativeFile).size}]});
write('f09-acceptance-01.json',{status:'PASS',feature:'F09',observedAt:new Date().toISOString(),parent,
 completion:'Scoped local acceptance passed; exact scoped source commit and byte verification remain the serial barrier.',
 artifact:{path:artifact,bytes:fs.statSync(artifactFile).size,sha256:hash(artifactFile),runtimeSha256:runtime},
 flag:{name:'soterai.lite.vaultRuntime',scope:'machine',mutation:'AVAILABILITY_ONLY'},
 checks:{focused,full,native:{distinct:12,pass:12,path:relative(nativeFile),probeSha256:native.hostProbeSha256,independence:'LOW'},
 functional:{path:relative(functionalFile),pass:10,fail:0},security:{path:relative(securityFile),scenarios:17,blockedScoped:8,leakConfirmed:9,changed:0}},
 inputs:[...inputs.values()],commands:checks,reviews,reviewDisposition:{value:plan.reviewDisposition,authority:'Explicit final root binding; same lineage LOW'},
 bindings:fileFact(planFile),independence:'LOW',catalog:'44_UNVERIFIED',ratings:'PENDING',
 limitations:'Owner-approved finite Node app/CustomExecution task/inline debug lifecycle only. Selected app can inspect, print, write or transmit injected values. No OS confinement, source-level debugger, arbitrary terminal/shell interception, independent upload or gateway claim. STOP acknowledgement is not exit proof. Native isolated developer-window checks do not certify installed-VSIX lifecycle or human approval.',
 notTested:['Independent human/vendor review','External AI tools','Native shells and arbitrary terminals','Gateway routing','Linux/macOS/remote workspaces','Clean-profile installed-VSIX lifecycle']});
fs.appendFileSync(ledgerPath,'\n## STEP RECEIPT F09 - scoped vault app/task/debug acceptance\n\nScoped local acceptance PASS; source commit/byte verification remain the serial barrier. Focused '+focused.tests+' tests/'+focused.pass+' PASS/'+focused.skipped+' SKIP; full '+full.tests+' tests/'+full.pass+' PASS/'+full.skipped+' SKIP; zero failures/cancellations. Exact attempt01 VSIX '+hash(artifactFile)+' ('+fs.statSync(artifactFile).size+' bytes), runtime '+runtime+'. Native12PASS, functional10PASS, security17 unchanged (8 BLOCKED_SCOPED/9 LEAK_CONFIRMED). Scripted/native/mocked evidence LOW. Owned finite Node application, real task and lifecycle-only debug session; selected app can transmit its values and no source-level debugger/confinement is claimed. All prior failures/evidence retained. Catalog44UNVERIFIED/ratingPENDING; no F10 production before the verified serial barrier.\n');
const excluded=new Set(['f09-evidence-index-01.json','f09-commit-allowlist-01.txt']);
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory()){if(['extension','extensions','profile','node_modules','dist','builds','.git'].includes(entry.name)||/^(?:vsix-extracted-|prebuilt-host-)/.test(entry.name))continue;walk(file);}else if(!excluded.has(entry.name)&&/\.(?:json|txt|md|ps1|cjs|mjs)$/.test(entry.name))sources.push(relative(file));}}
walk(__dirname);const unique=[...new Set(sources)].sort();
assert.ok(unique.every(name=>!name.includes('/profile/')&&!name.includes('/dist/')&&!name.endsWith('.vsix')&&!name.endsWith('.js')));
write('f09-evidence-index-01.json',{schemaVersion:1,scope:'Explicit F09 source and retained raw evidence. No copied runtimes, compiled host bundles, profiles, VSIX bytes or unrelated source.',entries:unique.map(name=>fileFact(inside(repo,name)))});
const scope=[...plan.sourcePaths,base],changed=new Set([...lines(git('diff','--name-only','HEAD','--',...scope)),...lines(git('ls-files','--others','--exclude-standard','--',...scope))]);
const allow=[...unique,base+'/f09-evidence-index-01.json'].filter(name=>changed.has(name)).sort();assert.ok(allow.includes(base+'/f09-evidence-index-01.json'));
fs.writeFileSync(own('f09-commit-allowlist-01.txt'),allow.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_LOCAL_PENDING_COMMIT',indexedEntries:unique.length,exactChangedCommitPaths:allow.length,artifact:hash(artifactFile),focused,full,nativeDistinct:12,functional:10,securityComparisonChanges:0}));