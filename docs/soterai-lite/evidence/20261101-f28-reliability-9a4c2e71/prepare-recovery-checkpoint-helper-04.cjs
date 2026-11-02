'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let s=fs.readFileSync(own('scoped-native30-checkpoint-git-03.cjs'),'utf8');
for(const n of ['empty-f28-native30-hooks','f28-native30-checkpoint-manifest','f28-native30-checkpoint-byte-proof','f28-native30-checkpoint-body'])s=s.replaceAll(n+'-03',n+'-04');
s=s.replaceAll('a5e7305eeefaf5be108ce1f71603fc99b59ab6c6','d3b9bc5d9ffa4bb0cb53fb65dbd07336cd288951');
const from=s.indexOf('async function preflight(){'),to=s.indexOf('\nfunction checkpointFile(',from);assert(from>0&&to>from);
s=s.slice(0,from)+`async function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const C=require('./affected-current-admission-03.cjs'),b=C.guard({component:true}),p=read(own('progress-06.json'));assert.equal(p.status,'F28_NATIVE30_PASS_AFFECTED176_VERIFIED_EXTRA_RECOVERY_UNAPPROVED');assert.deepEqual(p.sourceProof,b.sourceProof);assert.deepEqual(p.vsix,b.vsix);assert.equal(p.affected.verifiedChecks,176);assert.equal(p.extraRecovery.status,'UNAPPROVED_NOT_RUN');
 assert(!fs.existsSync(own('affected-recovery-user-approval-03.json'))&&!fs.existsSync(own('affected-chain-consumption-03.json')));
 for(const n of ['affected-recovery-admission-03','affected-recovery-progress-06','affected-partial-audit-06','affected-recovery-absence-01','affected-recovery-syntax-03']){const r=read(own(n+'.txt.result.json'));assert.equal(r.exitCode,0,n);assert.equal(sha(fs.readFileSync(own(n+'.txt'))),r.sha256.toLowerCase());}
 return{...p,sourceScope:[]};
}`+s.slice(to);
const filter=s.indexOf('function checkpointFile('),end=s.indexOf('\n\n(async()=>',filter);assert(filter>0&&end>filter);s=s.slice(0,filter)+'function checkpointFile(relative){return true;}'+s.slice(end);
s=s.replaceAll('progress-04.json','progress-06.json');
const bodyFrom=s.indexOf('  fs.writeFileSync(own(body),'),bodyTo=s.indexOf('  const content=',bodyFrom);assert(bodyFrom>0&&bodyTo>bodyFrom);
s=s.slice(0,bodyFrom)+`  fs.writeFileSync(own(body),"docs(lite): checkpoint F28 recovery evidence and bounded proposal\\n\\nKeep original interrupted/corrupted receipts and unknown historical closure unchanged. Fresh audit verifies9families176checks15phases; native30/full4780zeroFAIL/exact1076source/VSIX5dac unchanged. Additional recovery333checks22phases/functional10/security17 is unapproved and not run. Read-only admission/syntax/absence PASS; current marked Code/declared wrapper PIDs absent twice. Evidence/selected metadata only; product14/deferredF26a3/unrelated work unstaged. No feature completion, release readiness, push, publish or rating.\\n",{flag:'wx'});
`+s.slice(bodyTo);
s=s.replaceAll('PASS_EXACT_LOCAL_F28_NATIVE30_CLOSED_EVIDENCE_BYTES_FEATURE_INCOMPLETE','PASS_EXACT_LOCAL_F28_RECOVERY_PREPARATION_BYTES_FEATURE_INCOMPLETE').replaceAll('ACTIVE_INCOMPLETE_NATIVE30_PASS_AFFECTED_CHAIN_PENDING','ACTIVE_INCOMPLETE_NATIVE30_AND_AFFECTED176_PASS_EXTRA_RECOVERY_UNAPPROVED');
fs.writeFileSync(own('scoped-recovery-checkpoint-git-04.cjs'),s,{flag:'wx'});console.log('Prepared evidence-only recovery checkpoint helper. No approval or native launch.');
