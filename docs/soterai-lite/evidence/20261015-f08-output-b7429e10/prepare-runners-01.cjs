// Test/evidence scaffolding only. This prepares runners; it launches no checks.
const fs = require('node:fs'), path = require('node:path');
const prior = path.resolve(__dirname, '../20261015-f07-matching-64a72df1');
const relative = 'docs/soterai-lite/evidence/20261015-f08-output-b7429e10';
const outputs = new Map();
const read = name => fs.readFileSync(path.join(prior, name), 'utf8');
const replaceRequired = (text, before, after) => {
  if (!text.includes(before)) throw new Error('Expected historical runner input changed: ' + before);
  return text.replaceAll(before, after);
};
outputs.set('prepare-metadata-01.cjs', read('prepare-metadata-01.cjs'));
let inspection = read('inspect-vsix-02.ps1');
inspection = replaceRequired(inspection, 'f07-20261015-attempt02', 'f08-20261015-attempt01');
inspection = replaceRequired(inspection, 'vsix-extracted-02', 'vsix-extracted-01');
inspection = replaceRequired(inspection, 'vsix-inspection-02', 'vsix-inspection-01');
outputs.set('inspect-vsix-01.ps1', inspection);
for (const name of ['run-functional-01.ps1', 'run-security-01.ps1']) {
  outputs.set(name, replaceRequired(read(name), "'soterai.lite.secretMatching'=$true;", "'soterai.lite.secretMatching'=$true; 'soterai.lite.outputRedactor'=$true;"));
}
let affected = read('run-affected-hosts-02.ps1').replaceAll('F07', 'F08');
affected = replaceRequired(affected, 'vsix-extracted-02/extension', 'vsix-extracted-01/extension');
outputs.set('run-affected-hosts-01.ps1', affected);
const prelude = String.raw`$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskPriorTemp=$env:TEMP;$taskPriorTmp=$env:TMP
function Invoke-F08Check([string]$Name,[string]$File,[string[]]$Arguments,[string]$Directory=$taskRepo){
 & $taskRunner -FilePath $File -ArgumentList $Arguments -OutputFile (Join-Path $PSScriptRoot $Name) -WorkingDirectory $Directory
 $taskReceipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Name+'.result.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 if($taskReceipt.exitCode -ne 0){throw ('F08 check failed or incomplete; retain every receipt: '+$Name)}
}
function Assert-F08RetainedPass([string]$Name){
 $taskLog=Join-Path $PSScriptRoot $Name;$taskRecord=$taskLog+'.result.json'
 if(-not(Test-Path -LiteralPath $taskLog -PathType Leaf) -or -not(Test-Path -LiteralPath $taskRecord -PathType Leaf)){throw ('Required previously completed check is not ready: '+$Name)}
 $taskRetained=Get-Content -LiteralPath $taskRecord -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskRetained.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskLog -Algorithm SHA256).Hash -ne $taskRetained.sha256){throw ('Retained check failed or its log changed: '+$Name)}
}
`;
outputs.set('run-local-checks-01.ps1', prelude + String.raw`try{
 $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
 if(-not(Test-Path -LiteralPath $env:TEMP -PathType Container)){throw 'Existing isolated D: temporary directory required.'}
 Invoke-F08Check 'metadata-sync-01.txt' node @('RELPATH/prepare-metadata-01.cjs')
 Invoke-F08Check 'generate-readiness-01.txt' node @('packages/vscode-extension/scripts/generate-readiness.mjs')
 Assert-F08RetainedPass 'typecheck-01.txt'
 Assert-F08RetainedPass 'focused-after-02.txt'
 Invoke-F08Check 'full-tests-01.txt' node @('--import','tsx','--test','--test-concurrency=1','../vscode-extension/src/__tests__/**/*.test.ts') (Join-Path $taskRepo 'packages/soterai-lite')
 Invoke-F08Check 'package-01.txt' node @('packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f08-20261015-attempt01.vsix')
 Invoke-F08Check 'vsix-inspection-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','RELPATH/inspect-vsix-01.ps1')
 Invoke-F08Check 'host-build-01.txt' node @('RELPATH/build-host-01.cjs')
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}
`.replaceAll('RELPATH', relative));
outputs.set('run-host-checks-01.ps1', prelude + String.raw`try{
 $env:TEMP='D:\SoterAI-Lite-test-profiles\f03-unit-temp';$env:TMP=$env:TEMP
 $taskInspection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'vsix-inspection-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskRuntime=@($taskInspection.sourceProvenance.inventory|Where-Object{$_.name -eq 'extension.js'})[0].sha256
 if($taskRuntime -notmatch '^[a-f0-9]{64}$'){throw 'Exact inspected runtime identity required.'}
 $taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
 $taskSource=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 if((Get-FileHash -LiteralPath (Join-Path $taskSource 'dist/extension.js')).Hash.ToLowerInvariant() -ne $taskRuntime){throw 'Inspected runtime differs before host launch.'}
 $taskBefore=@(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter 'f08-native-host-*'|ForEach-Object{$_.FullName})
 Invoke-F08Check 'native-host-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','RELPATH/run-native-01.ps1','-CodePath',$taskCode,'-HostTestsPath','RELPATH/prebuilt-host-01/lite-streaming-output-host.js','-ExtensionRoot',$taskSource)
 $taskNew=@(Get-ChildItem -LiteralPath $PSScriptRoot -Directory -Filter 'f08-native-host-*'|Where-Object{$_.FullName -notin $taskBefore})
 if($taskNew.Count -ne 1){throw 'Exactly one new native result directory required.'}
 $taskNative=Get-Content -LiteralPath (Join-Path $taskNew[0].FullName 'matching-results.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskNative.extensionBundleSha256 -ne $taskRuntime -or $taskNative.passed -ne 13 -or $taskNative.failed -ne 0 -or $taskNative.notRun -ne 0 -or $taskNative.driverFailure -or @($taskNative.observations).Count -ne 13 -or @($taskNative.observations|Where-Object{$_.status -ne 'PASS'}).Count -ne 0){throw 'Native13 acceptance incomplete; retain exact result.'}
 Invoke-F08Check 'affected-hosts-launch-01.txt' powershell @('-NoProfile','-ExecutionPolicy','Bypass','-File','RELPATH/run-affected-hosts-01.ps1','-ExpectedBundleSha256',$taskRuntime,'-CodePath',$taskCode)
}finally{$env:TEMP=$taskPriorTemp;$env:TMP=$taskPriorTmp}
`.replaceAll('RELPATH', relative));
for (const name of outputs.keys()) if (fs.existsSync(path.join(__dirname, name))) throw new Error('Immutable runner output already exists: ' + name);
for (const [name, text] of outputs) fs.writeFileSync(path.join(__dirname, name), text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', files: [...outputs.keys()], artifact: 'soterai-lite-0.7.0-f08-20261015-attempt01.vsix', retainedTypecheck: 'typecheck-01.txt', retainedFocused: 'focused-after-02.txt', focusedFiles: 6, nativeCases: 13, functionalCases: 10, securityCases: 17 }));
