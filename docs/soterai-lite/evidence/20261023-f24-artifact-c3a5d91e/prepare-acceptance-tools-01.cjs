'use strict';
// Preparation only; all actual gates remain required by the generated checkers.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const old=path.resolve(__dirname,'../20261023-f23-history-62d09fb1');
const read=name=>fs.readFileSync(path.join(old,name),'utf8');
const put=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
function replace(text,from,to){assert(text.includes(from),'Expected template input absent: '+from);return text.replaceAll(from,to);}
let a=read('prepare-acceptance-02.cjs');
for(const [from,to] of [
 ['check-inputs-03.cjs','check-inputs-02.cjs'],['F23','F24'],['f23','f24'],
 ['full-tests-02.txt','full-tests-01.txt'],['tests:3471,pass:3467','tests:3570,pass:3566'],
 ['tests:163,pass:163,fail:0,cancelled:0,skipped:0','tests:148,pass:147,fail:0,cancelled:0,skipped:1'],
 ['typecheck-04.txt','typecheck-02.txt'],['readiness-tests-02.txt','readiness-tests-01.txt'],
 ['serial-gates-02.txt','serial-gates-01.txt'],['history-native-run-02.txt','artifact-native-run-02.txt'],
 ["[['serial','02'],['native','02']]","[['serial','01'],['native','02']]"],
 ['inspection.machineSettings,79','inspection.machineSettings,80'],['soterai.lite.historyScanner','soterai.lite.artifactScanner'],
 ['affected.runs.length,12','affected.runs.length,13'],['/f24-history-native-','/f24-artifact-native-'],
 ['Actual history25 required','Actual artifact25 required'],
 ['32commits+sentinel/128unique regular blobs/64KiB each/1MiB bodies/4MiB process metadata/4096entries/60sec; caps,binary,unsupported remain PARTIAL or withheld.','128files/64KiB each/1MiB total/60sec; strict embedded v3 maps; caps,binary,unknown and reserved paths PARTIAL or withheld.'],
 ['Read-only reachable history, opaque independently keyed references and manual rotation/removal guidance only.','Owner-reviewed bounded local artifacts/copies/maps, independently keyed metadata, manual cleanup guidance and guarded publication only.']
])a=replace(a,from,to);
a=replace(a,"receipt('verify-native-rebuild-run-02.txt'));","receipt('verify-native-rebuild-run-02.txt'),receipt('native-execution-gates-02.txt'),receipt('prepared-validation-run-03.txt'));");
put('prepare-acceptance-02.cjs',a);
let b=read('verify-acceptance-bindings-03.cjs');
for(const [from,to] of [
 ['check-inputs-03.cjs','check-inputs-02.cjs'],['source-inputs-03.json','source-inputs-02.json'],
 ['F23','F24'],['f23','f24'],['host-version-review-02.json','host-version-review-01.json'],
 ['d35a4ed86140054ca258fa65d1079bc1bd3ff0b48e97fcdd99b263a0cfed5999','fd19ddd440164b540bdf786b6cded0f8aea0c6a2bab2175847e782355a3bdaa2'],
 ['7b61247bd80b789e76e84f80848d4a592d20c177734b6d93a5a32b667eab7503','b68799a1eed4bd86061f0077e9eb042690da0238f6b03518d0a2cfb307426b29'],
 ["const expectedAffected=['affected-mcp-run-01'","const expectedAffected=['affected-history-run-01','affected-mcp-run-01'"],
 ['records.length,41','records.length,44'],['usedSnapshots.size,41','usedSnapshots.size,44'],
 ['native.length,12','native.length,13'],['phaseCount,24','phaseCount,26'],['nativeChecks,358','nativeChecks,383'],
 ['successfulNativeFamilies:12','successfulNativeFamilies:13'],['successfulNativePhases:24','successfulNativePhases:26'],['successfulNativeChecks:358','successfulNativeChecks:383'],
 ['snapshotFiles:41','snapshotFiles:44'],['nativeFamilies:12,phases:24,nativeChecks:358,snapshots:41','nativeFamilies:13,phases:26,nativeChecks:383,snapshots:44'],
 ['failedResult.passed,18','failedResult.passed,20'],['failedResult.failed,3','failedResult.failed,1'],
 ['passed:18,failed:3','passed:20,failed:1'],['earlier failed history18PASS3FAIL','earlier failed artifact20PASS1FAIL'],
 ['f24-history-native-20261023T131450Z-89d49373','f24-artifact-native-20261023T183901Z-f4c5cf35'],
 ["own('durable-'+kind+'-exit-02.json')","own('durable-'+kind+'-exit-'+(kind==='serial'?'01':'02')+'.json')"],
 ["'f24-acceptance-03.json'","'f24-acceptance-01.json'"]
])b=replace(b,from,to);
const begin=b.indexOf('const families=['),end=b.indexOf('\nassert.deepEqual(prior.nativeSummaries',begin);assert(begin>=0&&end>begin);
const familyCode=`const roles=[
 ['lite-artifact-host.js',{primary:21,restart:4}],['lite-history-host.js',{primary:21,restart:4}],
 ['lite-mcp-host.js',{primary:21,restart:4}],['lite-editor-host.js',{primary:21,restart:4}],
 ['lite-ci-host.js',{primary:21,restart:4}],['lite-service-account-host.js',{primary:21,restart:4}],
 ['lite-registry-host.js',{primary:21,restart:4}],['lite-terraform-host.js',{primary:21,restart:4}],
 ['lite-container-host.js',{primary:21,restart:4}],['lite-source-host.js',{primary:18,restart:3}],
 ['lite-hygiene-host.js',{primary:18,restart:3}],['lite-vault-host.js',{save:6,reload:4}],
 ['lite-broker-host.js',{primary:103,restart:3}]
];
const candidates=fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()&&row.name.startsWith('f24-')&&fs.existsSync(path.join(__dirname,row.name,'summary.json'))).map(row=>row.name);
assert.equal(candidates.length,13,'Exactly thirteen successful native families are required.');
const families=roles.map(([driver,expected])=>{const hash=e.fact(own('prebuilt-native-hosts-02/'+driver)).sha256;const found=candidates.filter(name=>read(name+'/freeze.json').hostProbeSha256===hash);assert.equal(found.length,1,driver);return [found[0],expected];});
assert.equal(new Set(families.map(row=>row[0])).size,13);`;
b=b.slice(0,begin)+familyCode+b.slice(end);
const affectedBegin=b.indexOf("const affectedName='affected-"),affectedEnd=b.indexOf(",affectedRoot=own(affectedName)",affectedBegin);assert(affectedBegin>=0&&affectedEnd>affectedBegin);
b=b.slice(0,affectedBegin)+"const affectedCandidates=fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()&&row.name.startsWith('affected-')&&fs.existsSync(path.join(__dirname,row.name,'affected-summary-01.json')));assert.equal(affectedCandidates.length,1);\nconst affectedName=affectedCandidates[0].name"+b.slice(affectedEnd);
const anchor="  if(name.startsWith('f24-history-native-')){";
assert(b.includes(anchor));
b=b.replace(anchor,`  if(name.startsWith('f24-artifact-native-')){
   assert.equal(result.referencedContentReads,0);assert(result.observedFileCalls>0);
   if(row.phase==='primary'){assert(result.artifactContentReads>0);assert(result.caseVariantContentMatches>0);}
  }
`+anchor);
put('verify-acceptance-bindings-01.cjs',b);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED_F24_ACCEPTANCE',expectedNativeFamilies:13,expectedChecks:383,expectedPhases:26,expectedSnapshots:44}));
