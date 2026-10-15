// Deferred evidence preflight. Root supplies final artifact SHA and exact native
// directory; this authoring step does not execute checks or mutate Git.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/'),parent='f9b0fbc5e688b6a6fd00d40f0bcd7d8888de8828';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const git=(...args)=>cp.execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:repo,maxBuffer:16*1024*1024}).toString().trim().split(/\r?\n/).filter(Boolean);
const expected=process.argv[2],nativeName=process.argv[3],explicitAffected=process.argv[4];
assert.match(expected??'',/^[a-f0-9]{64}$/);assert.match(nativeName??'',/^f08-native-host-[A-Za-z0-9-]+$/);
if(explicitAffected)assert.match(explicitAffected,/^affected-[A-Za-z0-9-]+$/);
assert.equal(git('rev-parse','HEAD')[0],parent);assert.deepEqual(git('diff','--cached','--name-only'),[]);
const inspection=read(path.join(__dirname,'vsix-inspection-01.json')),artifact='packages/soterai-lite/soterai-lite-0.7.0-f08-20261015-attempt01.vsix';
assert.equal(path.resolve(inspection.vsix),path.join(repo,artifact));assert.equal(inspection.sha256,expected);assert.equal(sha(inspection.vsix),expected);
assert.equal(inspection.status,'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED');assert.equal(inspection.entryCount,14);assert.equal(inspection.runtimeCount,3);assert.equal(inspection.forbiddenRuntimeInputs,0);
const runtime=inspection.sourceProvenance.inventory.find(row=>row.name==='extension.js').sha256,inputs=[];
assert.equal(inspection.sourceProvenance.inventory.length,3);
for(const output of inspection.sourceProvenance.inventory){
 assert.equal(sha(path.join(__dirname,'vsix-extracted-01/extension/dist',output.name)),output.sha256);
 for(const input of output.inputs){assert.equal(sha(path.join(repo,input.path)),input.sha256);inputs.push({path:input.path,sha256:input.sha256});}
}
const nativePath=path.join(__dirname,nativeName,'matching-results.json'),native=read(nativePath);
assert.equal(native.passed,13);assert.equal(native.failed,0);assert.equal(native.notRun,0);assert.equal(native.driverFailure,undefined);
assert.equal(native.observations.length,13);assert.ok(native.observations.every(row=>row.status==='PASS'));
assert.equal(native.extensionBundleSha256,runtime);assert.equal(native.currentDeveloperBundleSha256,runtime);assert.equal(native.independence,'LOW');
assert.equal(native.reports.length,3);assert.deepEqual(native.reports.map(row=>row.result.output.status),['PASS','WITHHELD','PASS']);
for(const report of [native.reports[0],native.reports[2]]){
 assert.equal(report.result.output.cases.length,10);assert.ok(report.result.output.cases.every(row=>row.pass===true));assert.equal(report.result.pass,true);
}
assert.equal(native.hostProbeSha256,sha(path.join(__dirname,'prebuilt-host-02/lite-streaming-output-host.js')));
const freeze=read(path.join(__dirname,nativeName,'freeze.json')),execution=path.resolve(freeze.executionEvidenceRoot);
assert.equal(freeze.hostProbeSha256,native.hostProbeSha256);
assert.ok(execution.toLowerCase().startsWith(path.resolve('D:/SoterAI-Lite-test-profiles').toLowerCase()+path.sep));
const nativeSource=path.join(execution,'matching-results.json');assert.equal(sha(nativeSource),sha(nativePath));
const affectedNames=fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()&&row.name.startsWith('affected-')&&fs.existsSync(path.join(__dirname,row.name,'affected-summary-01.json'))).map(row=>row.name);
const affectedName=explicitAffected??(assert.equal(affectedNames.length,1),affectedNames[0]);assert.ok(affectedNames.includes(affectedName));
const affected=read(path.join(__dirname,affectedName,'affected-summary-01.json'));assert.equal(affected.status,'PASS_SCOPED');assert.equal(affected.extensionBundleSha256,runtime);assert.equal(affected.functionalPassed,10);assert.equal(affected.securityCompared,17);assert.equal(affected.changed,0);
const functional=read(affected.functionalResult),security=read(affected.securityResult),comparison=read(path.join(__dirname,affectedName,'security-comparison-01.json'));
assert.equal(functional.extensionBundleSha256,runtime);assert.equal(functional.passed,10);assert.equal(functional.failed,0);assert.equal(functional.observations.length,10);assert.ok(functional.observations.every(row=>row.status==='PASS'));
assert.equal(security.extensionBundleSha256,runtime);assert.equal(security.results.length,17);assert.equal(comparison.changed,0);assert.equal(comparison.comparedRows,17);
assert.equal(security.results.filter(row=>row.status==='BLOCKED_SCOPED').length,8);assert.equal(security.results.filter(row=>row.status==='LEAK_CONFIRMED').length,9);
const countLog=name=>{const text=fs.readFileSync(path.join(__dirname,name+'.txt'),'utf8');const get=key=>{const match=text.match(new RegExp('^# '+key+' (\\d+)$','m'));assert.ok(match);return Number(match[1]);};return{tests:get('tests'),suites:get('suites'),pass:get('pass'),fail:get('fail'),cancelled:get('cancelled'),skip:get('skipped')};};
const focused=countLog('focused-after-02'),full=countLog('full-tests-01');assert.equal(focused.tests,177);assert.equal(focused.pass,177);assert.equal(focused.fail,0);assert.equal(focused.cancelled,0);assert.equal(full.tests,1314);assert.equal(full.pass,1310);assert.equal(full.fail,0);assert.equal(full.cancelled,0);assert.equal(full.skip,4);
const checkNames=['typecheck-01','focused-after-02','full-tests-01','metadata-sync-01','generate-readiness-01','package-01','vsix-inspection-01','host-build-02','native-host-launch-01','affected-hosts-launch-01'];
const checks=checkNames.map(name=>{const row=read(path.join(__dirname,name+'.txt.result.json'));assert.equal(row.exitCode,0);assert.equal(sha(path.join(__dirname,name+'.txt')),row.sha256.toLowerCase());return{name,...row};});
assert.ok(fs.existsSync(path.join(__dirname,'source-review-evidence-adversarial-02.md')),'Retained source review 02 required.');
for(const name of ['commit-f08.ps1','commit-transition-01.ps1','verify-and-advance.cjs','verify-transition-01.cjs'])assert.ok(fs.existsSync(path.join(__dirname,name)),'Complete deferred commit scripts required before freezing the index.');
const queue=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'));assert.equal(queue.activeFeature,'F08');
const sources=['docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md','docs/vscode-extension-readiness.md','packages/soterai-lite/package.json','packages/soterai-lite/README.md','packages/soterai-lite/CHANGELOG.md','packages/vscode-extension/package.json','packages/vscode-extension/README.md',
 'packages/core/src/index.ts','packages/core/src/RegisteredSecretMatcher.ts','packages/core/src/StreamingOutputRedactor.ts',
 'packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts','packages/vscode-extension/src/secret-broker/OutputFilter.ts','packages/vscode-extension/src/secret-broker/OutputSelfTest.ts','packages/vscode-extension/src/secret-broker/runtime.ts','packages/vscode-extension/src/secret-broker/commands.ts',
 'packages/vscode-extension/src/__tests__/streamingOutputRedactor.test.ts','packages/vscode-extension/src/__tests__/streamingOutputRedactor.review.test.ts','packages/vscode-extension/src/__tests__/streamingOutputIntegration.test.ts','packages/vscode-extension/src/__tests__/host/liteStreamingOutput.host.ts'];
const previous='docs/soterai-lite/evidence/20261015-f07-matching-64a72df1/';
sources.push(...['acceptance-preflight-01.txt','acceptance-preflight-01.txt.result.json','f07-byte-verification-launch-01.txt','f07-byte-verification-launch-01.txt.result.json','commit-transition-01.ps1','verify-transition-01.cjs','f07-transition-allowlist-01.txt','f07-transition-commit-01.txt','f07-transition-byte-verification-01.json','f07-transition-verification-launch-01.txt','f07-transition-verification-launch-01.txt.result.json'].map(name=>previous+name));
for(const name of sources)assert.ok(fs.existsSync(path.join(repo,name)),name);
const outNames=['external-phase-evidence-01.json','f08-acceptance-01.json','f08-evidence-index-01.json','f08-commit-allowlist-01.txt'];
for(const name of outNames)assert.ok(!fs.existsSync(path.join(__dirname,name)),'Immutable output already exists: '+name);
// Every acceptance assertion above must pass before any acceptance/ledger write.
const write=(name,value)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('external-phase-evidence-01.json',{status:'PASS_BYTE_IDENTICAL',syntheticOnly:true,profilesRetained:true,sqliteContentsRead:false,entries:[{source:nativeSource,retainedCopy:base+'/'+nativeName+'/matching-results.json',sha256:sha(nativePath),bytes:fs.statSync(nativePath).size}]});
write('f08-acceptance-01.json',{status:'PASS',feature:'F08',observedAt:new Date().toISOString(),parent,completion:'Scoped local acceptance passed; scoped commit and byte verification remain the serial barrier.',
 artifact:{path:artifact,bytes:inspection.bytes,sha256:expected,runtimeSha256:runtime},flag:{name:'soterai.lite.outputRedactor',scope:'machine',mutation:'AVAILABILITY_ONLY'},
 checks:{focused:{...focused,f08:94,f07:83},full,native:{distinct:13,pass:13,path:base+'/'+nativeName+'/matching-results.json',caseOracle:'Production synthetic singleton self-test and scripted native flags; LOW, no independent sink or shell consumer proof.'},functional:{path:path.relative(repo,affected.functionalResult).replaceAll('\\','/'),pass:10,fail:0},security:{path:path.relative(repo,affected.securityResult).replaceAll('\\','/'),scenarios:17,blockedScoped:8,leakConfirmed:9,changed:0}},inputs,commands:checks,
 independence:'LOW',catalog:'44_UNVERIFIED',ratings:'PENDING',review:'Retained same-lineage source-review-evidence-adversarial-02.md; not independent certification.',
 limitations:'Completion-buffered finite byte operations only; no live interactive passthrough or native-shell interception. Original filesystem/history/aliases/independent uploads remain unmanaged. Shell/task/gateway consumers and external tools remain future cards.',
 notTested:['Independent human/vendor review','External AI tools','Native terminal/shell/task interception','Gateway routing','Linux/macOS/remote workspaces','Clean-profile installed-VSIX lifecycle']});
fs.appendFileSync(path.join(repo,'docs/soterai-lite/ledger.md'),'\n## STEP RECEIPT F08 — completion-buffered output sanitization\n\nScoped acceptance PASS; commit/byte verification remains the serial barrier. Focused177PASS (94F08+83F07); full1314tests/1310PASS/0FAIL/0cancel/4SKIP; typecheck01PASS. Finalattempt01 VSIX '+inspection.bytes+'bytes SHA'+expected+', runtime'+runtime+';14entries/3runtimes/no forbidden inputs, all current input hashes rechecked. Native13PASS/output PASS-WITHHELD-PASS uses actual packaged singleton self-test; LOW production oracles, no independent sink/human/shell proof. Functional10PASS/security17unchanged8BLOCKED_SCOPED9LEAK_CONFIRMED.\n\nCompleted finite output is normalized losslessly, terminal rewriting/invalid final UTF8/overflow/withdrawal withhold atomically, recognized registered/provider/entropy matches mask whole nonempty channels. ANSI/OSC, channel isolation and explicit arrival/group views are bounded. This is completion-buffered processing; shell/task/native terminal/gateway integration remains later work. Earlier failures and raw profiles retained; catalog44UNVERIFIED, ratingPENDING, actual-tool/platform/human gates unchanged. No F09 production before verified F08 barrier.\n');
const excluded=new Set(['f08-evidence-index-01.json','f08-commit-allowlist-01.txt']);
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory()){if(entry.name==='extension'||/^(?:vsix-extracted-|prebuilt-host-)/.test(entry.name))continue;walk(file);}else if(!excluded.has(entry.name)&&/\.(?:json|txt|md|ps1|cjs)$/.test(entry.name))sources.push(path.relative(repo,file).replaceAll('\\','/'));}}
walk(__dirname);const unique=[...new Set(sources)].sort();assert.ok(unique.every(name=>!name.includes('/profile/')&&!name.endsWith('results.jsonl')&&!name.includes('.gradle/')&&!name.includes('/dist/')&&!name.endsWith('.vsix')));
write('f08-evidence-index-01.json',{schemaVersion:1,scope:'Explicit F08 source/raw evidence and prior F07 postcommit receipts. Copied runtimes, profiles, compiled bundles, VSIX bytes and unrelated work excluded.',entries:unique.map(name=>({path:name,bytes:fs.statSync(path.join(repo,name)).size,sha256:sha(path.join(repo,name))}))});
const scope=[...sources.filter(name=>!name.startsWith(base+'/')),base],changed=new Set([...git('diff','--name-only','HEAD','--',...scope),...git('ls-files','--others','--exclude-standard','--',...scope)]);
const allow=[...unique,base+'/f08-evidence-index-01.json'].filter(name=>changed.has(name)).sort();assert.ok(allow.includes(base+'/f08-evidence-index-01.json'));
fs.writeFileSync(path.join(__dirname,'f08-commit-allowlist-01.txt'),allow.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS_LOCAL_PENDING_COMMIT',indexedEntries:unique.length,exactChangedCommitPaths:allow.length,artifact:expected,nativeDistinct:13,functional:10,securityComparisonChanges:0}));
