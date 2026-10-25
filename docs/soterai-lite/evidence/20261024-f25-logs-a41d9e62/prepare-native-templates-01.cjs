'use strict';
// Preparation only. Reads named pinned F24 evidence; writes NEW unbound docs.
// Does not import/evaluate generated code or start compiler/build/editor/network.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),prior=path.join(repo,'docs/soterai-lite/evidence/20261023-f24-artifact-c3a5d91e');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins=[
 ['host-current-binding-02.ps1',2514,'6802a769db92cfeb18ec48509e06522adce39bdb0d24bdb8d311f28bdcd9e16c'],
 ['artifact-binding-01.ps1',3570,'d925ce0d1e9330f2f6af97d030f1cae4e82a2cc136912c1e265458435639ded7'],
 ['inspect-vsix-01.ps1',26412,'9970f7ad5967540e354ba8cd49866c2f294133d9e90bbc8160e16aff9fe816fc'],
 ['run-artifact-native-02.ps1',18185,'209a7edfd823764e2cae86bb2620a05d417afc18f86a4217858ff1dcbdd4e6e8'],
 ['run-affected-history-02.ps1',18203,'b7ba7cc980fe1926410b5edc363d91f8fa6f6b555363929ee184a57ecb79b0a7'],
 ['run-mcp-native-02.ps1',18199,'e4d478972c6f55cf4c1b82fecd627966eda8101d834410dd7cf13368d291c028'],
 ['run-affected-editor-02.ps1',18204,'d015301bd9d28113db5dd414db45f36ae2ebd018f67cc85f5eb70b8d6ff0aae2'],
 ['run-affected-ci-02.ps1',18192,'39a9596df6908ceb5828c9b52e708a95e61cb1b4f96a8dd3a7758527f6f7e142'],
 ['run-affected-service-account-02.ps1',18231,'509b5e65afc9f99838362bba2c14f6d524217f14c0f183687cd8465e324c035f'],
 ['run-affected-registry-02.ps1',18210,'9d11bc92b4ef9d3109eced0417cfe7b068bc677e8f0f5ab30c6c06ea1e56f7fd'],
 ['run-affected-terraform-02.ps1',18213,'64413a47cda441d5ec7b58bc42587ceeff1853d228b14e8905c15bd78cb839a4'],
 ['run-affected-container-02.ps1',18213,'f5f7d2ad89a8ab1e244f19103f705dbc465bef3b59e9c2f8a1905cc149d09dd8'],
 ['run-affected-source-02.ps1',18215,'a555ced8e9d11e56520c1edf4d615e2978a37650f8be3b1bd47f240192a41c29'],
 ['run-affected-hygiene-02.ps1',18216,'b28c8048ce744f2e7663ae89379eaf7a0268d3e6eb8672cd793b402e4d62a639'],
 ['run-affected-vault-02.ps1',18240,'7763da791233821a18f87bd1aa499eddbbfa86fee4431c6e6be9bd374f86da64'],
 ['run-retained-native-02.ps1',18254,'be01f6be90c32439b2134d9cd14a54faa801d9b83ba92000e770be1fc81ccbf0'],
 ['run-affected-hosts-02.ps1',9629,'ab1fa79b2107af73a33281317194a85fa53e85c11137d695d185bc329387c4ab'],
 ['run-functional-03.ps1',9840,'8c894dbfb8f85793f36aecb011ce4c64167967d01532b199bbd1a29e4cb8b6d7'],
 ['run-security-03.ps1',10826,'62ea37f9a0bb1cc25d8483a56e1dac3c560e9e53bb4e6fd130271b9966997c17'],
 ['run-current-affected-suite-02.ps1',4466,'a1546871a0a5b6bb94213e0b24087d1060c2f2c8a933945b560b9ad25dd860dd'],
 ['run-native-gates-02.ps1',2861,'3f0ca4a084e6e47c7b097705971c5baa94ec65d1f84f26ae6306858697dd8235'],
 ['build-native-hosts-02.cjs',3460,'dbbcdd70d7a81b31a7041ef48358fc0e8501d555f64621953dda18cb7cfcc2c9'],
];
const original=new Map();
for(const [name,bytes,digest] of pins){const raw=fs.readFileSync(path.join(prior,name));assert.equal(raw.length,bytes,name);assert.equal(sha(raw),digest,name);assert(!raw.includes(0),'NUL in retained input: '+name);original.set(name,raw.toString('utf8'));}
const names=new Map(pins.map(([n])=>[n,n.replace(/-(?:02|03)\.(ps1|cjs)$/,'-01.$1')]));
function exact(s,a,b,n=1){assert.equal(s.split(a).length-1,n,'Marker count: '+a);return s.replaceAll(a,b);}
function common(s){
 for(const [a,b] of names)s=s.replaceAll(a,b);
 return s.replaceAll('20261023-f24-artifact-c3a5d91e','20261024-f25-logs-a41d9e62').replaceAll('F24','F25').replaceAll('f24','f25')
  .replaceAll("'F25_CURRENT_FACTS_BOUND' -cne", "'__F25_TEMPLATE_BOUND__' -cne")
  .replaceAll("'F25_CURRENT_FACTS_BOUND' !==", "'__F25_TEMPLATE_BOUND__' !==")
  .replaceAll('source-inputs-02.json','__F25_NATIVE_INPUTS_JSON__')
  .replaceAll('host-version-review-01.json','__F25_HOST_VERSION_REVIEW_JSON__')
  .replaceAll('prebuilt-native-hosts-02','__F25_NATIVE_HOST_OUTPUT_DIR__')
  .replaceAll('native-driver-provenance-02.json','__F25_NATIVE_DRIVER_PROVENANCE_JSON__')
  .replaceAll('vsix-extracted-01/extension','__F25_EXTRACTED_EXTENSION_RELATIVE__')
  .replaceAll('C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe','__F25_EDITOR_EXECUTABLE__')
  .replaceAll('4d9181b82235ef1e579bd97e60a01fa42839f31b346e05f24751f2120e1b6323','__F25_FULL_GATE_RESULT_SHA256__')
  .replaceAll('full-tests-01.txt.result.json','__F25_FULL_GATE_RESULT_JSON__')
  .replaceAll('docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/full-tests-01.txt','__F25_FULL_GATE_RAW_RELATIVE__');
}
const outputs=new Map(),templates=[];
function add(name,text,source){
 assert(!outputs.has(name),name);assert(!text.includes('\0'),'NUL in generated '+name);
 assert(!/Stop-Process|taskkill|(?:\.kill|\.Kill|process\.kill)\s*\(|TerminateProcess|WaitForExit\s*\(\s*-1\s*\)/.test(text),'Signals/indefinite wait in '+name);
 assert(text.includes('__F25_TEMPLATE_BOUND__'),'Missing failguard in '+name);
 outputs.set(name,Buffer.from(text));templates.push({template:name,materializeAs:name.replace('.template.','.'),source,bytes:Buffer.byteLength(text),sha256:sha(text),placeholders:[...new Set(text.match(/__F25_[A-Z0-9_]+__/g)||[])].sort()});
}
function preserve(before,after,name){
 for(const witness of ['UseShellExecute','EnvironmentVariables.Clear()','CreateNoWindow','WindowStyle','RedirectStandardOutput','RedirectStandardError','WaitForExit','stdoutEOF','stderrEOF','signalsRequested=0','INCOMPLETE','CreateNew','NoClobber','Assert-F15bRuntimeBinding','ExpectedVsixSha256','ExpectedBundleSha256'])if(before.includes(witness))assert(after.includes(witness),'Safety witness lost '+name+': '+witness);
}
for(const [name,source] of original){
 let text=common(source);
 if(name==='host-current-binding-02.ps1'){
  text=exact(text," $taskFrozen=Get-Content",` if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '__F25_NATIVE_INPUTS_JSON__') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_NATIVE_INPUTS_SHA256__'){throw 'Final native source/test/build freeze changed or remains unbound.'}
 $taskDriverProvenance=Join-Path $PSScriptRoot '__F25_NATIVE_DRIVER_PROVENANCE_JSON__'
 if((Get-FileHash -LiteralPath $taskDriverProvenance -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_NATIVE_DRIVER_PROVENANCE_SHA256__'){throw 'Current built driver provenance changed or remains unbound.'}
 $taskDrivers=Get-Content -LiteralPath $taskDriverProvenance -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskDrivers.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskDrivers.drivers).Count -ne 20){throw 'Twenty current built native drivers required.'}
 foreach($taskDriver in $taskDrivers.drivers){$taskBuilt=Join-Path $PSScriptRoot $taskDriver.path;if((Get-Item -LiteralPath $taskBuilt).Length -ne $taskDriver.bytes -or (Get-FileHash -LiteralPath $taskBuilt -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskDriver.sha256){throw 'Current native driver output bytes changed.'}}
 $taskFrozen=Get-Content`);
  text=exact(text," $taskReview=Get-Content",` if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '__F25_HOST_VERSION_REVIEW_JSON__') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F25_HOST_VERSION_REVIEW_SHA256__'){throw 'Fresh F25 installed-host review changed or remains unbound.'}
 $taskReview=Get-Content`);
  text=exact(text," $taskHost=$taskReview.currentHost",` $taskHost=$taskReview.currentHost
 if($taskHost.executable.sha256 -cne '325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6' -or $taskHost.executable.bytes -ne 238249784){throw 'Current reviewed Code1.143.1 executable pin differs; stop for fresh inspection.'}
 if([IO.Path]::GetFullPath($taskHost.executable.path) -ine [IO.Path]::GetFullPath('__F25_EDITOR_EXECUTABLE__')){throw 'Fresh reviewed executable path differs.'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskHost.executable.path)){throw 'Requested Code path differs from the current reviewed host.'}`);
 }
 if(name==='artifact-binding-01.ps1'){
  text=exact(text," if([IO.Path]::GetFileName($taskBindingVsix)"," if([IO.Path]::GetFullPath($taskBindingVsix) -ine [IO.Path]::GetFullPath((Join-Path $taskBindingRepo 'packages/soterai-lite/soterai-lite-0.7.0-f25-20261024-attempt01.vsix'))){throw 'Only the planned NEW F25 attempt01 artifact is admitted; no F24 substitution.'}\n if([IO.Path]::GetFileName($taskBindingVsix)");
 }
 if(name==='inspect-vsix-01.ps1'){
  text=exact(text,"$taskFlag=$taskProperties.'soterai.lite.artifactScanner'","$taskFlag=$taskProperties.'soterai.lite.logProtection'");
  text=exact(text,'Count -ne 80','Count -ne 81');text=exact(text,'requires 80 machine','requires 81 machine');
  text=exact(text,"Where-Object{$_ -ceq 'soterai.lite.artifactScanner'}","Where-Object{$_ -ceq 'soterai.lite.logProtection'}");
  text=exact(text,"runtimeFlag='soterai.lite.artifactScanner'","runtimeFlag='soterai.lite.logProtection'");
  text=exact(text,"@('soterai.reviewArtifacts'","@('soterai.reviewLogs','soterai.logProtectionStatus','soterai.reviewArtifacts'",3);
  text=exact(text," $taskHistoryFlag=",` $taskArtifactFlag=$taskProperties.'soterai.lite.artifactScanner'
 if($taskArtifactFlag.type -cne 'boolean' -or $taskArtifactFlag.default -ne $true -or $taskArtifactFlag.scope -cne 'machine' -or @($Manifest.capabilities.untrustedWorkspaces.restrictedConfigurations|Where-Object{$_ -ceq 'soterai.lite.artifactScanner'}).Count -ne 1){throw 'Existing restricted machine artifact setting must remain present.'}
 $taskHistoryFlag=`);
  text=exact(text,"Assert-F25Contained $taskLiteRoot $taskVsix",`if($taskVsix -ine [IO.Path]::GetFullPath((Join-Path $taskLiteRoot 'soterai-lite-0.7.0-f25-20261024-attempt01.vsix'))){throw 'Exact new F25 planned artifact path required.'}
Assert-F25Contained $taskLiteRoot $taskVsix`);
  text=exact(text,'# Recheck all source inputs and artifact pointers after inventory collection.',`foreach($taskRequiredF25Input in @('packages/vscode-extension/src/logs/LogContent.ts','packages/vscode-extension/src/logs/ManagedLogCollector.ts','packages/vscode-extension/src/logs/LogController.ts','packages/vscode-extension/src/logs/LogFlags.ts','packages/core/src/StreamingOutputNormalizer.ts')){
 if(@($taskVerifiedInputs|Where-Object{$_.path -ceq $taskRequiredF25Input}).Count -ne 1){throw ('Current F25 runtime provenance missing: '+$taskRequiredF25Input)}
}
# Recheck all source inputs and artifact pointers after inventory collection.`);
 }
 if(name==='build-native-hosts-02.cjs'){
  text=exact(text,"const cp=require('node:child_process');",`const crypto=require('node:crypto'),assert=require('node:assert/strict');
const cp=require('node:child_process');`);
  text=exact(text,"const {parserBundleOptions}",`const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function checkNativeInputs(){const raw=fs.readFileSync(path.join(__dirname,'__F25_NATIVE_INPUTS_JSON__'));assert.equal(sha(raw),'__F25_NATIVE_INPUTS_SHA256__');const frozen=JSON.parse(raw.toString('utf8').replace(/^\\uFEFF/,''));assert(frozen.records.length>=934);for(const row of frozen.records){const rawInput=fs.readFileSync(path.join(repo,row.path));assert.equal(rawInput.length,row.bytes,row.path);assert.equal(sha(rawInput),row.sha256,row.path);}return frozen;}
checkNativeInputs();
const {parserBundleOptions}`);
  const extra={ 'lite-logs-host':'liteLogs','lite-log-vault-runtime-host':'liteLogVaultRuntime','lite-vault-runtime-host':'liteVaultRuntime','lite-streaming-output-host':'liteStreamingOutput','lite-ps51-host':'litePowerShell51','lite-cmd-host':'liteCmd','lite-gitbash-host':'liteGitBash'};
  text=exact(text,"entryPoints:{'lite-artifact-host':",'entryPoints:{'+Object.entries(extra).map(([key,stem])=>`'${key}':path.join(repo,'packages/vscode-extension/src/__tests__/host/${stem}.host.ts'),`).join('')+"'lite-artifact-host':");
  text=exact(text,"fs.writeFileSync(path.join(__dirname,'__F25_NATIVE_DRIVER_PROVENANCE_JSON__'),",`checkNativeInputs();const drivers=fs.readdirSync(out).filter(name=>name.endsWith('.js')).sort().map(name=>{const raw=fs.readFileSync(path.join(out,name));return {path:path.relative(__dirname,path.join(out,name)).replaceAll('\\\\','/'),bytes:raw.length,sha256:sha(raw)};});assert.equal(drivers.length,20);fs.writeFileSync(path.join(__dirname,'__F25_NATIVE_DRIVER_PROVENANCE_JSON__'),`);
  text=exact(text,"inputs:result.metafile.inputs,outputs:result.metafile.outputs","inputs:result.metafile.inputs,outputs:result.metafile.outputs,drivers");
 }
 if(name==='run-current-affected-suite-02.ps1'){
  const extra=[['artifact','run-artifact-native-01.ps1','lite-artifact-host.js'],['streaming-output','run-affected-streaming-output-01.ps1','lite-streaming-output-host.js'],['vault-runtime','run-affected-vault-runtime-01.ps1','lite-vault-runtime-host.js'],['ps51','run-affected-ps51-01.ps1','lite-ps51-host.js'],['cmd','run-affected-cmd-01.ps1','lite-cmd-host.js'],['gitbash','run-affected-gitbash-01.ps1','lite-gitbash-host.js']];
  text=exact(text,'$taskRows=@(','$taskRows=@(\n'+extra.map(([name,helper,driver])=>` @{name='affected-${name}-run-01';helper='${helper}';driver='${driver}'},`).join('\n'));
  text=text.replace('affectedHistory25/MCP25/','affectedArtifact25/F08-13/F09-12/PS51-19/CMD-19/GitBash-19/History25/MCP25/');
 }
 if(name==='run-native-gates-02.ps1'){
  const start=text.indexOf("$taskArtifactOutput="),end=text.indexOf("$taskAffectedOutput=");assert(start>=0&&end>start);
  const main=[['logs','run-logs-native-01.ps1','lite-logs-host.js'],['owned-output','run-owned-output-native-01.ps1','lite-log-vault-runtime-host.js']].map(([name,helper,driver])=>`Assert-F25EditorHost
$taskCurrentOutput=Join-Path $PSScriptRoot '${name}-native-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot '${helper}'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot '__F25_NATIVE_HOST_OUTPUT_DIR__/${driver}'),'-ExtensionRoot',$taskExtension,'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskCurrentOutput -WorkingDirectory $taskRepo
$taskCurrentReceipt=Get-Content -LiteralPath ($taskCurrentOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskCurrentReceipt.exitCode -ne 0){throw '${name} native failed/incomplete; later affected gates NOT_RUN.'}
`).join('');
  text=text.slice(0,start)+main+text.slice(end);
  text=text.replace('F25 artifact25 and current affected history25/MCP+9/retained106/functional10/security17','F25 savedlogs25/ownedoutput19 and all20 current native families/functional10/security17');
 }
 preserve(source,text,name);
 add(names.get(name).replace(/\.(ps1|cjs)$/,'.template.$1'),text,name);
}
// Added families use the successful F24 exact-runtime/actual-close launcher.
// Their retained host code, payload and assertion oracles are never rewritten.
const launcher=common(original.get('run-artifact-native-02.ps1'));
const families=[
 {name:'logs',target:'run-logs-native-01',env:'F17',stem:'liteLogs',counts:[21,4],marker:null,timeout:240},
 {name:'owned-output',target:'run-owned-output-native-01',env:'F25_OUTPUT',stem:'liteLogVaultRuntime',counts:[19],marker:'.synthetic-lite-f25-owned-output-host'},
 {name:'streaming-output',target:'run-affected-streaming-output-01',env:'F08',stem:'liteStreamingOutput',counts:[13],marker:'.synthetic-lite-f08-host'},
 {name:'vault-runtime',target:'run-affected-vault-runtime-01',env:'F09',stem:'liteVaultRuntime',counts:[12],marker:'.synthetic-lite-f09-host'},
 {name:'ps51',target:'run-affected-ps51-01',env:'F10',stem:'litePowerShell51',counts:[16,3],marker:'.synthetic-lite-f10-host'},
 {name:'cmd',target:'run-affected-cmd-01',env:'F12',stem:'liteCmd',counts:[16,3],marker:'.synthetic-lite-f12-host'},
 {name:'gitbash',target:'run-affected-gitbash-01',env:'F13',stem:'liteGitBash',counts:[16,3],marker:'.synthetic-lite-f13-host'},
];
for(const spec of families){
 let text=launcher.replaceAll('f25-artifact-native-',`f25-${spec.name}-native-`).replaceAll('SOTERAI_LITE_F17_',`SOTERAI_LITE_${spec.env}_`);
 text=exact(text,'# Artifact payload seeding is exclusively owned by liteArtifactScanner.host.ts.',spec.marker?`[IO.File]::WriteAllText((Join-Path $taskWorkspace '${spec.marker}'),'synthetic-only-v1')`:'\u0023 Saved-log payload seeding is exclusively owned by liteLogs.host.ts.');
 if(spec.counts.length===1){
  text=exact(text,"@('primary','restart')","@('single')",2);
  text=exact(text,"['primary', 'restart', 'save', 'reload']","['single']");
  text=exact(text,"$taskCount=if($taskPhase -eq 'primary'){21}else{4}",`$taskCount=${spec.counts[0]}`);
 }else text=exact(text,"$taskCount=if($taskPhase -eq 'primary'){21}else{4}",`$taskCount=if($taskPhase -eq 'primary'){${spec.counts[0]}}else{${spec.counts[1]}}`);
 text=exact(text,'nativeChecks=25','nativeChecks='+spec.counts.reduce((a,b)=>a+b,0));
 if(spec.timeout)text=exact(text,'Elapsed.TotalSeconds -lt 180','Elapsed.TotalSeconds -lt '+spec.timeout);
 if(spec.env==='F25_OUTPUT'){
  text=exact(text,"  const selected = process.env.SOTERAI_LITE_F25_OUTPUT_PHASE;","  const selected = 'single';");
  text=exact(text," $taskInfo.EnvironmentVariables['SOTERAI_LITE_F25_OUTPUT_PHASE']=$taskPhase;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F25_OUTPUT_AMBIENT']='synthetic-ambient-control-must-not-inherit'",' # Dedicated owned-output launcher passes only its four declared fixture variables.');
 }
 if(spec.name==='logs')text=text.replace("'restart-binding.json','f17-mcp-route-receipt.json'","'restart-binding.json','logs-restart.json','f17-mcp-route-receipt.json'");
 text=text.replace('Actual finite owned Node apps plus native CustomExecution and inline debug sessions', 'Actual finite owned Node apps plus native CustomExecution and inline debug sessions');
 preserve(original.get('run-artifact-native-02.ps1'),text,spec.target);
 add(spec.target+'.template.ps1',text,'run-artifact-native-02.ps1 + retained '+spec.stem+'.host.ts phase protocol');
}
const instruction=`# F25 native templates: PREPARED_NOT_BOUND, NOT_EXECUTED

This preparation pins22 named successful F24 evidence sources by exact length/SHA256 and rejects NUL bytes. It writes only new docs-side templates; it never executes generated helpers, compilers, package inspection, editor, build, network, Git or native tests. No F24 package/result is borrowed.

All29 templates have a first executable PREPARED_NOT_BOUND guard. Keep them unchanged. Root must review and create new copies after current full/compiler/backend/readiness and a NEW exact planned packages/soterai-lite/soterai-lite-0.7.0-f25-20261024-attempt01.vsix exist. Do not remove the guard in these retained templates. A new bound builder copy is needed before executable native copies can bind its resulting provenance SHA256.

The builder requires final native-source inputs, including every frozen full/unit/product/build record plus both new host fixtures. The full932-input freeze excludes ONLY liteLogs.host.ts and liteLogVaultRuntime.host.ts; final native freeze must include both actual final bytes (expected934 records), preserve all932, and verify membership as well as byte hashes. Root owns final freeze/check helpers. Builder verifies each frozen file before and after compilation and writes SHA256/byte records for exactly20 current JS drivers. Freeze and build are still NOT_RUN here.

Bind every __F25_*__ placeholder using current receipts. Current full result JSON and raw output hashes, final native-source JSON hash, fresh F25 installed-host review hash, current native-driver provenance hash, exact extraction path/outputdir, and current Code path remain unbound. Native host guard rechecks current full/raw, every frozen file, all20 compiled driver hashes, current Code1.143.1 executable238249784bytes/SHA325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6 and reviewed application files before and after launch. Fresh installed-host inspection is REQUIRED before execution; retained F24 review is not that inspection.

Main gate: saved logs21primary+4restart (240sec each, including real60sec modal timeout), NEW owned-output19 single phase, then affected artifact25/history25/MCP25/editor25/CI25/service-account25/registry25/Terraform25/container25/source21/hygiene21/vault10/retained106, PLUS F08 thirteen single/F09 twelve single/PS51 nineteen/CMD nineteen/GitBash nineteen. Expected509 native checks in37 phases20 families; declared expectations ONLY. Existing13 F24 host sources and added retained F08/F09/shell sources/assertions are unchanged. Added retained launchers use F24's stricter actual-close/bothEOF/runtime-identity skeleton. Normalizer extraction makes all shared paths affected; retained106 is not a substitute for F08/F09/shell native runs.

Owned-output uses only SOTERAI_LITE_F25_OUTPUT_PROFILE/EVIDENCE/BUNDLE_SHA256/DRIVER_KIND fixture variables, marker .synthetic-lite-f25-owned-output-host, phase single, beforeActivate/setupDiagnostic/run. Logs uses retained F17 bindings, owns all synthetic payload seeding, and logs-restart.json is retained. Every process remains owned/hidden/isolated with cleared ambient environment, finite waits, actual exit0 and bothEOF required, signalsRequested0; timeout/EOF uncertainty is INCOMPLETE with processes retained. Original driver sources remain unchanged by these templates.

The inspector requires14 entries/3 runtimes/81 strict machine settings, restricted defaulttrue logProtection flag, both log commands and all prior artifact/history/scanner commands, complete current runtime provenance including LogContent/ManagedLogCollector/LogController/LogFlags/internal StreamingOutputNormalizer. It admits only NEW F25 attempt01; existing artifact/history evidence must re-run on that exact artifact. Functional03/security03 are the retained strict actual-exit/bothEOF variants, preserving functional10 including H09/H10 and security17 unchanged8BLOCKED_SCOPED9LEAK_CONFIRMED.

Before execution, parse allPS/CJS templates, inspect placeholder membership and no-signal invariants, verify final host source counts/protocols, then root materializes new bound copies. This document authorizes no native PASS claim. Acceptance, custody, all actual native receipts, source+transition commits and exhaustive byte proofs remain separate. LOW independence/no rating/original L6 HUMAN-ACTIONS STOP/unmanaged residuals persist.
`;
outputs.set('native-template-instructions-01.md',Buffer.from(instruction));
const report={status:'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND',feature:'F25',sourceFeature:'F24',sources:pins.map(([name,bytes,sha256])=>({path:'docs/soterai-lite/evidence/20261023-f24-artifact-c3a5d91e/'+name,bytes,sha256})),templates,machineSettings:81,nativeDriverEntrypoints:20,declaredNativeChecks:509,declaredNativePhases:37,nativeFamilies:20,functionalChecks:10,securityComparisonRows:17,securityResiduals:'8 BLOCKED_SCOPED;9 LEAK_CONFIRMED',expectedArtifact:'packages/soterai-lite/soterai-lite-0.7.0-f25-20261024-attempt01.vsix',newHostProtocols:families.slice(0,2),scope:'New docs-side prepared text only; no current input/artifact/host/result binding, build or native execution. Named retained source pins replace needless full evidence cloning.'};
outputs.set('native-template-inputs-01.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
assert.equal(templates.length,29);for(const name of outputs.keys())assert(!fs.existsSync(path.join(__dirname,name)),'Immutable output exists: '+name);
for(const [name,raw] of outputs)fs.writeFileSync(path.join(__dirname,name),raw,{flag:'wx'});
console.log(JSON.stringify({status:report.status,templates:templates.length,pinnedSources:pins.length,nativeDrivers:20,declaredNativeChecks:509,declaredNativePhases:37,execution:'NOT_RUN'}));
