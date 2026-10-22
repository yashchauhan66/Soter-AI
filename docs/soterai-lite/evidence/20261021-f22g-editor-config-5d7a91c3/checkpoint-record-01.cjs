'use strict';
// Custody checkpoint only. This deliberately cannot produce feature acceptance.
const h=require('./evidence-lib-01.cjs');
const {fs,path,assert,repo,base,hash,read,own,fact,write,git,lines,current,receipt,tap}=h;
const parent='91f5820f337f00ad4da89ab9b8dcc9975f8a13a8';
assert.equal(lines(git('rev-parse','HEAD'))[0],parent);
assert.deepEqual(lines(git('diff','--cached','--name-only')),[]);
const queue=read(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'));
const card=queue.features.find(row=>row.id==='F22'),item=card?.subcards.find(row=>row.id==='F22g');
assert.equal(queue.activeFeature,'F22');assert.equal(card.activeSubcard,'F22g');
assert(['ACTIVE','INCOMPLETE'].includes(item?.status),'A checkpoint must leave F22g unfinished.');
assert.notEqual(card.subcards.find(row=>row.id==='F22h')?.status,'ACTIVE');
assert(!fs.existsSync(own('f22g-acceptance-01.json')),'Do not conflate checkpoint with acceptance.');
const progress=read(own('f22g-progress-03.json'));assert.equal(progress.parent,parent);assert.equal(progress.records.length,20);
for(const row of progress.records){current(row);const snapshot=fact(own(row.snapshot));assert.equal(snapshot.sha256,row.sha256);assert.equal(snapshot.bytes,row.bytes);}
const inspection=read(own('vsix-inspection-01.json')),artifact=fact(inspection.vsix);
assert.equal(inspection.status,'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED');
assert.equal(inspection.entryCount,14);assert.equal(inspection.runtimeCount,3);assert.equal(inspection.machineSettings,77);
assert.equal(inspection.runtimeFlag,'soterai.lite.configScanner.editor');assert.equal(inspection.forbiddenRuntimeInputs,0);
assert.equal(inspection.verificationEvidenceShipped,false);assert.equal(artifact.sha256,inspection.sha256);assert.equal(artifact.bytes,inspection.bytes);
assert.match(artifact.path,/f22g-20261021-attempt01\.vsix$/);for(const input of inspection.verifiedSourceInputs)current(input);
const packageText=fs.readFileSync(own('package-01.txt'),'utf8');
const packageResult=JSON.parse(packageText.trim().split(/\r?\n/).findLast(line=>line.startsWith('{"status":"PACKAGED_NOT_HOST_VERIFIED",')));
assert.equal(packageResult.sha256,artifact.sha256);assert.equal(packageResult.bytes,artifact.bytes);
const extension=inspection.sourceProvenance.inventory.find(row=>row.name==='extension.js').sha256;
assert.equal(packageResult.extensionSha256,extension);
const previous=read(path.join(__dirname,'../20261021-f22f-ci-46f38b2d/vsix-inspection-02.json'));
for(const name of ['local-ai-broker.js','soterai-mcp-server.js'])assert.equal(inspection.sourceProvenance.inventory.find(row=>row.name===name).sha256,previous.sourceProvenance.inventory.find(row=>row.name===name).sha256);
const focused=tap('editor-combined-02.txt'),full=tap('full-tests-03.txt'),backend=tap('backend-tests-01.txt');
assert.equal(focused.pass,358);assert.equal(full.tests,3288);assert.equal(full.pass,3284);assert.equal(full.skipped,4);
assert.equal(backend.tests,144);assert.equal(backend.pass,143);assert.equal(backend.skipped,1);
const commands=['ownership-recheck-01','readme-accuracy-02','editor-plan-01','editor-integration-01','editor-combined-02','build-native-hosts-run-01','host-fixture-validation-run-01','full-tests-03','backend-typecheck-01','backend-tests-01','package-01','inspect-vsix-run-01'].map(name=>({name,...receipt(name+'.txt')}));
function retainedReceipt(name,expectedExit){const log=own(name+'.txt'),record=read(log+'.result.json');assert.equal(record.exitCode,expectedExit,name);assert.equal(record.sha256.toLowerCase(),hash(log),name);assert.equal(path.resolve(repo,record.output),log);return {name,...record,log:fact(log),receipt:fact(log+'.result.json')};}
const failedCommands=['full-tests-01','full-tests-02','editor-native-run-01','editor-native-run-02'].map(name=>retainedReceipt(name,1));
const directories=['f22g-editor-native-20261021T153541Z-e1975cb9','f22g-editor-native-20261021T154219Z-96f206f5'];
const nativeAttempts=directories.map(directory=>{
 const freeze=read(own(directory+'/freeze.json')),close=read(own(directory+'/primary-owned-editor-close.json'));
 assert.equal(freeze.vsixSha256,artifact.sha256);assert.equal(freeze.extensionBundleSha256,extension);assert.equal(freeze.syntheticOnly,true);
 assert.equal(close.exitCode,1);assert.equal(close.observedExit,true);assert.equal(close.stdoutEOF,true);assert.equal(close.stderrEOF,true);assert.equal(close.signalsRequested,0);
 assert(!fs.existsSync(own(directory+'/primary-results.json')));assert(!fs.existsSync(own(directory+'/summary.json')));
 return {directory,status:'FAILED_STARTUP_NO_NATIVE_ASSERTION_RESULT',freeze:fact(own(directory+'/freeze.json')),close:fact(own(directory+'/primary-owned-editor-close.json')),stdout:fact(own(directory+'/primary-stdout.txt')),stderr:fact(own(directory+'/primary-stderr.txt')),observedExit:close.exitCode,bothEOF:true,signalsRequested:0,coverage:'UNVERIFIED'};
});
const fixture=read(own('host-fixture-validation-01.json')),payload=read(own('native-payload-validation-01.json'));
assert.equal(fixture.status,'PASS_PRELAUNCH_FIXTURE_VALIDATION');assert.equal(fixture.scripts.length,18);assert.equal(fixture.compiled.length,10);assert.equal(fixture.signalsRequested,0);
assert.equal(payload.files,5);assert.equal(payload.findings,4);assert.equal(payload.publicControls,2);assert.equal(payload.nativeBehaviorVerified,false);
const parserInputs=['node_modules/@babel/parser/package.json','node_modules/@babel/parser/lib/index.js','node_modules/@babel/parser/LICENSE','node_modules/yaml/package.json','node_modules/yaml/LICENSE','node_modules/yaml/README.md','node_modules/jsonc-parser/package.json','node_modules/jsonc-parser/LICENSE.md','node_modules/jsonc-parser/README.md'].map(name=>fact(path.join(repo,name)));
for(const [name,version] of [['@babel/parser','7.29.7'],['yaml','2.9.0'],['jsonc-parser','3.3.1']])assert.equal(read(path.join(repo,'node_modules',name,'package.json')).version,version);
const catalog=fact(path.join(repo,'docs/soterai-lite/LITE-CATALOG.json'));assert.equal(catalog.sha256,'1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4');
write('checkpoint-receipt-01.json',{
 schemaVersion:1,status:'INCOMPLETE',feature:'F22g',parent,artifact,extensionSha256:extension,inspection:fact(own('vsix-inspection-01.json')),
 progress:fact(own('f22g-progress-03.json')),inputs:inspection.verifiedSourceInputs,parserInputs,focused,full,backend,commands,failedCommands,nativeAttempts,
 prelaunch:{record:fact(own('host-fixture-validation-01.json')),payload:fact(own('native-payload-validation-01.json')),scripts:18,drivers:10,checks:25,files:5,findings:4,publicControls:2,nativeBehaviorVerified:false},
 native:'INCOMPLETE_TWO_FAILED_STARTUPS_NO_NATIVE_ASSERTION_RESULT',affected:'NOT_RUN_CURRENT_EXACT_ARTIFACT',acceptance:'NOT_GRANTED',nextFeature:'NOT_STARTED',catalog,
 scope:'Source and test custody checkpoint for finite saved project launch/tasks/settings JSONC. Passing static, focused/full/backend/compiler/package/content gates do not establish native, affected, safe-withdrawal, vendor, human or independent coverage. Both failed isolated editor starts retain exit1 and both EOF without signals. Failed earlier full suites and unchanged focused ownership recheck remain retained, with root cause UNESTABLISHED. No acceptance, feature completion, rating or advancement.',
 remaining:'F22g actual native and affected checks, safe withdrawal, accepted exact-object verification, complete source/transition byte barriers and all later planned features/gates remain pending.',
 independence:'LOW',rating:'PENDING',time:new Date().toISOString()
});
console.log(JSON.stringify({status:'INCOMPLETE_CHECKPOINT_RECORDED',feature:'F22g',artifact:artifact.sha256,full:full.tests,nativeAttempts:2,nativeAssertionResults:0,nextFeature:'NOT_STARTED'}));
