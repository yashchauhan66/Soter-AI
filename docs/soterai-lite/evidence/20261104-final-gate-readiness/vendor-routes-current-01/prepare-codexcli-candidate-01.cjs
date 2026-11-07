'use strict';
// Read-only static admission validation with an inert uniquely named candidate.
// The candidate filename cannot be run by the strict runner; root must review
// and create the exact separate admitted filename. No profile/native is made.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const route=require('./codexcli-route-current-01.cjs');
(async()=>{
 const nonce=crypto.randomBytes(4).toString('hex'),stamp=new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z');
 const a=await route.makeAdmission({runRoot:'D:\\SoterAI-Lite-test-profiles\\f20a-product-'+stamp+'-'+nonce,receipts:path.join(__dirname,'codexcli-run-'+stamp+'-'+nonce)});
 route.validateAdmissionShape(a);assert(!fs.existsSync(a.runRoot));assert(!fs.existsSync(a.receipts));
 const candidate=path.join(__dirname,'codexcli-admission-candidate-01.json');fs.writeFileSync(candidate,JSON.stringify(a,null,2)+'\n',{flag:'wx'});
 const f=route.fact(candidate);
 fs.writeFileSync(path.join(__dirname,'codexcli-static-review-01.json'),JSON.stringify({feature:'V01_CODEXCLI',status:'PASS_CURRENT_STATIC_ADMISSION_CANDIDATE_ONLY_NATIVE_NOT_RUN',candidate:f,source:a.source,qualification:a.qualification,currentVsixSha256:a.currentVsixSha256,originalChecks:20,publicGraphFiles:50,currentCode:'1.144.1',fixtures:a.fixtures,codeLaunches:0,vendorClientLaunches:0,networkRequests:0,processQueries:0,signalsRequested:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS_INERT_CURRENT_CODEXCLI_CANDIDATE',candidate:f,runRoot:a.runRoot}));
})().catch(e=>{console.error(e);process.exitCode=1});
