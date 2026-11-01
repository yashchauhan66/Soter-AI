'use strict';
// Reuse the already exercised raw-byte Git transaction, changing only its explicit feature gate/scope.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n);let s=fs.readFileSync(own('scoped-local-push-drive-fix-git-09.cjs'),'utf8');
function one(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
const start=s.indexOf('function preflight(){'),end=s.indexOf('\nconst [mode,expectedHash]');assert(start>0&&end>start);
s=s.slice(0,start)+[
'async function preflight(){',
" assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');",
" const p=await require('./finalize-feature-acceptance-01.cjs').verify(),saved=read(own('acceptance-01.json'));assert.deepEqual({...p,observedAt:saved.observedAt},saved);",
" assert.equal(p.status,'PASS_SCOPED_F26B_LOCAL_SOURCE_AND_TRANSITION_BYTE_BARRIERS_PENDING');assert.equal(p.sourceScope.length,40);assert.equal(p.sourceInputs,1070);assert.equal(p.f26aNative09,'USER_DEFERRED_NOT_RUN');",
" for(const n of ['feature-acceptance-01','feature-progress-20']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}",
" assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return p;",
'}',
'',
'(async()=>{'
].join('\n')+s.slice(end);
one('const progress=preflight();','const progress=await preflight();');one('files.forEach(same);preflight();','files.forEach(same);await preflight();');
s=s.replaceAll('empty-local-push-drive-fix-hooks-09','empty-feature-source-hooks-10').replaceAll('f26b-local-push-drive-fix-manifest-09','f26b-source-manifest-10').replaceAll('f26b-local-push-drive-fix-byte-proof-09','f26b-source-byte-proof-10').replaceAll('f26b-local-push-drive-fix-body-09','f26b-source-body-10').replaceAll('progress-19.json','acceptance-01.json');
one("const parentExpected='0ccaf68aa0e58cacfda7635743e5a6c55d8377d3';","const parentExpected='253342591e761a0c3c43c4c6dc9cb67a49d4364b';");
const bs=s.indexOf('  fs.writeFileSync(own(body),'),be=s.indexOf('\n  const content=',bs);assert(bs>0&&be>bs);
s=s.slice(0,bs)+'  fs.writeFileSync(own(body),'+JSON.stringify('feat(lite): add reviewed bounded pre-push history guard\n\nScan complete bounded reachable branch history through the signed owning editor before allowing Git to send objects. Default false; reviewed install/resume/encrypted restore preserves supported original hooks. Full4750/4746PASS0FAIL4SKIP; native36, configured local-push8 with TWO authorized file pushes, affected509/37, functional10 and unchanged security17 baseline. Exact VSIX6c299712 and1070 inputs verified. Scoped40 product/test/doc paths; three deferred F26a files and unrelated work excluded. Safe withdrawal and declared owners natural close verified; nested Git children not inferred. LOW independence, no external/source-project push or publish; source/transition byte barriers still required.\n')+",{flag:'wx'});"+s.slice(be);
one('[...walk(__dirname),','[...progress.sourceScope.map(row=>row.path),...walk(__dirname),');
one("'PREPARED_SCOPED_RAW_BYTE_EVIDENCE_CHECKPOINT_NOT_COMMITTED'","'PREPARED_SCOPED_F26B_SOURCE_AND_EVIDENCE_NOT_COMMITTED'");
const oldScope="Exactly-once Proposal02 precondition failure, actual push0/all8NOT_RUN, natural close/EOF/postfailure absence. Matching drive-case defects reproduced and fixture-only canonical drive correction/49component controls/strict8 driver/syntax/admission. Proposal03 requires new explicit ONE additional fixture/TWO local file pushes. Evidence and selected metadata only; product/test/unrelated unstaged;3 deferred F26a sources excluded; F26b incomplete.";
one(oldScope,'F26b scoped40 product/test/docs plus current acceptance/evidence. Current1070/exactVSIX6c verified, full4746PASS0FAIL4SKIP/native36/localpush8/affected509/functional10/security17 baseline unchanged. User one extra Proposal03 consumed once/TWO local file pushes. Three deferred F26a sources and unrelated work excluded; tested VSIX includes those excluded inputs, not a whole-HEAD reproducibility claim. Source raw byte proof then separate DONE transition proof required.');
one('PASS_EXACT_LOCAL_F26B_CONFIGURED_PUSH02_FAILURE_DRIVE_CASE_FIX_PROPOSAL03_BYTES','PASS_EXACT_LOCAL_F26B_SOURCE_AND_EVIDENCE_BYTES');
one("featureState:'ACTIVE_INCOMPLETE'","featureState:'VERIFYING_TRANSITION_BYTE_BARRIER_PENDING'");
one('TWO_PRIOR_SINGLE_FIXTURES_CONSUMED_ZERO_PUSHES_PROPOSAL03_UNAPPROVED','PROPOSAL03_CONSUMED_ONCE_PASS8_TWO_SYNTHETIC_LOCAL_FILE_PUSHES');
s+='\n})().catch(error=>{console.error(error);process.exitCode=1;});\n';
fs.writeFileSync(own('scoped-feature-source-git-10.cjs'),s,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_RAW_BYTE_F26B_SOURCE_GIT_HELPER_NO_GIT_MUTATION',sourceScope:40}));
