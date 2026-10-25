'use strict';
// Root-reviewed binding only; no production, queue/ledger or Git mutations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/'),mode=process.argv[2];
assert(['acceptance','bytes'].includes(mode));const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\uFEFF/,''));
const fact=f=>{const b=fs.readFileSync(path.join(repo,f));return {path:f,bytes:b.length,sha256:sha(b)}};
function write(n,value){fs.writeFileSync(path.join(__dirname,n),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return fact(base+'/'+n)}
const freeze=read('helper-successors-static-freeze-05.json');assert.equal(freeze.status,'PASS_STATIC_SYNTAX_HASH_ONLY_TEMPLATES_UNBOUND_UNEXECUTED');for(const r of freeze.records){const f=fact(base+'/'+r.path);assert.equal(f.bytes,r.bytes);assert.equal(f.sha256,r.sha256)}
const bridge=require('./metadata-equivalence-guard-02.cjs').check();
function bind(template,target,values){let text=fs.readFileSync(path.join(__dirname,template),'utf8');for(const [key,value]of Object.entries(values)){assert(text.includes(key),key);text=text.replaceAll(key,value)}assert(!text.includes('__F25_'),target+' has unbound placeholders');return write(target,text)}
if(mode==='acceptance'){
 const bound=bind('prepare-acceptance-03.template.cjs','prepare-acceptance-03.cjs',{'__F25_ACCEPTANCE_TEMPLATE_BOUND__':'F25_FINAL_ACTUAL_EVIDENCE_REVIEWED'});
 console.log(JSON.stringify(write('acceptance-helper-binding-03.json',{status:'ROOT_REVIEWED_ACTUAL_EQUIVALENCE_ACCEPTANCE_HELPER_BOUND_NOT_EXECUTED',bound,metadataEquivalence:bridge.proof,time:new Date().toISOString()})));
}else{
 const binding=read('byte-proof-binding-required-05.json');binding.status='F25_CURRENT_ACCEPTANCE_AND_EXPLICIT_SCOPE_BOUND';binding.metadataEquivalence=bridge.proof;binding.fixtureCorrection=bridge.fixtureCorrection;
 binding.acceptanceSha256=fact(base+'/f25-acceptance-01.json').sha256;binding.sourceQueueSha256=fact('docs/soterai-lite/FEATURE-QUEUE.json').sha256;binding.sourceLedgerSha256=fact('docs/soterai-lite/ledger.md').sha256;binding.sourcePathsReviewedAgainstCurrentGitDiff=true;
 const roles={focused:'log-runtime-combined-02.txt',rawBudget:'raw-budget-tests-02.txt',readiness:'readiness-tests-01.txt',package:'package-01.txt',nativeAggregate:'native-gates-01.txt'};
 for(const r of binding.requiredGatePaths)if(Object.hasOwn(roles,r.role))r.rawPath=base+'/'+roles[r.role];
 assert(!JSON.stringify(binding).includes('__F25_'),'Binding still has placeholders');
 const bindingFact=write('byte-proof-binding-current-03.json',binding),copies=[];
 for(const name of ['scoped-git-lib','current-acceptance-guard','prepare-source-commit','commit-source','prepare-transition','commit-transition']){
  const values={'__F25_BYTE_PROOF_BOUND__':'F25_CURRENT_BYTE_PROOF_FACTS_BOUND'};if(name==='scoped-git-lib')values.__F25_BYTE_PROOF_BINDING_SHA256__=bindingFact.sha256;
  copies.push(bind(name+'-05.template.cjs',name+'-05.cjs',values));
 }
 const checked=require('./current-acceptance-guard-05.cjs').check();
 console.log(JSON.stringify(write('byte-helpers-binding-03.json',{status:'ROOT_REVIEWED_CURRENT_BYTE_HELPERS_BOUND_ACCEPTANCE_GUARD_PASS_NO_GIT_MUTATION',binding:bindingFact,copies,checked,time:new Date().toISOString()})));
}
