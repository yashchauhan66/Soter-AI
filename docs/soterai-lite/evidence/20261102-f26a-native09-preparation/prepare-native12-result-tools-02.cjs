'use strict';
// Prepare text only while the sole final native run is active. No acceptance or Git action.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),C=require('./native09-current-admission-01.cjs'),{own,read,sha,fact}=C;
const approval=read(own('native12-user-approval-01.json'));assert.equal(approval.replyId,'call_3d1ca86cdb034f82a9ea32aa1bc401ab');assert.equal(approval.finalAttempt,true);assert.equal(approval.allowedAttempts,1);
const outputs=[];
function put(name,body){new vm.Script(body,{filename:name});if(fs.existsSync(own(name)))assert.equal(fs.readFileSync(own(name),'utf8'),body,'Only identical previously prepared text may be reused');else fs.writeFileSync(own(name),body,{flag:'wx'});outputs.push(fact(own(name)));}
function versions(body){return body.replaceAll('native11','native12').replaceAll('NATIVE11','NATIVE12').replaceAll('call_8a97d0783c0c48dc94d8ff95b262d4b4',approval.replyId).replaceAll('767dca8042070ac87ad5143b491d370a7c643a857f793e568043ef777324e8da',approval.proposalSha256).replaceAll('NATIVE12-PHASE-BUDGET-PROPOSAL01.md','NATIVE12-OFFLINE-ROOT-CASE-PROPOSAL01.md').replaceAll('run-native12-current-chain-02.cjs','run-native12-current-chain-01.cjs').replaceAll('EXPLICIT_ONE_RUN_USER_REPLY_8A97','EXPLICIT_FINAL_ONE_RUN_USER_REPLY_3D1C');}
let verifier=versions(fs.readFileSync(own('verify-native11-result-01.cjs'),'utf8'));
const marker='eq(approval.allowedAttempts,1);';assert(verifier.includes(marker));verifier=verifier.replace(marker,()=>marker+'eq(approval.finalAttempt,true);eq(approval.noFurtherF26aNativeRuns,true);');
put('verify-native12-result-01.cjs',verifier);
let finalizer=versions(fs.readFileSync(own('finalize-feature-acceptance-03.cjs'),'utf8'));
const failed='approved current11 explicitly uses540s fixture phases, originalproduct60s/child90s/offline90s/root20min unchanged, ONE extra attempt without automatic retry.';
assert(finalizer.includes(failed));finalizer=finalizer.replace(failed,()=> 'current11 primary30/offline/phase540PASS but restart1PASS1FAIL2NOT_RUN due to fixture D:/d: cwd mismatch retained unchanged; current12 guarded exact primary-root input retains original34 and phase540/product60s/child90s/offline90s/root20min, ONE FINAL attempt with no retry or later native13 request.');
put('finalize-feature-acceptance-04.cjs',finalizer);
function sourceCommon(body){
 body=versions(body).replaceAll('5933b2f4248a250d193119639dd650dfca1ba80d','5901a05b6b040334ad9c3e83c9ba474df35be3a6').replaceAll('b79261c701f15e562cf2e769957e0c50fa20dec49e7f995b43246397fc6bf1af','32bf15ceea521cf7f3cdc96d2c1e16df22db6dcba77843e3744f0aadb28a170f').replaceAll('finalize-feature-acceptance-03.cjs','finalize-feature-acceptance-04.cjs').replaceAll('f26a-source-manifest-03.json','f26a-source-manifest-04.json').replaceAll('f26a-source-byte-proof-03.json','f26a-source-byte-proof-04.json').replaceAll('f26a-source-body-03.txt','f26a-source-body-04.txt');
 const old='/^native10-consumption-';assert(body.includes(old));body=body.replace(old,'/^native12-consumption-');assert(!body.includes('native12-current-binding'));assert(body.includes('C.guard()')); // Transition uses C.guard rather than a literal binding filename.
 const auth='assert.equal(approval.allowedAttempts,1);';assert(body.includes(auth));return body.replace(auth,()=>auth+'assert.equal(approval.finalAttempt,true);assert.equal(approval.noFurtherF26aNativeRuns,true);');
}
put('scoped-feature-source-git-04.cjs',sourceCommon(fs.readFileSync(own('scoped-feature-source-git-03.cjs'),'utf8')));
let transition=sourceCommon(fs.readFileSync(own('scoped-feature-transition-git-02.cjs'),'utf8'));
for(const stem of ['manifest','byte-proof','body'])transition=transition.replaceAll('f26a-transition-'+stem+'-02.','f26a-transition-'+stem+'-03.');
put('scoped-feature-transition-git-03.cjs',transition);
const report={status:'PREPARED_NATIVE12_RESULT_TOOLS_SYNTAX_ONLY_NO_ACCEPTANCE_OR_GIT_ACTION',observedAt:new Date().toISOString(),approval:fact(own('native12-user-approval-01.json')),outputs,corrections:['Native12 exact final reply/proposal/runner/parent/proof binding','Keep native09 current1076 binding filename','Fix stale native10 consumption filter to exact native12 generation','Preserve native10 phase300 and native11 HR02 failures; no old regrade'],nativeRun:'ACTIVE_OR_PENDING_RESULT_NOT_INSPECTED_HERE',featureComplete:false};
fs.writeFileSync(own('native12-result-tools-preparation-02.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,outputs:outputs.length}));
