'use strict';
// Supplementary read-only verification. Existing evidence is never rewritten;
// only a successful, new acceptance03 record is created. No child/Git command.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs');
assert.equal(process.platform,'win32','Exact Windows evidence paths are required.');
require('./check-inputs-03.cjs');
const own=name=>e.base+'/'+name,abs=name=>path.resolve(e.repo,name),read=name=>e.read(own(name));
const samePath=(a,b)=>{assert.equal(typeof a,'string');assert.equal(typeof b,'string');assert.equal(path.resolve(a).toLowerCase(),path.resolve(b).toLowerCase());};
function relativeInside(file,root=e.repo){const name=path.relative(root,path.resolve(file));assert(name&&!name.startsWith('..')&&!path.isAbsolute(name),'Evidence path escaped its fixed root.');return name.replaceAll('\\','/');}
function current(fact){assert.deepEqual(e.fact(fact.path),fact);return fact;}
function receipt(rawPath){const raw=e.fact(rawPath),record=e.read(rawPath+'.result.json');assert.equal(record.exitCode,0,rawPath);assert.equal(record.sha256.toLowerCase(),raw.sha256,rawPath);samePath(record.output,abs(rawPath));return {raw,receipt:e.fact(rawPath+'.result.json'),exitCode:0};}
function ordinaryAbsolute(file){
 assert(path.isAbsolute(file));const absolute=path.resolve(file),root=path.parse(absolute).root;
 let cursor=root;const parts=absolute.slice(root.length).split(path.sep).filter(Boolean);
 const rootStat=fs.lstatSync(root);assert(rootStat.isDirectory()&&!rootStat.isSymbolicLink());
 for(let i=0;i<parts.length;i++){cursor=path.join(cursor,parts[i]);const stat=fs.lstatSync(cursor);assert(!stat.isSymbolicLink(),'Owned evidence alias refused.');samePath(fs.realpathSync(cursor),cursor);if(i<parts.length-1)assert(stat.isDirectory());else assert(stat.isFile()&&stat.nlink===1&&stat.size<=4*1024*1024);}
 const bytes=fs.readFileSync(absolute);return {path:absolute,bytes:bytes.length,sha256:e.sha(bytes)};
}
const priorPath=own('f23-acceptance-02.json'),prior=e.read(priorPath);
assert.equal(prior.status,'PASS_SCOPED_REQUIRED_F23_GATES_BYTE_BARRIERS_PENDING');assert.equal(prior.feature,'F23');
current(prior.artifact);const artifactPath=abs(prior.artifact.path),frontend=prior.frontendSha256;
assert.equal(prior.artifact.sha256,'d35a4ed86140054ca258fa65d1079bc1bd3ff0b48e97fcdd99b263a0cfed5999');
assert.equal(frontend,'7b61247bd80b789e76e84f80848d4a592d20c177734b6d93a5a32b667eab7503');
for(const gate of prior.gates){current(gate.raw);current(gate.receipt);assert.equal(gate.exit,0);receipt(gate.raw.path);}
current(prior.content);current(prior.affected);
const inspection=read('vsix-inspection-01.json'),host=read('host-version-review-02.json');
assert.equal(host.currentHost.version,'1.143.1');const codeSha=host.currentHost.executable.sha256;
const runtimes=inspection.sourceProvenance.inventory;assert.equal(runtimes.length,3);
assert.deepEqual(runtimes.map(row=>row.name).sort(),['extension.js','local-ai-broker.js','soterai-mcp-server.js']);
for(const runtime of runtimes){const fact=e.fact(own('vsix-extracted-01/extension/dist/'+runtime.name));assert.equal(fact.sha256,runtime.sha256);assert.equal(fact.bytes,runtime.bytes);}
assert.equal(runtimes.find(row=>row.name==='extension.js').sha256,frontend);

const expectedAffected=['affected-mcp-run-01','affected-editor-run-01','affected-ci-run-01','affected-service-account-run-01','affected-registry-run-01','affected-terraform-run-01','affected-container-run-01','affected-source-run-01','affected-hygiene-run-01','affected-vault-run-01','retained-native-run-01','affected-hosts-run-01'];
const affected=read('affected-suite-summary-01.json');assert.equal(affected.status,'PASS_SCOPED');assert.equal(affected.vsixSha256,prior.artifact.sha256);assert.equal(affected.extensionSha256,frontend);
assert.deepEqual(affected.runs.map(row=>row.name).sort(),expectedAffected.slice().sort());
const affectedReceipts=affected.runs.map(row=>{const record=receipt(own(row.name+'.txt'));samePath(row.output,abs(record.raw.path));assert.equal(row.sha256.toLowerCase(),record.raw.sha256);return {name:row.name,...record};});

const families=[
 ['f23-history-native-20261023T132815Z-8a1e4b06',{primary:21,restart:4}],
 ['f23-mcp-native-20261023T132956Z-6a2e0dec',{primary:21,restart:4}],
 ['f23-affected-editor-20261023T133120Z-a4655130',{primary:21,restart:4}],
 ['f23-affected-ci-20261023T133249Z-61a16b06',{primary:21,restart:4}],
 ['f23-affected-service-account-20261023T133411Z-b3273fac',{primary:21,restart:4}],
 ['f23-affected-registry-20261023T133548Z-c88f77d8',{primary:21,restart:4}],
 ['f23-affected-terraform-20261023T133711Z-36a5ee76',{primary:21,restart:4}],
 ['f23-affected-container-20261023T133833Z-f9213e90',{primary:21,restart:4}],
 ['f23-affected-source-20261023T133958Z-84625624',{primary:18,restart:3}],
 ['f23-affected-hygiene-20261023T134113Z-29998d6d',{primary:18,restart:3}],
 ['f23-affected-vault-20261023T134228Z-cbd1bfbc',{save:6,reload:4}],
 ['f23-retained-native-20261023T134339Z-4be0a38d',{primary:103,restart:3}],
];
assert.deepEqual(prior.nativeSummaries.map(row=>row.path).sort(),families.map(([name])=>own(name+'/summary.json')).sort());
const snapshotIndex=read('actual-native-execution-snapshots-01.json');assert.equal(snapshotIndex.status,'EXACT_ACTUAL_EXECUTED_FIXTURE_BYTES');assert.equal(snapshotIndex.records.length,41);
const snapshots=new Map();for(const row of snapshotIndex.records){assert(!snapshots.has(row.path));snapshots.set(row.path,row);const fact=e.fact(row.path);assert.equal(fact.sha256,row.sha256);assert.equal(fact.bytes,row.bytes);}
const usedSnapshots=new Set(),runtimeBindings=[],native=[],failedRetained=[];
function verifyFreeze(name){
 const freeze=read(name+'/freeze.json'),ownedRoot=path.join('D:\\SoterAI-Lite-test-profiles',name),extension=path.join(ownedRoot,'extension');
 samePath(freeze.executionEvidenceRoot,ownedRoot);samePath(freeze.executionExtension,extension);samePath(freeze.profile,path.join(ownedRoot,'profile'));samePath(freeze.workspace,path.join(ownedRoot,'workspace'));
 samePath(freeze.sourceExtension,abs(own('vsix-extracted-01/extension')));samePath(freeze.exactVsix,artifactPath);
 assert.equal(freeze.syntheticOnly,true);assert.equal(freeze.vsixSha256,prior.artifact.sha256);assert.equal(freeze.extensionBundleSha256,frontend);assert.equal(freeze.codeProductVersion,'1.143.1');assert.equal(freeze.codeExecutableSha256,codeSha);
 for(const [relative,expected] of [['package.json',freeze.fixtureManifestSha256],['dist-test/native-bootstrap.cjs',freeze.bootstrapSha256],['dist-test/host/index.js',freeze.hostProbeSha256]]){
  const key=own('actual-native-execution-snapshots-01/'+name+'/'+relative),row=snapshots.get(key);assert(row,'Missing exact executed fixture snapshot');
  const source=path.join(extension,...relative.split('/'));samePath(row.source,source);const actual=ordinaryAbsolute(source);
  assert.equal(row.sha256,expected);assert.equal(actual.sha256,row.sha256);assert.equal(actual.bytes,row.bytes);usedSnapshots.add(key);
 }
 assert.equal(freeze.runtimeBindings.length,3);assert.deepEqual(freeze.runtimeBindings.map(row=>row.name).sort(),runtimes.map(row=>row.name).sort());
 for(const binding of freeze.runtimeBindings){const runtime=runtimes.find(row=>row.name===binding.name);samePath(binding.source,abs(own('vsix-extracted-01/extension/dist/'+binding.name)));samePath(binding.execution,path.join(extension,'dist',binding.name));assert.equal(binding.sha256,runtime.sha256);assert.equal(binding.bytes,runtime.bytes);const actual=ordinaryAbsolute(binding.execution);assert.equal(actual.sha256,runtime.sha256);assert.equal(actual.bytes,runtime.bytes);runtimeBindings.push(actual);}
 return {freeze,ownedRoot,extension,record:e.fact(own(name+'/freeze.json'))};
}
function closure(name,phase){const file=own(name+'/'+phase+'-owned-editor-close.json'),value=e.read(file);assert.equal(value.observedExit,true);assert.equal(value.exitCode,0);assert.equal(value.stdoutEOF,true);assert.equal(value.stderrEOF,true);assert.equal(value.signalsRequested,0);return e.fact(file);}
let phaseCount=0,nativeChecks=0,historyChildren=0;
for(const [name,expected] of families){
 const checked=verifyFreeze(name),summary=read(name+'/summary.json'),total=Object.values(expected).reduce((sum,count)=>sum+count,0);
 assert.equal(summary.status,'PASS_SCOPED');assert.equal(summary.vsixSha256,prior.artifact.sha256);assert.equal(summary.extensionBundleSha256,frontend);assert.equal(summary.nativeChecks,total);assert.equal(summary.independence,'LOW');
 assert.deepEqual(summary.phases.map(row=>row.phase),Object.keys(expected));assert.deepEqual(checked.freeze.phases,Object.keys(expected));
 assert.equal(prior.nativeSummaries.find(row=>row.path===own(name+'/summary.json')).checks,total);
 const phases=[];
 for(const row of summary.phases){
  const relative=own(name+'/'+row.phase+'-results.json'),fact=e.fact(relative),result=e.read(relative),count=expected[row.phase];
  assert.equal(fact.sha256,row.sha256.toLowerCase());assert.equal(row.passed,count);samePath(row.result,path.join(checked.ownedRoot,row.phase+'-results.json'));
  const actual=ordinaryAbsolute(row.result);assert.equal(actual.sha256,fact.sha256);assert.equal(actual.bytes,fact.bytes);
  assert.equal(result.schemaVersion,1);assert.equal(result.phase,row.phase);assert.equal(result.syntheticOnly,true);assert.equal(result.hostVersion,'1.143.1');
  assert.equal(result.extensionBundleSha256,frontend);assert.equal(result.currentDeveloperBundleSha256,frontend);assert.equal(result.hostProbeSha256,checked.freeze.hostProbeSha256);
  assert.equal(result.passed,count);assert.equal(result.failed,0);assert.equal(result.notRun,0);assert.equal(result.observations.length,count);assert(result.observations.every(item=>item.status==='PASS'));
  assert.equal(new Set(result.observations.map(item=>item.id)).size,count);assert.equal(result.sourceDocumentCalls,0);assert.equal(result.sourceDocumentEvents,0);assert.equal(result.independence,'LOW');
  if(name.startsWith('f23-history-native-')){
   assert.equal(result.directHistoryBodyReads,0);assert.equal(result.processSignalsRequested,0);assert(Array.isArray(result.children)&&result.children.length>0);
   for(const child of result.children){assert.equal(child.closed,true);assert.equal(child.code,0);assert.equal(child.signal,null);assert.equal(child.stdoutEOF,true);assert.equal(child.stderrEOF,true);assert.equal(child.spawnFailed,false);assert.equal(child.streamError,false);assert.equal(child.overflow,false);assert.equal(child.signalsRequested,0);assert.equal(child.invalidInput,false);}
   historyChildren+=result.children.length;
  }
  if(name.startsWith('f23-retained-native-'))for(const child of result.childRuns){assert.equal(child.closed,true);assert.equal(child.stdoutEOF,true);assert.equal(child.stderrEOF,true);assert.equal(child.safe,true);}
  phases.push({phase:row.phase,passed:count,result:fact,actual,closure:closure(name,row.phase)});phaseCount++;
 }
 nativeChecks+=total;native.push({name,checks:total,freeze:checked.record,summary:e.fact(own(name+'/summary.json')),phases});
}
assert.equal(native.length,12);assert.equal(phaseCount,24);assert.equal(nativeChecks,358);assert.equal(historyChildren,51);

// The failed first history attempt is retained and snapshot-verified, but is
// deliberately outside every successful-family/phase/check total above.
const failedName='f23-history-native-20261023T131450Z-89d49373',failed=verifyFreeze(failedName),failedResult=read(failedName+'/primary-results.json');
assert(!prior.nativeSummaries.some(row=>row.path===own(failedName+'/summary.json')));assert.equal(failedResult.syntheticOnly,true);assert.equal(failedResult.passed,18);assert.equal(failedResult.failed,3);assert.equal(failedResult.notRun,0);
assert.equal(failedResult.extensionBundleSha256,frontend);assert.equal(failedResult.hostProbeSha256,failed.freeze.hostProbeSha256);
failedRetained.push({name:failedName,status:'RETAINED_FAILURE_NOT_COUNTED_AS_PASS',freeze:failed.record,result:e.fact(own(failedName+'/primary-results.json')),passed:18,failed:3,closure:closure(failedName,'primary')});

const affectedName='affected-20261023T134554Z-ef1507020ff04d749d4e5b34ab1813a7',affectedRoot=own(affectedName),comparison=e.read(affectedRoot+'/security-comparison-01.json'),affectedFreeze=e.read(affectedRoot+'/freeze.json'),affectedSummary=e.read(affectedRoot+'/affected-summary-01.json');
assert.equal(affectedSummary.status,'PASS_SCOPED');assert.equal(affectedSummary.functionalPassed,10);assert.equal(affectedSummary.securityCompared,17);assert.equal(affectedSummary.changed,0);assert.equal(affectedSummary.vsixSha256,prior.artifact.sha256);assert.equal(affectedSummary.extensionBundleSha256,frontend);assert.equal(affectedSummary.securityResiduals,'8 BLOCKED_SCOPED;9 LEAK_CONFIRMED');samePath(affectedSummary.vsixPath,artifactPath);
assert.equal(affectedFreeze.syntheticOnly,true);assert.equal(affectedFreeze.vsixSha256,prior.artifact.sha256);assert.equal(affectedFreeze.extensionBundleSha256,frontend);assert.equal(affectedFreeze.codeSha256,codeSha);
const functionalReceipt=receipt(affectedRoot+'/functional-launch-01.txt'),securityReceipt=receipt(affectedRoot+'/security-launch-01.txt');
const functionalRel=relativeInside(affectedSummary.functionalResult,abs(affectedRoot));assert.match(functionalRel,/^functional\/privacy-[A-Za-z0-9-]+\/functional-results\.json$/);
const securityRel=relativeInside(affectedSummary.securityResult,abs(affectedRoot));assert.match(securityRel,/^security\/host-[A-Za-z0-9-]+\/live-host\.json$/);
const functionalPath=affectedRoot+'/'+functionalRel,securityPath=affectedRoot+'/'+securityRel,functional=e.read(functionalPath),security=e.read(securityPath);
assert.equal(functional.syntheticOnly,true);assert.equal(functional.hostVersion,'1.143.1');assert.equal(functional.extensionBundleSha256,frontend);assert.equal(functional.passed,10);assert.equal(functional.failed,0);assert.equal(functional.observations.length,10);assert(functional.observations.every(row=>row.status==='PASS'));assert.equal(new Set(functional.observations.map(row=>row.id)).size,10);
assert.equal(security.syntheticOnly,true);assert.equal(security.host,'1.143.1');assert.equal(security.extensionBundleSha256,frontend);assert.equal(security.liveModelContacted,false);assert.equal(security.results.length,17);assert.equal(new Set(security.results.map(row=>row.attack)).size,17);
assert.equal(comparison.status,'PASS_NO_REGRESSION');assert.equal(comparison.comparedRows,17);assert.equal(comparison.changed,0);assert.equal(comparison.extensionBundleSha256,frontend);assert.equal(comparison.rows.length,17);assert.equal(new Set(comparison.rows.map(row=>row.attack)).size,17);
const residuals={BLOCKED_SCOPED:0,LEAK_CONFIRMED:0};
for(const row of comparison.rows){assert.equal(row.current,row.previous);assert(Object.hasOwn(residuals,row.current));residuals[row.current]++;const matches=security.results.filter(item=>item.attack===row.attack);assert.equal(matches.length,1);assert.equal(matches[0].status,row.current);}
assert.deepEqual(residuals,{BLOCKED_SCOPED:8,LEAK_CONFIRMED:9});
const baselineRelative=relativeInside(affectedFreeze.baselinePath);assert.equal(e.fact(baselineRelative).sha256,affectedFreeze.baselineSha256);assert.equal(comparison.baselineSha256,affectedFreeze.baselineSha256);
const baseline=e.read(baselineRelative);assert.equal(baseline.rows.length,17);for(const row of comparison.rows){const old=baseline.rows.filter(item=>item.attack===row.attack);assert.equal(old.length,1);assert.equal(old[0].current,row.previous);}
const functionalFreezePath=path.posix.dirname(functionalPath)+'/freeze.json',functionalFreeze=e.read(functionalFreezePath),securityLaunchPath=path.posix.dirname(securityPath)+'/launch.json',securityLaunch=e.read(securityLaunchPath);
assert.equal(functionalFreeze.syntheticOnly,true);assert.equal(functionalFreeze.vsixSha256,prior.artifact.sha256);assert.equal(functionalFreeze.extensionBundleSha256,frontend);assert.equal(functionalFreeze.codeSha256,codeSha);assert.equal(functionalFreeze.hostTestsSha256,affectedFreeze.functionalHostSha256);
assert.equal(securityLaunch.vsixSha256,prior.artifact.sha256);assert.equal(securityLaunch.extensionBundleSha256,frontend);assert.equal(securityLaunch.codeSha256,codeSha);assert.equal(securityLaunch.hostProbeSha256,affectedFreeze.securityHostSha256);assert.equal(security.hostProbeSha256,affectedFreeze.securityHostSha256);
const functionalDriver=relativeInside(path.join(functionalFreeze.extensionPath,'dist-test','host','index.js'),abs(affectedRoot)),securityDriver=path.posix.dirname(securityPath)+'/security-review-host.js';
assert.equal(e.fact(affectedRoot+'/'+functionalDriver).sha256,affectedFreeze.functionalHostSha256);assert.equal(e.fact(securityDriver).sha256,affectedFreeze.securityHostSha256);
for(const [name,original,expected] of [['functional10-driver.js','docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/privacy-host.js',affectedFreeze.functionalHostSha256],['security17-driver.js','docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/security-host.js',affectedFreeze.securityHostSha256]]){
 const key=own('actual-native-execution-snapshots-01/'+name),row=snapshots.get(key);assert(row);assert.equal(row.source,original);assert.equal(row.sha256,expected);assert.equal(e.fact(original).sha256,expected);assert.equal(e.fact(original).bytes,row.bytes);usedSnapshots.add(key);
}
assert.equal(usedSnapshots.size,41);assert.deepEqual([...usedSnapshots].sort(),[...snapshots.keys()].sort());
const durable=[];for(const kind of ['serial','native']){const file=own('durable-'+kind+'-exit-02.json'),value=e.read(file);assert.equal(value.status,'PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS');assert.equal(value.innerExitCode,0);assert.equal(value.runnerAbsent,true);assert.equal(value.wrapperExitObserved,false);assert.equal(value.wrapperExitCode,null);assert.equal(value.signalsRequested,0);assert.equal(value.streams.length,2);for(const stream of value.streams){const rel=relativeInside(stream.path);assert(rel.startsWith(e.base+'/durable-'+kind+'-'));const fact=e.fact(rel);assert.equal(fact.bytes,stream.bytes);assert.equal(fact.sha256,stream.sha256);}durable.push(e.fact(file));}
const report={status:'PASS_EXACT_F23_ACCEPTANCE_BINDINGS',priorAcceptance:e.fact(priorPath),inputBinding:e.fact(own('source-inputs-03.json')),hostReview:e.fact(own('host-version-review-02.json')),affectedReceipts,native,failedRetained,
 totals:{successfulNativeFamilies:12,successfulNativePhases:24,successfulNativeChecks:358,historyChildrenObservedClosed:51,functionalPassed:10,securityCompared:17,securityResiduals:residuals,snapshotFiles:41},runtimeBindings,
 functionalSecurity:{freeze:e.fact(affectedRoot+'/freeze.json'),summary:e.fact(affectedRoot+'/affected-summary-01.json'),functionalReceipt,securityReceipt,functional:e.fact(functionalPath),functionalFreeze:e.fact(functionalFreezePath),security:e.fact(securityPath),securityLaunch:e.fact(securityLaunchPath),comparison:e.fact(affectedRoot+'/security-comparison-01.json'),baseline:e.fact(baselineRelative),functionalExecutedDriver:e.fact(affectedRoot+'/'+functionalDriver),securityExecutedDriver:e.fact(securityDriver)},
 snapshots:e.fact(own('actual-native-execution-snapshots-01.json')),durable,independence:'LOW',scope:'Supplementary exact raw receipt, phase/count/freeze/runtime, canonical owned execution snapshot and functional/security binding checks only. Earlier failed history18PASS3FAIL remains failure and is excluded from successful totals. No new test execution, Git operation, product edit, rating or independent/human claim.',time:new Date().toISOString()};
const output={...prior,bindingVerification:report};fs.writeFileSync(path.join(__dirname,'f23-acceptance-03.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,nativeFamilies:12,phases:24,nativeChecks:358,snapshots:41,artifact:prior.artifact.sha256,earlierFailureRetained:true}));
