'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const C=require('./storage-current-admission-09.cjs'),{own,read,fact,sha}=C;
const put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});
const replaceOnce=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
const oldStatus="'BUILT_NOT_RUN_ESM_PARSER_INLINED'",newStatus="'BUILT_CURRENT1037_DRIVERS25_NOT_NATIVE_ACCEPTANCE'";
const oldSelf='(Get-F26ASha $PSCommandPath)',originalSelf="(Get-F26ASha (Join-Path $PSScriptRoot 'native08-candidate-01.ps1.txt'))";
function corrected(s){return replaceOnce(replaceOnce(s,oldStatus,newStatus),oldSelf,originalSelf);}
function validate(){
 const a=read(own('native08-user-approval-01.json'));assert.equal(a.replyId,'call_cb4f9514b6304d78a3617e3d2358b2f6');assert.equal(a.allowedAttempts,1);
 assert.equal(fact(own('native08-user-approval-01.json')).sha256,'1b68c403e2dc682778f53e29c8025d22994dfdffd8368d56aba09e843eeacf54');
 const original=fs.readFileSync(own('native08-candidate-01.ps1.txt'),'utf8');assert.equal(sha(Buffer.from(original)),a.candidateSha256);
 assert.equal(fact(own('NATIVE08-STORAGE-FIX-PROPOSAL01.md')).sha256,a.proposalSha256);
 assert.equal(fs.readFileSync(own('run-precommit-native-08b.ps1'),'utf8'),corrected(original));
 assert.equal(fs.readFileSync(own('native08-candidate-02.ps1.txt'),'utf8'),corrected(original));
 const close=read(own('native08-run-01-owned-close.json'));assert(close.actualClose&&close.stdoutEOF&&close.stderrEOF);assert.equal(close.exitCode,1);assert.equal(close.signalsRequested,0);
 assert(fs.readFileSync(own('native08-run-01.txt'),'utf8').includes('Current21-driver provenance must bind this exact host.'));
 assert(!fs.existsSync(own('native08-consumption-01.json')),'One native08 approval is already consumed');
 return {a,original};
}
module.exports={validate,corrected};
if(require.main===module)(async()=>{
 await C.guard();assert(!fs.existsSync(own('native08-consumption-01.json')));
 const original=fs.readFileSync(own('native08-candidate-01.ps1.txt'),'utf8'),next=corrected(original);
 put('native08-candidate-02.ps1.txt',next);put('run-precommit-native-08b.ps1',next);
 const cut=next.indexOf("$taskConsumption=Join-Path");assert(cut>0);
 put('native08-preflight-02.ps1',next.slice(0,cut)+"Write-Output 'CURRENT_PROVENANCE_AND_ALL_PRECONSUMPTION_GATES_PASS_NO_NATIVE_LAUNCH'\n");
 let outer=fs.readFileSync(own('run-native08-chain-01.cjs'),'utf8');
 outer=outer.replaceAll('run-precommit-native-08.ps1','run-precommit-native-08b.ps1').replaceAll('native08-run-01','native08-run-02').replaceAll('native08-chain-start-01','native08-chain-start-02').replaceAll('native08-chain-result-01','native08-chain-result-02').replaceAll('native08-chain-failure-01','native08-chain-failure-02');
 outer=replaceOnce(outer,"const b=await guard();","require('./prepare-native08-preflight-correction-02.cjs').validate();const b=await guard();");
 outer=replaceOnce(outer,"sha(fs.readFileSync(own('run-precommit-native-08b.ps1')))","sha(fs.readFileSync(own('native08-candidate-01.ps1.txt')))");
 put('run-native08-chain-02.cjs',outer);
 let start=fs.readFileSync(own('start-native08-chain-01.ps1'),'utf8');
 for(const kind of ['owner','stdout','stderr'])start=start.replaceAll('native08-chain-'+kind+'-01','native08-chain-'+kind+'-02');
 start=start.replaceAll('run-native08-chain-01.cjs','run-native08-chain-02.cjs');put('start-native08-chain-02.ps1',start);
 let observe=fs.readFileSync(own('native08-observe-prior-owners-01.ps1'),'utf8').replaceAll('native08-prior-owner-observation-01','native08-prior-owner-observation-02');
 observe=replaceOnce(observe,'$taskObservations=@()',"$taskPreflightClose=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-run-01-owned-close.json') -Raw|ConvertFrom-Json\n$taskPreflightOwner=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native08-chain-owner-01.json') -Raw|ConvertFrom-Json\n$taskKnown+=@(@{id=$taskPreflightClose.pid;close=$taskPreflightClose.observedAt},@{id=$taskPreflightOwner.pid;close=$taskPreflightClose.observedAt})\n$taskObservations=@()");
 put('native08-observe-prior-owners-02.ps1',observe);
 validate();
 const record={status:'PRELAUNCH_METADATA_CORRECTION_UNCONSUMED_SINGLE_NATIVE08_AUTHORITY_RETAINED',observedAt:new Date().toISOString(),originalApproval:fact(own('native08-user-approval-01.json')),originalCandidate:fact(own('native08-candidate-01.ps1.txt')),correctedCandidate:fact(own('native08-candidate-02.ps1.txt')),originalFailure:fact(own('native08-run-01.txt')),changes:['Match actual freshly-built25-driver receipt status instead of historical21-driver status label','Validate original user-approved candidate hash; outer additionally proves exact whole successor derivation'],unchanged:'Original34 callbacks, bootstrap, all vendor/source/artifact pins, all custody checks, deadlines, no-signals, original single consumption path; no Code/profile launched by failed preflight',extraNativeRound:false,signalsRequested:0};
 put('native08-preflight-correction-02.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
})().catch(e=>{console.error(e);process.exitCode=1;});
