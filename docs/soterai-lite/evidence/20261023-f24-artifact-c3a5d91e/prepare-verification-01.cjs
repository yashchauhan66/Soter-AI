'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/'),prior=path.join(repo,'docs/soterai-lite/evidence/20261023-f23-history-62d09fb1');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
const write=(name,bytes)=>fs.writeFileSync(path.join(__dirname,name),bytes,{flag:'wx'});
const fact=file=>{const bytes=fs.readFileSync(path.resolve(repo,file));return {path:file,bytes:bytes.length,sha256:sha(bytes)};};
function receipt(name){const value=read(name+'.result.json'),raw=fact(base+'/'+name);assert.equal(value.sha256.toLowerCase(),raw.sha256);return {raw,receipt:fact(base+'/'+name+'.result.json'),exitCode:value.exitCode};}
function counts(name){const text=fs.readFileSync(path.join(__dirname,name),'utf8'),out={};for(const key of ['tests','pass','fail','cancelled','skipped']){const rows=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(rows.length,1);out[key]=+rows[0][1];}return out;}
assert.deepEqual(counts('focused-02.txt'),{tests:148,pass:147,fail:0,cancelled:0,skipped:1});assert.equal(receipt('focused-02.txt').exitCode,0);
// Preserve the previous inventory implementation, adding the generated document
// as an explicit current input. No prior source/full/native result is inherited.
let library=fs.readFileSync(path.join(prior,'input-lib-01.cjs'),'utf8');
library=library.replace("'docs/soterai-lite/MASTER-PROMPT-20261016.txt'","'docs/soterai-lite/MASTER-PROMPT-20261016.txt','docs/vscode-extension-readiness.md'");
write('input-lib-01.cjs',library);const inputs=require('./input-lib-01.cjs');
const records=inputs.inventory().map(inputs.fact),old=JSON.parse(fs.readFileSync(path.join(prior,'source-inputs-03.json'),'utf8'));
for(const name of ['docs/soterai-lite/LITE-CATALOG.json','docs/soterai-lite/MASTER-PROMPT-20261016.txt'])assert.deepEqual(inputs.fact(name),old.records.find(row=>row.path===name));
write('source-inputs-01.json',JSON.stringify({status:'FROZEN_CURRENT_F24_INPUTS_NOT_ACCEPTED',records,scope:'Exact current product/tests/build/dependencies/docs; includes unrelated retained physical input bytes without staging them. No old result transferred.'},null,2)+'\n');
write('check-inputs-01.cjs',"const e=require('./input-lib-01.cjs');console.log(JSON.stringify({status:'EXACT_CURRENT_INPUTS',files:e.check()}));\n");
const reviewBytes=fs.readFileSync(path.join(prior,'host-version-review-02.json')),review=JSON.parse(reviewBytes);
for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles]){const bytes=fs.readFileSync(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256,'Installed editor changed; new explicit host review required');}
write('host-version-review-01.json',reviewBytes);
write('host-static-rebinding-01.json',JSON.stringify({status:'CURRENT_INSTALLED_BYTES_MATCH_PRIOR_REVIEW_STATIC_ONLY',original:fact(path.relative(repo,path.join(prior,'host-version-review-02.json')).replaceAll('\\','/')),version:review.currentHost.version,scope:'Exact original installed API review bytes retained; executable and all reviewed application bytes rechecked now. F24 native behavior NOT_RUN. No update/download/host result transfer.',time:new Date().toISOString()},null,2)+'\n');
let builder=fs.readFileSync(path.join(__dirname,'build-native-hosts-01.template.cjs'),'utf8');
for(const [token,value] of Object.entries({__F24_TEMPLATE_BOUND__:'F24_CURRENT_FACTS_BOUND',__F24_NATIVE_HOST_OUTPUT_DIR__:'prebuilt-native-hosts-01',__F24_NATIVE_DRIVER_PROVENANCE_JSON__:'native-driver-provenance-01.json'}))builder=builder.replaceAll(token,value);
assert(!builder.includes('__F24_'));write('build-native-hosts-01.cjs',builder);
const serial=String.raw`$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
function Invoke-F24Gate([string]$Name,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & node (Join-Path $PSScriptRoot 'check-inputs-01.cjs')
 if($LASTEXITCODE -ne 0){throw 'Current source/test/build input drift.'}
 & $taskRunner -FilePath node -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot ($Name+'.txt')) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.txt.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('Gate failed; evidence retained: '+$Name)}
}
Invoke-F24Gate 'typecheck-02' @('node_modules/typescript/bin/tsc','-p','packages/vscode-extension/tsconfig.json','--noEmit')
Invoke-F24Gate 'readiness-tests-01' @('--import','tsx','--test','--test-concurrency=1','packages/vscode-extension/src/__tests__/readiness-doc.test.ts')
Invoke-F24Gate 'full-tests-01' @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
Invoke-F24Gate 'backend-typecheck-01' @('node_modules/typescript/bin/tsc','--noEmit','-p','apps/local-ai-broker/tsconfig.json')
Invoke-F24Gate 'backend-tests-01' @('--import','tsx','--test','--test-concurrency=1','apps/local-ai-broker/src/__tests__/*.test.ts')
Invoke-F24Gate 'build-native-hosts-run-01' @((Join-Path $PSScriptRoot 'build-native-hosts-01.cjs'),'prebuilt-native-hosts-01')
Invoke-F24Gate 'package-01' @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f24-20261023-attempt01.vsix')
& node (Join-Path $PSScriptRoot 'check-inputs-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Input drift after current serial gates.'}
@{status='PASS_CURRENT_SERIAL_F24_COMPONENT_GATES_NATIVE_PENDING';scope='Current compiler/full/backend/native fixture build/new exact package only; actual native acceptance and byte barriers remain required.'}|ConvertTo-Json
exit 0
`;
write('run-serial-gates-01.ps1',serial);
write('run-serial-entry-01.ps1',String.raw`$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
& (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1') -FilePath powershell -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-serial-gates-01.ps1')) -OutputFile (Join-Path $PSScriptRoot 'serial-gates-01.txt') -WorkingDirectory $taskRepo
exit $LASTEXITCODE
`);
let start=fs.readFileSync(path.join(prior,'start-durable-serial-02.ps1'),'utf8').replaceAll('serial-start-02','serial-start-01').replaceAll('serial-entry-02','serial-entry-01').replaceAll('serial-stdout-02','serial-stdout-01').replaceAll('serial-stderr-02','serial-stderr-01');write('start-durable-serial-01.ps1',start);
let close=fs.readFileSync(path.join(prior,'confirm-owned-runner-03.ps1'),'utf8').replaceAll("{'02'}","{'01'}");write('confirm-owned-runner-01.ps1',close);
const gates=['publication-baseline-01.txt','content-baseline-01.txt','content-baseline-02.txt','ledger-baseline-01.txt','ledger-tests-01.txt','controller-commands-baseline-01.txt','content-publication-tests-01.txt','content-publication-tests-02.txt','controller-commands-tests-01.txt','controller-isolation-diagnostic-01.txt','policy-coexistence-baseline-01.txt','controller-commands-tests-02.txt','content-review-baseline-03.txt','focused-01.txt','focused-02.txt','typecheck-01.txt','generate-readiness-01.txt','prepare-native-templates-run-01.txt'].map(receipt);
const progress={status:'F24_IMPLEMENTED_COMPONENT_GATES_PASS_FULL_NATIVE_BYTE_GATES_PENDING',feature:'F24',parent:'af50adade9ce01efb0760cb3c96767f1a63fd793',inputs:records.length,focused:counts('focused-02.txt'),controller:counts('controller-commands-tests-02.txt'),contentPublication:counts('content-publication-tests-02.txt'),ledger:counts('ledger-tests-01.txt'),gates,effectiveProductCorrectionRounds:3,
 failures:'All prior failures retained. Contentbaseline01 test child EPERM, actual missingmodule28FAIL under approved execution. UI/controller57missingmoduleFAIL. Product correction1:avoid double generic redaction/normalize canonical region marker for source parser. Fixture flags use inspect.globalValue; old unquoted dynamic source control now static quoted literal, same assertions. Correction2:avoid106k source identity walks at128files; all per-read guards, final hashes and endpoint identity checks retained; intentional policy/editor/store skips countedPARTIAL. CJS fixture uses CJS syntax; one mutable discovery mock removes demonstrated nested-mock interference. Correction3:4regressions0PASS4FAIL for ignored source literals/forged markers/inline maps, now covered by currentfocusedPASS. Initialcombined148tests146PASS1FAIL1SKIP was unchanged preexisting public-workspace immutable assignment exception under root execution; proper established Litecwd gives147PASS1SKIP with exact same source. CWD-dependent strict-mode/transform configuration is a supported inference, not established internals or regrade.',
 scope:'Bounded readonly synthetic local artifact/source-map/copy analysis and canonical keyed artifact-v1 metadata. Strict machine flag gates scans and new publication. Recognized static source/text placeholders; maps and mapping URLs withheld from release. No original edits, reference/build/config execution, cleanup, vault mutation, recall, OS boundary, perfect detection, human or independent claim. Three product rounds used; no next feature before actual full/newVSIX/content/affectednative/withdrawal/scoped source+transition byte proofs.',time:new Date().toISOString()};
write('progress-01.json',JSON.stringify(progress,null,2)+'\n');
fs.appendFileSync(path.join(repo,'docs/soterai-lite/ledger.md'),'\n\n## STEP RECEIPT F24-IMPLEMENTED /148 focused147PASS1SKIP; fresh serial verification prepared\n\n'+base+'/progress-01.json binds '+records.length+'currentinput bytes/allrawreceipt hashes. Actualpublicationbaseline6tests1PASS5FAIL/missingContent28FAIL/controllercommands57FAIL/artifactdomain3FAIL retained. Currentcontentpublication48tests47PASS1SKIP/controllercommands58PASS/ledger18PASS/compiler01PASS predatesfinalsourceguard. Three effective bounded product correction rounds used: canonicalpublicationavoidpost-redaction+regionmarker; controllernonquadraticendpointchecks+explicitreservedpolicy/editor/storePARTIALskips; 4beforeFAIL ignoredsource-literal/forgedmarker/inlinemap guards. Initial148combined146PASS1FAIL1SKIP from existing immutable-assignment throw underrootcwd retained; unchangedcurrentcode inestablishedLitecwd148tests147PASS1SKIP, no regrade. Frozen'+records.length+'inputs/generatedreadinessrefresh/currentinstalledCode1.143.1bytesmatcholdstaticAPIreview. New13driver22unboundtemplatesprepared/syntaxvalidationpending; no currentVSIX/native/full resultyet. Currentserial01 prepared compiler02/readiness/full01/backend/nativebuild/newuniqueVSIX sequentially; executeonlyafterPSsyntax/currentinputschecks. F24ACTIVE/F25notstarted; no rating/LOW/L6HUMAN-ACTIONSSTOP/diskwaiver/unrelatedwork persist.\n');
const qfile=path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'),q=JSON.parse(fs.readFileSync(qfile,'utf8'));assert.equal(q.activeFeature,'F24');q.features.find(row=>row.id==='F24').progressEvidence=base+'/progress-01.json';fs.writeFileSync(qfile,JSON.stringify(q,null,2)+'\n');
console.log(JSON.stringify({status:progress.status,inputs:records.length,focused:progress.focused,serial:'PREPARED_NOT_EXECUTED'}));
