'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),G=require('./affected-current-admission-proposed-02.cjs');
const root=path.join(__dirname,'vendor-routes-current-01'),own=n=>path.join(root,n),base=G.binding();
const fileMap={'codexcli-route-current-01.cjs':'codexcli-route-current-02.cjs','run-codexcli-current-01.ps1':'run-codexcli-current-02.ps1','run-owned-code-current-01.cjs':'run-owned-code-current-02.cjs','codexcli-admission-01.json':'codexcli-admission-02.json','codexcli-one-attempt-consumed-01.json':'codexcli-one-attempt-consumed-02.json','codexcli-code-launch-01.json':'codexcli-code-launch-02.json','codexcli-result-acceptance-01.json':'codexcli-result-acceptance-02.json'};
function one(s,a,b){assert.equal(s.split(a).length-1,1,a);return s.replace(a,()=>b);}
for(const name of ['codexcli-route-current-01.cjs','run-codexcli-current-01.ps1','run-owned-code-current-01.cjs']){
 let s=fs.readFileSync(own(name),'utf8');for(const[a,b]of Object.entries(fileMap))s=s.split(a).join(b);
 if(name==='codexcli-route-current-01.cjs'){
  const old="const vendorFact=fact(path.join(F,'public-vendor-observation-02.json'));assert.equal(vendorFact.sha256,q.currentVendorReceiptSha256);const vendor=read(vendorFact.path);";
  const replacement="const priorVendorFact=fact(path.join(F,'public-vendor-observation-02.json'));assert.equal(priorVendorFact.sha256,q.currentVendorReceiptSha256);const vendorFact=fact(path.join(F,'public-vendor-observation-03.json'));assert.equal(vendorFact.sha256,'f810b833e19b7459bad9b37351f36545d04d728eb67a2db27465d0b01969872a');const vendor=read(vendorFact.path);const signatureFact=fact(path.join(F,'current-signature-observation-02.json'));assert.equal(signatureFact.sha256,'1fb12aac39b69772d7fe109ea330c255ede6ff2e1a286a8d2ed7c52b4c1b6d45');const signatures=read(signatureFact.path);assert.equal(signatures.vendorReceiptSha256,vendorFact.sha256);assert.equal(signatures.rows[0].status,'Valid');assert(signatures.rows[0].signerSubject.includes('Microsoft Corporation'));assert.equal(signatures.rows[0].sha256,vendor.currentHost.executable.sha256);";
  s=one(s,old,replacement);s=one(s,"vendor.currentHost.version,'1.144.1'","vendor.currentHost.version,'1.145.0'");s=one(s,'261c84cb1eddf11235f9e2c921425e9663fbe556','a717861c07586a53d83b80d742cd3f59b20a6273');
 }
 fs.writeFileSync(own(fileMap[name]),s,{flag:'wx'});
}
(async()=>{
 const before=require(own('codexcli-route-current-01.cjs')),api=require(own('codexcli-route-current-02.cjs'));assert.equal(api.verifyResult.toString(),before.verifyResult.toString());assert.equal(api.verifyClose.toString(),before.verifyClose.toString());
 const suffix=new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z')+'-'+crypto.randomBytes(4).toString('hex');
 const a=await api.makeAdmission({runRoot:'D:\\SoterAI-Lite-test-profiles\\f20a-product-'+suffix,receipts:own('codexcli-run-'+suffix)});
 const candidate=own('codexcli-admission-candidate-02.json');fs.writeFileSync(candidate,JSON.stringify(a,null,2)+'\n',{flag:'wx'});
 const admission=own('codexcli-admission-02.json');fs.copyFileSync(candidate,admission,fs.constants.COPYFILE_EXCL);await api.admit(admission,api.fact(admission).sha256);
 assert(!fs.existsSync(own('codexcli-one-attempt-consumed-02.json')));assert(!fs.existsSync(a.runRoot));
 const report={status:'PASS_ROOT_REVIEWED_CODEXCLI_11450_HOST_REFRESH_NATIVE_NOT_RUN',observedAt:new Date().toISOString(),admission:api.fact(admission),candidate:api.fact(candidate),runner:api.fact(own('codexcli-route-current-02.cjs')),host:base.hostReview,signature:base.signatureReceipt,original20Validator:'BYTE_EXACT_FUNCTION_REVERSAL_PASS',directCloseValidator:'BYTE_EXACT_FUNCTION_REVERSAL_PASS',originalDriver:a.originalDriver,originalGuard:a.originalGuard,source:a.source,vsix:base.vsix,normalRound:1,maxNormalRounds:3,consumption:0,nativeLaunches:0,signalsRequested:0};
 fs.writeFileSync(own('codexcli-host-refresh-02.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
