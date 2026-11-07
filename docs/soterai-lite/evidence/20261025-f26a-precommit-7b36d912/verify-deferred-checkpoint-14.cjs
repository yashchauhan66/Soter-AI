// Final read/copy verification only. No native launch, Git write or completion claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {check,fact,json,own,repo}=require('./post-full04-contract.cjs');
const gate=require('./current-content-gate04.cjs');
const checked=check();delete checked.sourceFiles;
const progress=json(own('progress-14.json'));assert.equal(fact(own('progress-14.json')).sha256,'caa331edf8e5521732e94c2e4928c7daab8e4a75bcff397e8682940da8bb05cf');
const decision=json(own('proposal06-user-decision-01.json'));assert.equal(decision.approved,false);assert.equal(decision.userAnswer,'Abhi native06 mat chalao');assert.equal(decision.status,'NATIVE06_DEFERRED_BY_USER_DO_NOT_RUN');
assert(!fs.existsSync(own('run-precommit-native-06.ps1')));assert(!fs.existsSync(own('proposal06-user-approval-01.json')));assert(!fs.existsSync(own('precommit-native-run-06.txt')));
const queue=json(path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'));
assert.equal(queue.activeFeature,'F26');
const cards=Object.values(queue).filter(Array.isArray).flat(),parent=cards.find(x=>x&&x.id==='F26');assert(parent);assert.equal(parent.status,'ACTIVE');const child=parent.subcards.find(x=>x.id==='F26a');assert.equal(child.status,'ACTIVE');assert.equal(child.result,'INCOMPLETE');assert(child.progressEvidence.endsWith('/progress-14.json'));assert.equal(parent.subcards.find(x=>x.id==='F26b').status,'PLANNED');
for(const name of ['backend-typecheck-04','backend-tests-04','native-build-04','package-04','content-inspection-02','post-full-gates-04'])gate(name);
const snapshots=json(own('source-checkpoint-04.json'));assert.equal(snapshots.records.length,68);
for(const row of snapshots.records){assert.deepEqual(fact(path.join(repo,row.source.path)),row.source);assert.deepEqual(fact(path.join(repo,row.snapshot.path)),row.snapshot);assert.equal(row.source.sha256,row.snapshot.sha256);assert.equal(row.source.bytes,row.snapshot.bytes);}
assert.deepEqual(fact(path.join(repo,progress.artifact.path)),progress.artifact);
const content=json(own('vsix-inspection-02.json'));for(const row of content.entries){const file=own('vsix-extracted-02/'+row.path),actual=fact(file);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
const ledger=fs.readFileSync(path.join(repo,'docs/soterai-lite/ledger.md'),'utf8');assert(ledger.includes('caa331edf8e5521732e94c2e4928c7daab8e4a75bcff397e8682940da8bb05cf'));assert(ledger.includes('Abhi native06 mat chalao'));
const handoff='docs/soterai-lite/NEXT-CHAT-HANDOFF-20261026-F26a.md';assert(fs.readFileSync(path.join(repo,handoff),'utf8').includes('Do not materialize or execute native06'));
const directory=own('checkpoint-documents-14');assert(!fs.existsSync(directory));fs.mkdirSync(directory);const documents=[];
for(const relative of ['docs/soterai-lite/ledger.md','docs/soterai-lite/FEATURE-QUEUE.json',handoff]){const source=fact(path.join(repo,relative)),target=path.join(directory,path.basename(relative));fs.copyFileSync(path.join(repo,relative),target,fs.constants.COPYFILE_EXCL);const snapshot=fact(target);assert.equal(source.bytes,snapshot.bytes);assert.equal(source.sha256,snapshot.sha256);documents.push({source,snapshot});}
const result={status:'PASS_EXACT_ACTIVE_WORKING_CHECKPOINT_NATIVE06_DEFERRED_NOT_FEATURE_COMPLETION',observedAt:new Date().toISOString(),author:fact(__filename),sourceProof:checked.inputProof,currentInputFilesVerified:990,sourceDeltaSnapshotsVerified:68,extractedEntriesVerified:15,progress:fact(own('progress-14.json')),decision:fact(own('proposal06-user-decision-01.json')),artifact:progress.artifact,documents,native06:'NOT_MATERIALIZED_NOT_RUN_USER_DEFERRED',feature:'F26a_ACTIVE_INCOMPLETE',git:'NO_GIT_WRITES_OR_COMMIT_BYTE_PROOF_THIS_TURN',limits:'Working bytes/source snapshots/document copies and completed actual gate receipts only. Required native/withdrawal/acceptance/local source+transition commits and exhaustive Git byte barriers remain pending.'};
fs.writeFileSync(own('checkpoint-byte-verification-14.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,sourceFiles:990,sourceSnapshots:68,extractedEntries:15,checkpoint:fact(own('checkpoint-byte-verification-14.json')),native06:result.native06}));
