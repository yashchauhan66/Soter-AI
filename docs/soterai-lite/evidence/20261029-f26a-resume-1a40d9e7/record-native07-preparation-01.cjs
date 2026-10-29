const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./diagnostic-admission-07.cjs'),{own,read,fact,sha}=C;
(async()=>{
 const admission=await C.guard();
 for(const n of ['native07-syntax-01','native07-outer-syntax-01','native07-outer-ps-syntax-01'])assert.equal(read(own(n+'.txt.result.json')).exitCode,0);
 const owners=read(own('native06-postclose-owner-observation-04.json'));assert.equal(owners.matchingProcesses.length,0);
 assert(!fs.existsSync(own('native07-user-approval-01.json'))&&!fs.existsSync(own('native07-consumption-01.json'))&&!fs.existsSync(own('run-precommit-native-07.ps1')));
 const progress={feature:'F26a',status:'NATIVE06_FAIL_RETAINED_DIAGNOSTIC07_PREPARED_EXPLICIT_APPROVAL_REQUIRED',observedAt:new Date().toISOString(),previous:fact(own('progress-03.json')),
 native06:{status:'CONSUMED_FAIL_NO_RETRY',pass:4,fail:1,notRun:25,restart:'NOT_RUN',offline:'NOT_RUN',failure:'HP05 AssertionError; exact production cause UNESTABLISHED',result:fact(own('native06-chain-result-01.json'))},
 priorOwnerAbsence:fact(own('native06-postclose-owner-observation-04.json')),admission,
 proposal:fact(own('NATIVE07-DIAGNOSTIC-PROPOSAL01.md')),candidate:fact(own('native07-candidate-01.ps1.txt')),review:fact(own('native07-packet-review-01.json')),
 meaningfulComponentEvidence:{firstInstall:fact(own('first-install-component-01.txt.result.json')),firstInstallPass:2,privacy:fact(own('install-diagnostics-component-07.txt.result.json')),privacyPass:3,delegation:fact(own('diagnostic-delegation-08.txt.result.json')),delegationPass:3},
 typecheck:fact(own('native-typecheck-08.txt.result.json')),build:fact(own('native-build-07.txt.result.json')),syntax:['native07-syntax-01','native07-outer-syntax-01','native07-outer-ps-syntax-01'].map(n=>fact(own(n+'.txt.result.json'))),
 productionChanges:0,oraclesUnchanged:34,bootstrapUnchanged:true,deadlinesUnchanged:true,native07:'NOT_AUTHORIZED_NOT_MATERIALIZED_NOT_RUN',
 retainedPreparationFailures:'NativeTC07 two diagnostic typing errors fixed in08; delegation07 sandbox spawn EPERM then08 actual3PASS; postclose03 self-query match superseded by04 exactabsence; earlier failures unregraded',
 remaining:'Fresh explicit single native07 approval; actual34/offline/20affected509/functional10/security17/withdrawal/acceptance/scoped feature commits+bytes. F26b/F28/F31b/F32/V01-V05 incomplete; originalL6 HUMAN-ACTIONS then STOP.',rating:'NOT_ISSUED'};
 fs.writeFileSync(own('progress-04.json'),JSON.stringify(progress,null,2)+'\n',{flag:'wx'});
 const progressFact=fact(own('progress-04.json'));
 const receipt=`\n\n## STEP RECEIPT F26a-DIAGNOSTIC07-PREPARED / first-install2+diagnostic6 PASS; no native07 approval or launch\n\n${progressFact.path} sha${progressFact.sha256}. Native06 actual4PASS1FAIL25NOT_RUN/restart+offlineNOT_RUN retained, Code0/EOF/outer1/EOF/no signals, approval consumed. Exact HP05 production cause UNESTABLISHED; no guessed production change. New component2PASS uses unchanged controller/real descriptor+loopback owner, explicit discovery/policy/artifact/backup/hook seams. Added diagnostic privacy3+actual generated delegation/oracle3 PASS; strictTC08/build07/candidate+outer syntax PASS. Original34 callbacks byte exact; reversal restores whole original fixture; bootstrap/deadlines/offlinehelper unchanged; current1036/VSIXd06a8740/other24drivers admitted. TC07 typingFAIL and delegation07 sandboxEPERM retained; observer03 self-query metadata corrected04 actualpriorownerabsence. Proposal ${progress.proposal.path} sha${progress.proposal.sha256}; candidate2988d8f3/driver8f7d11fa. Native07 NOT_AUTHORIZED/NOT_MATERIALIZED/NOT_RUN; fresh explicit approval required under plan67 after consumed original+extra05+extra06. No nextfeature or F26a acceptance; original20affected509/functional10/security17/withdrawal/commits pending. User-authorized cachecleanup complete; all project/evidence/vendor/unrelated source preserved; no rating/push/realdata/normalprofile/OSchanges/signals/originalL6 HUMAN-ACTIONS STOP/diskwaiver persist.\n`;
 fs.appendFileSync(path.resolve(__dirname,'../../ledger.md'),receipt);
 fs.appendFileSync(path.resolve(__dirname,'../../NEXT-CHAT-HANDOFF-20261029-F26A.md'),receipt+'Read progress04 after ledger; request one explicit extra diagnostic07 approval only after local checkpoint byte verification. Do not rerun06 or infer authorization from cleanup/generic continue.\n');
 const qp=path.resolve(__dirname,'../../FEATURE-QUEUE.json'),q=read(qp),card=q.features.find(v=>v.id==='F26').subcards.find(v=>v.id==='F26a');
 q.f26aLatestCheckpoint=progressFact;card.progressEvidence=progressFact.path;card.executionDecision='Native06 consumed FAIL4PASS1FAIL25NOT_RUN; exact cause UNESTABLISHED. Diagnostic07 prepared with first-install2/privacy3/delegation3/TC08/build/syntax PASS, unchanged original34/bootstrap/deadlines/currentVSIX. Fresh explicit single-extra approval required; NOT_MATERIALIZED/NOT_RUN.';
 q.f26aNative07Proposal={status:'EXPLICIT_FRESH_APPROVAL_REQUIRED_NOT_RUN',allowedAttemptsIfApproved:1,proposal:progress.proposal,candidate:progress.candidate,review:progress.review};
 fs.writeFileSync(qp,JSON.stringify(q,null,2)+'\r\n');
 console.log(JSON.stringify({status:progress.status,progress:progressFact,proposal:progress.proposal}));
})().catch(e=>{console.error(e);process.exitCode=1;});
