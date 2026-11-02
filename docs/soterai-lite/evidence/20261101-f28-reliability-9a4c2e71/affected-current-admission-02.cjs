'use strict';
// Additive fixture-only binding. Original native30/current1076/artifact gate stays intact.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('./affected-current-admission-01.cjs');
const {own,repo,read,pin,sha,fact}=C;
function supplement(){
 const s=read(own('affected-continuation-binding-02.json'));
 assert.equal(s.status,'F28_OWNED_OUTPUT_OBSERVATION_HANDSHAKE_ONE_NORMAL_ROUND3');
 assert.equal(s.allowedAttempts,1);assert.equal(s.normalImprovementRound,3);
 assert.deepEqual(s.native30Acceptance,C.component());
 assert.equal(s.f26aNative09,'USER_DEFERRED_NOT_RUN');assert.equal(s.gitPushAuthorized,false);
 for(const r of s.inputs)pin(r);
 for(const n of ['owned-output-timing-after-01','owned-output-source-typecheck-01','owned-output-driver-build-01','affected-continuation-syntax-02','affected-failure-owner-01']){
  const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0,n);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());
 }
 const p=read(path.join(repo,s.driverProvenance.path)),old=read(own('native-driver-provenance-05.json'));assert.equal(p.drivers.length,26);
 for(const r of p.drivers)pin(r);
 for(const r of old.drivers){const match=p.drivers.find(x=>path.basename(x.path)===path.basename(r.path));assert(match);if(path.basename(r.path)==='lite-log-vault-runtime-host.js')assert.deepEqual(match,s.driver);else assert.deepEqual(match,r);}
 return s;
}
function guard(options={}){const b=C.guard(options),s=supplement();assert.deepEqual(s.vsix,b.vsix);assert.deepEqual(s.sourceProof,b.sourceProof);return {...b,driverProvenance:s.driverProvenance,fixtureContinuation:fact(own('affected-continuation-binding-02.json'))};}
function materialization(){const m=read(own('affected-current-materialization-01.json')),s=supplement();return {...m,families:m.families.map(f=>f.id==='owned-output'?{...f,helper:s.helper,driver:s.driver}:f)};}
const familyName=id=>'affected-'+id+'-f28-'+(id==='logs'?'01':'02');
module.exports={...C,supplement,guard,materialization,familyName};
if(require.main===module)try{const b=guard({component:true});console.log(JSON.stringify(process.argv.includes('--emit-binding')?b:{status:'PASS_CURRENT_F28_CONTINUATION_ADMISSION_NO_NATIVE_EXECUTION',sourceCount:1076,originalChecks:509,originalPhases:37,repeatLogs:false,normalImprovementRound:3}));}catch(e){console.error(e);process.exitCode=1;}
