const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const h = 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const fact = p => { const b = fs.readFileSync(p); return {path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}; };
const run = 'f26a-precommit-native-20261029T023319Z-238d6ff0';
const primary = read(path.join(h,run,'primary-results.json'));
const chain = read(path.join(h,'native06-chain-result-01.json'));
const close = read(path.join(h,run,'primary-owned-editor-close.json'));
assert.equal(primary.passed,4); assert.equal(primary.failed,1); assert.equal(primary.notRun,25);
assert.equal(chain.wrapperExit,1); assert(chain.actualClose && chain.stdoutEOF && chain.stderrEOF);
assert(close.observedExit && close.stdoutEOF && close.stderrEOF && close.exitCode === 0);
const progress = {feature:'F26a',status:'NATIVE06_FAILED_APPROVAL_CONSUMED_NO_RETRY',observedAt:new Date().toISOString(),
 previous:fact(path.join(h,'progress-02.json')),run,approval:fact(path.join(h,'native06-user-approval-01.json')),
 consumption:fact(path.join(h,'native06-consumption-01.json')),result:fact(path.join(h,'native06-chain-result-01.json')),
 primary:fact(path.join(h,run,'primary-results.json')),editorClose:fact(path.join(h,run,'primary-owned-editor-close.json')),
 checks:{pass:4,fail:1,notRun:25,restart:'NOT_RUN',offline:'NOT_RUN'},failure:'F26A-HP05 AssertionError; exact production cause UNESTABLISHED',
 actualClosure:{codeExit:0,wrapperExit:1,stdoutEOF:true,stderrEOF:true,signalsRequested:0,lateAbsenceChecks:'NOT_EXECUTED_AFTER_DRIVER_FAILURE'},
 resourceCleanup:'6667 old disposable Node/npm cache files removed under explicit user authority; 212852375 declared bytes; all project/evidence/vendor files preserved',
 remaining:'Diagnose HP05; retain original34/native and20affected509/functional10/security17/withdrawal/acceptance/scoped commits+bytes. Any further native improvement requires concrete reviewed proposal and fresh explicit approval.',rating:'NOT_ISSUED'};
const output=path.join(h,'progress-03.json');
fs.writeFileSync(output,JSON.stringify(progress,null,2)+'\n',{flag:'wx'});
const pin=fact(output);
const receipt=`\n\n## STEP RECEIPT F26a-NATIVE06-FAILURE / actual4PASS1FAIL25NOT_RUN; safe closure, no retry\n\n${output} sha${pin.sha256}. Approved single native06 consumed at02:33:19Z; actual HP01-04 PASS, HP05 AssertionError, later25/restart4/offline NOT_RUN. Code9148 natural0/bothEOF; outerwrapper1/bothEOF/no signals/no deadline. Later launcher absence/stability checks were not executed after driver failure, not a surviving-owner claim. Exact HP05 production cause UNESTABLISHED; signing1/backupKey0/record0/ownerServers1, all observed Git children closed/EOF. Current VSIXd06a8740 and original34 unchanged; failed run retained, approval consumed and no retry. User-authorized oldcachecleanup6667files/212852375 declared bytes completed; all project/evidence/vendor preserved. F26a ACTIVE/INCOMPLETE; original20affected509+functional10/security17/withdrawal/acceptance/commits remain. Any further native round requires concrete tested proposal and fresh explicit approval under existing three-round limit. No next feature/rating/push/signals/normalprofile/realdata/OSchanges; originalL6 HUMAN-ACTIONS thenSTOP/diskwaiver/unrelatedwork persist.\n`;
fs.appendFileSync('docs/soterai-lite/ledger.md',receipt);
fs.appendFileSync('docs/soterai-lite/NEXT-CHAT-HANDOFF-20261029-F26A.md',receipt+'Read progress03 and actual run before dependent work; progress02 running label is superseded.\n');
const queuePath='docs/soterai-lite/FEATURE-QUEUE.json';const queue=read(queuePath);
queue.f26aLatestCheckpoint=pin;
queue.f26aNative06Authorization.status='APPROVED_SINGLE_NATIVE06_CONSUMED_FAILED_NO_RETRY';
queue.f26aNative06Authorization.result=progress.result;
queue.scope=queue.scope.replace('F26a selected but native06 explicitly USER_DEFERRED','F26a ACTIVE; explicitly approved single native06 consumed and FAILED at HP05');
const feature=queue.features.find(v=>v.id==='F26');
const cards=feature.subcards || feature.cards || feature.tasks;
if(cards){const card=cards.find(v=>v.id==='F26a');assert(card);card.executionDecision=progress.status+'; actual4PASS1FAIL25NOT_RUN, restart/offline NOT_RUN; Code0/EOF, wrapper1/EOF; production cause UNESTABLISHED. No automatic retry; original required gates retained.';}
fs.writeFileSync(queuePath,JSON.stringify(queue,null,2)+'\r\n');
console.log(JSON.stringify({status:'RECORDED_ACTUAL_FAILURE',progress:pin}));
