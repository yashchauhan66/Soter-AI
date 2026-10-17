const h=require('./f10-evidence-lib.cjs'),{fs,path,repo,own,read,hash,tap}=h;
const nativeDir=process.argv[2],affectedDir=process.argv[3];
if(!/^f10-native-host-[A-Za-z0-9-]+$/.test(nativeDir??'')||!/^affected-[A-Za-z0-9-]+$/.test(affectedDir??''))throw new Error('Explicit current run directories required');
const fact=p=>({path:p,sha256:hash(own(p))});
const artifactPath='packages/soterai-lite/soterai-lite-0.7.0-f10-20261017-attempt03.vsix';
const summary=read(own(affectedDir+'/affected-summary-01.json'));
const insideFact=file=>{const rel=path.relative(__dirname,file).replaceAll('\\','/');if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('External result not retained in F10');return fact(rel);};
const focused=tap(own('final-focused-06.txt')),full=tap(own('full-tests-05.txt'));
const checks=[['focused','final-focused-06.txt',focused],['typecheck','typecheck-10.txt'],['full','full-tests-05.txt',full],['readiness','readiness-01.txt'],['package','package-04.txt'],['hostBuild','host-build-02.txt'],['native','native-launch-04.txt'],['affected','affected-launch-05.txt']].map(([role,log,expected])=>({role,log,...(expected?{kind:'tap',expected}:{})}));
const facts={schemaVersion:1,feature:'F10',parentCommit:'24da9ce9907cd6082b7ce3a3e79136cd4c551508',artifact:{path:artifactPath,sha256:hash(path.join(repo,artifactPath))},inspection:fact('vsix-inspection-04.json'),checks,focusedPartition:{f10:focused.tests-76,extensionParity:76},
 native:{summary:fact(nativeDir+'/summary.json'),freeze:fact(nativeDir+'/freeze.json'),primary:fact(nativeDir+'/primary-results.json'),restart:fact(nativeDir+'/restart-results.json'),probe:fact('prebuilt-native-host-02/lite-powershell51-host.js')},
 affected:{summary:fact(affectedDir+'/affected-summary-01.json'),comparison:fact(affectedDir+'/security-comparison-01.json'),functional:insideFact(summary.functionalResult),security:insideFact(summary.securityResult)},
 reviews:['source-review-git-final-02-receipts.md','source-review-publication-final-01.md','native-fixture-correction-04.md','command-controller-review-02.json','source-review-root-listing-01.md','source-review-root-listing-02.md','root-listing-fixture-correction-01.md','transition-tooling-review-02.md','root-final-disposition-01.md'].map(fact),reviewDisposition:'NO_OPEN_SCOPED_BLOCKERS',
 priorEvidence:['acceptance-preflight-01.txt','acceptance-preflight-01.txt.result.json','f09-byte-verification-launch-01.txt','f09-byte-verification-launch-01.txt.result.json','f09-transition-allowlist-01.txt','f09-transition-byte-verification-01.json','f09-transition-commit-01.txt','f09-transition-verification-launch-01.txt','f09-transition-verification-launch-01.txt.result.json'].map(n=>'docs/soterai-lite/evidence/20261015-f09-runtime-81e65c2a/'+n)};
fs.writeFileSync(own('final-bindings-02.json'),JSON.stringify(facts,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'FINAL_FACTS_BOUND_NOT_ACCEPTED',nativeDir,affectedDir,focused:focused.tests,full:full.tests,artifact:facts.artifact.sha256}));
