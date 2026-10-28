'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {own,read,guard,pin,sha}=require('./current-native-guard-03.cjs');
(async()=>{
 const binding=await guard(),prior=read(own('f29-native-chain-result-05.json'));
 assert(prior.actualClose&&prior.stdoutEOF&&prior.stderrEOF&&prior.signalsRequested===0);assert.equal(prior.wrapperExit,1);
 const affected=read(own('affected-acceptance-04.json'));assert.equal(affected.status,'PASS_CURRENT_AFFECTED66_FUNCTIONAL10_SECURITY17_UNCHANGED_RENDERER_REQUIRED');
 for(const row of affected.evidence)await pin(row);for(const row of read(own('edge-acceptance-01.json')).retained)await pin(row);
 const prepared=read(own('proposal06-preparation-01.json'));assert.equal(prepared.status,'PROPOSAL06_HARNESS_PREPARED_NOT_AUTHORIZED_NOT_RUN');
 for(const row of prepared.files){const raw=fs.readFileSync(own(row.name));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
 assert(!fs.existsSync(own('extra06-consumption-01.json')));
 const approval={feature:'F29',status:'EXPLICIT_USER_SINGLE_EXTRA06_APPROVED_NOT_YET_CONSUMED',observedAt:new Date().toISOString(),questionItemId:'["request_user_input_async","call_dd87ea955bd94b6891d703393180ce84",0]',answer:'Ek extra F29 Proposal06 run allow karo',proposalSha256:sha(fs.readFileSync(own('PROPOSAL06.md'))),allowedNativeAttempts:1,explicitUserApproval:true,sourceProof:binding.sourceProof,vsix:binding.vsix,native06:'F26a_USER_DEFERRED_NOT_RUN',signalsRequested:0};
 fs.writeFileSync(own('extra06-approval-01.json'),JSON.stringify(approval,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'CURRENT_EXACT_EXTRA06_APPROVAL_BOUND_NOT_LAUNCHED',proposalSha256:approval.proposalSha256,allowedNativeAttempts:1}));
})().catch(error=>{console.error(error);process.exitCode=1;});
