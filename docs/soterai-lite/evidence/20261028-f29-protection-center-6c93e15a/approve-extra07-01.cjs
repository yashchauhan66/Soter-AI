'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');const {own,read,guard,pin,sha}=require('./current-native-guard-03.cjs');
(async()=>{
 const binding=await guard(),prior=read(own('f29-native-chain-result-06.json'));assert(prior.actualClose&&prior.stdoutEOF&&prior.stderrEOF);assert.equal(prior.wrapperExit,1);assert.equal(prior.signalsRequested,0);
 const prepared=read(own('proposal07-preparation-01.json'));assert.equal(prepared.status,'PROPOSAL07_PREPARED_NOT_AUTHORIZED_NOT_RUN');for(const row of prepared.files){const raw=fs.readFileSync(own(row.name));assert.equal(raw.length,row.bytes);assert.equal(sha(raw),row.sha256);}
 for(const row of read(own('affected-acceptance-04.json')).evidence)await pin(row);for(const row of read(own('edge-acceptance-01.json')).retained)await pin(row);
 const {admit}=require('./accessibility-binding-02.cjs');admit(own('renderer-binding-07.json'),'CODE_RENDERER');assert(!fs.existsSync(own('extra07-consumption-01.json')));
 const approval={feature:'F29',status:'EXPLICIT_USER_SINGLE_EXTRA07_APPROVED_NOT_YET_CONSUMED',observedAt:new Date().toISOString(),questionItemId:'["request_user_input_async","call_c7390485aef84ddcbe9da84e06cbcb1e",0]',answer:'Ek extra F29 Proposal07 run allow karo',proposalSha256:sha(fs.readFileSync(own('PROPOSAL07.md'))),allowedNativeAttempts:1,explicitUserApproval:true,sourceProof:binding.sourceProof,vsix:binding.vsix,native06:'F26a_USER_DEFERRED_NOT_RUN',signalsRequested:0};
 fs.writeFileSync(own('extra07-approval-01.json'),JSON.stringify(approval,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'CURRENT_EXACT_EXTRA07_APPROVAL_BOUND_NOT_LAUNCHED',proposalSha256:approval.proposalSha256,allowedNativeAttempts:1}));
})().catch(error=>{console.error(error);process.exitCode=1;});
