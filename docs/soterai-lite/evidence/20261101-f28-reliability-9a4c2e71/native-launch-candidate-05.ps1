param([Parameter(Mandatory=$true)][string]$CodePath,[Parameter(Mandatory=$true)][string]$BindingPath,[Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedBindingSha256)
# PREPARED_NOT_EXECUTED; primary30+restart6 COMPONENT route only, no configured push.
$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskAdmission=Join-Path $PSScriptRoot 'native-admission-03.ps1'
if(-not(Test-Path -LiteralPath $BindingPath -PathType Leaf) -or (Get-FileHash -LiteralPath $BindingPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedBindingSha256){throw 'Exact fresh binding required before helper load.'}
$taskInitial=Get-Content -LiteralPath $BindingPath -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInitial.admission.path -cne 'native-admission-03.ps1' -or (Get-FileHash -LiteralPath $taskAdmission -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInitial.admission.sha256){throw 'Pinned F28 admission helper differs.'}
. $taskAdmission
$taskBinding=Assert-F28Admission $BindingPath $ExpectedBindingSha256
$taskSource=Resolve-F28Own $taskBinding.extractedRoot;$taskHost=Resolve-F28Own $taskBinding.driver.path;$taskVsix=Resolve-F28Repo $taskBinding.vsix.path
$taskExpectedVsix=$taskBinding.vsix.sha256;$taskExpected=$taskBinding.frontendSha256;$taskDriverExpected=$taskBinding.driver.sha256
$taskCodeExpected='9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb';$taskGitExpected='da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f';$taskShExpected='fc362aae1f217d34d02237d99527839dd6cf85b37c7a0277109400bfa0faa594'
$taskGit='C:\Program Files\Git\cmd\git.exe';$taskSh='C:\Program Files\Git\usr\bin\sh.exe'
Assert-F28File $CodePath $taskCodeExpected 238751552;Assert-F28File $taskGit $taskGitExpected 46480;Assert-F28File $taskSh $taskShExpected
if(([Diagnostics.FileVersionInfo]::GetVersionInfo($CodePath)).ProductVersion -cne '1.144.0'){throw 'Pinned Code version differs.'}
$taskHostReview=Read-F28Json (Resolve-F28Repo $taskBinding.hostReview.path);if([IO.Path]::GetFullPath($CodePath) -cne [IO.Path]::GetFullPath($taskHostReview.currentHost.executable.path)){throw 'Exact installed Code path required.'}
function Write-F28NewBytes([string]$File,[byte[]]$Bytes){$taskFd=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$taskFd.Write($Bytes,0,$Bytes.Length);$taskFd.Flush($true)}finally{$taskFd.Dispose()}}
function Write-F28NewJson([string]$File,[object]$Value){Write-F28NewBytes $File ([Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 80)+[Environment]::NewLine))}
function Copy-F28New([string]$Source,[string]$Target){[IO.File]::Copy($Source,$Target,$false)}
$taskMaterializationFile=Resolve-F28Own 'native-materialization-03.json'
$taskMaterialization=Read-F28Json $taskMaterializationFile
if($taskMaterialization.status -cne 'ROOT_REVIEWED_F28_NATIVE30_ONE_ISOLATED_COMPONENT_ATTEMPT' -or $taskMaterialization.allowedAttempts -ne 1 -or $taskMaterialization.bindingSha256 -cne $ExpectedBindingSha256 -or $taskMaterialization.candidateSha256 -cne (Get-F28Sha $PSCommandPath) -or $taskMaterialization.configuredPushAuthorized -ne $false -or $taskMaterialization.f26aNative09 -cne 'USER_DEFERRED_NOT_RUN'){throw 'Concrete reviewed one-attempt component materialization required.'}
$taskConsumption=Resolve-F28Own 'native-consumption-03.json';if(Test-Path -LiteralPath $taskConsumption){throw 'Single component attempt already consumed; no automatic retry.'}
Write-F28NewJson $taskConsumption @{status='F28_NATIVE30_COMPONENT_ATTEMPT_CONSUMED_NO_AUTO_RETRY';observedAt=[DateTime]::UtcNow.ToString('o');bindingSha256=$ExpectedBindingSha256;materializationSha256=(Get-F28Sha $taskMaterializationFile);candidateSha256=(Get-F28Sha $PSCommandPath);configuredGitPush='NOT_AUTHORIZED_NOT_RUN';f26aNative09='USER_DEFERRED_NOT_RUN';signalsRequested=0}
$taskName='f28-reliability-native-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRun=Join-Path $PSScriptRoot $taskName;$taskExecution=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskExecution.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $taskRun) -or (Test-Path -LiteralPath $taskExecution)){throw 'Existing or escaped execution profile refused.'}
$taskProfile=Join-Path $taskExecution 'profile';$taskWorkspace=Join-Path $taskExecution 'workspace';$taskInstalled=Join-Path $taskExecution 'extensions';$taskSnapshot=Join-Path $taskExecution 'extension'
foreach($taskDirectory in @($taskRun,$taskSnapshot,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDirectory)}
$taskWorkspaceFile=Join-Path $taskExecution 'f28-fixture.code-workspace';Write-F28NewJson $taskWorkspaceFile @{folders=@(@{path=$taskWorkspace})};Copy-F28New $taskWorkspaceFile (Join-Path $taskRun 'original-workspace.code-workspace.json')
foreach($taskEntry in Get-ChildItem -LiteralPath $taskSource -Force){Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskSnapshot -Recurse}
$taskManifestPath=Join-Path $taskSnapshot 'package.json';$taskOriginalManifest=[IO.File]::ReadAllBytes($taskManifestPath);Write-F28NewBytes (Join-Path $taskRun 'original-manifest.json') $taskOriginalManifest
$taskManifest=[Text.UTF8Encoding]::new($false,$true).GetString($taskOriginalManifest)|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard' -or $taskManifest.main -cne './dist/extension.js'){throw 'Unexpected packaged extension identity/main.'}
$taskManifest.main='./dist-test/native-bootstrap.cjs';[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskProbe=Join-Path $taskSnapshot 'dist-test/host/index.js';[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskProbe));Copy-F28New $taskHost $taskProbe
$taskBootstrap=@'
// Evidence-only isolated developer bootstrap, not a shipped runtime.
const vscode=require('vscode'),fs=require('node:fs/promises'),crypto=require('node:crypto'),path=require('node:path');
const prefix='SOTERAI_LITE_F28_',evidence=process.env[prefix+'EVIDENCE'],phase=process.env[prefix+'PHASE'],profile=process.env[prefix+'PROFILE'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const writeJson=(f,v)=>fs.writeFile(f,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const startup=async stage=>{await fs.appendFile(evidence+'.startup.jsonl',JSON.stringify({phase,timestamp:new Date().toISOString(),stage})+'\n');};
let actual,driver;
const diagnostic=()=>typeof driver?.setupDiagnostic==='function'?driver.setupDiagnostic():undefined;
const close=async()=>{const state=diagnostic();if(state?.halted||state?.busyChildren||state?.timedOutChildren){await startup('STOP_UNCONFIRMED_OWNERSHIP_RETAINED_NO_CLOSE');return;}await startup('close-start');await vscode.commands.executeCommand('workbench.action.closeWindow');await startup('close-end');};
const failure=async(stage,error)=>{const value={status:'FAIL',stage,errorName:error instanceof Error?error.name:'UnknownFailure',setup:diagnostic(),scope:'F28_CHECKED_READER_NATIVE30_NOT_FEATURE_ACCEPTANCE'};try{await writeJson(evidence+'.driver-error.json',value);}catch(writeError){if(writeError?.code!=='EEXIST')throw writeError;const extra=evidence+'.additional-errors.jsonl';let size=0;try{size=(await fs.stat(extra)).size;}catch(readError){if(readError?.code!=='ENOENT')throw readError;}const line=JSON.stringify(value)+String.fromCharCode(10);if(size+Buffer.byteLength(line)>16384)throw Error('Bounded repeated diagnostic exceeded.');await fs.appendFile(extra,line);}};
const jsonBuiltinPins = [
    {
        "relative": "package.json",
        "bytes": 3934,
        "sha256": "9cd153a0d6bd8f8058b5f57c3f11c203228b102ec95e7a025d0e2a5448d662d3"
    },
    {
        "relative": "client/dist/node/jsonClientMain.js",
        "bytes": 653282,
        "sha256": "6471beebe24498a7d7c7d1803b08c475b0cf88115cf9999905a7890d3a9d75ca"
    },
    {
        "relative": "server/package.json",
        "bytes": 1154,
        "sha256": "9f89ec8214ef426f93002d427f1669027f41bece3a2f7f23787df45d58e237c4"
    },
    {
        "relative": "server/dist/node/jsonServerMain.js",
        "bytes": 357534,
        "sha256": "b5425799cbb01710aa2f1ca48fd215d16e9c0d0d6f86447e2faeeaf5582d61e6"
    }
];
const jsonBuiltinAppRoot = "C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\2c33b50b16\\resources\\app";
async function joinPinnedJsonBuiltin() {
    const folders = vscode.workspace.workspaceFolders;
    const root = folders?.length === 1 && folders[0].uri.scheme === 'file' ? folders[0].uri.fsPath : undefined;
    if (!vscode.workspace.isTrusted || vscode.env.remoteName !== undefined || !root
        || !/^D:\\SoterAI-Lite-test-profiles\\f28-reliability-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$/i.test(root)
        || !['primary','restart','peer'].includes(phase) || !same(profile, path.join(path.dirname(root), phase === 'peer' ? 'peer-profile' : 'profile'))
        || !same(vscode.env.appRoot, jsonBuiltinAppRoot)) throw Error('Pinned trusted local synthetic profile required.');
    if (await fs.readFile(path.join(root, '.synthetic-lite-f28-host'), 'utf8') !== 'synthetic-only-v1')
        throw Error('Synthetic marker required before vendor startup.');
    const extension = vscode.extensions.getExtension('vscode.json-language-features');
    const expectedRoot = path.join(jsonBuiltinAppRoot, 'extensions', 'json-language-features');
    if (!extension || extension.id !== 'vscode.json-language-features' || extension.extensionUri.scheme !== 'file'
        || !same(extension.extensionPath, expectedRoot) || !same(await fs.realpath(extension.extensionPath), expectedRoot)
        || extension.packageJSON?.publisher !== 'vscode' || extension.packageJSON?.name !== 'json-language-features'
        || extension.packageJSON?.version !== '10.0.0' || extension.packageJSON?.main !== './client/dist/node/jsonClientMain')
        throw Error('Exact installed JSON builtin required.');
    const files = [];
    for (const pin of jsonBuiltinPins) {
        const file = path.join(expectedRoot, pin.relative), stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== pin.bytes || !same(await fs.realpath(file), file))
            throw Error('Pinned vendor JSON input identity differs.');
        const raw = await fs.readFile(file);
        if (raw.length !== pin.bytes || sha(raw) !== pin.sha256) throw Error('Pinned vendor JSON input bytes differ.');
        files.push({ relative: pin.relative, bytes: raw.length, sha256: pin.sha256 });
    }
    const schemaDownload = () => vscode.workspace.getConfiguration('json').get('schemaDownload.enable');
    if (schemaDownload() !== false) throw Error('Schema downloads must be disabled before vendor activation.');
    const wasActive = extension.isActive;
    await startup('json-builtin-activation-start');
    // This vendor call starts a language-server child. Its streams/EOF are not
    // owner/Git evidence and are never admitted by the public-Git observer.
    await extension.activate();
    if (!extension.isActive || schemaDownload() !== false) throw Error('JSON builtin activation/configuration incomplete.');
    await startup('json-builtin-activation-end');
    await writeJson(evidence + '.json-builtin-startup.json', {
        schemaVersion: 1, scope: 'PINNED_VENDOR_JSON_STARTUP_ONLY_NOT_A_30_CASE_RESULT', phase,
        extensionId: extension.id, appRoot: jsonBuiltinAppRoot, extensionPath: expectedRoot,
        trustedLocalSyntheticProfile: true, schemaDownloadEnabled: false, wasActive, isActive: extension.isActive,
        files, ordering: 'ACTIVATION_PROMISE_JOINED_BEFORE_ACTUAL_REQUIRE_DRIVER_REQUIRE_AND_ENVIRONMENT_BASELINE',
        processEnvironmentAssignmentsByBootstrap: 0, ignoredEnvironmentKeys: 0, addedTimers: 0,
        vendorLanguageServer: 'STARTUP_CHILD_OUTSIDE_OWNER_GIT_WITNESSES_NO_STREAM_OR_EOF_CLAIM',
        rawVendorOutputCaptured: false, signalsRequested: 0
    });
}

exports.activate=async function(context){
 try{await startup('activation-enter');await joinPinnedJsonBuiltin();await startup('actual-require-start');actual=require('../dist/extension.js');await startup('actual-require-end');driver=require('./host/index.js');
  if(typeof driver.beforeActivate!=='function')throw Error('Native beforeActivate required.');await startup('before-activate-start');await driver.beforeActivate(context);await startup('before-activate-end');await actual.activate(context);await startup('actual-activate-end');
 }catch(error){await failure('activate',error);await close();return;}
 setTimeout(async()=>{try{await startup('driver-run-start');await driver.run(context);await startup('driver-run-end');}catch(error){await failure('run',error);}finally{await close();}},1500);
};
exports.deactivate=function(...args){return typeof actual?.deactivate==='function'?actual.deactivate(...args):undefined;};
'@
$taskBootstrapPath=Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs';Write-F28NewBytes $taskBootstrapPath ([Text.UTF8Encoding]::new($false).GetBytes($taskBootstrap))
Write-F28NewBytes (Join-Path $taskWorkspace '.synthetic-lite-f28-host') ([Text.UTF8Encoding]::new($false).GetBytes('synthetic-only-v1'))
$taskGlobalConfig=Join-Path $taskProfile 'empty-global.gitconfig';$taskSystemConfig=Join-Path $taskProfile 'empty-system.gitconfig';Write-F28NewBytes $taskGlobalConfig ([byte[]]@());Write-F28NewBytes $taskSystemConfig ([byte[]]@())
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';'json.schemaDownload.enable'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;'soterai.lite.historyHooks.preCommit'=$false;'soterai.lite.historyHooks.prePush'=$false;'soterai.hardening.secretInventory'=$true;'soterai.hardening.capabilityReleaseGuard'=$true;'soterai.lite.outputRedactor'=$true;'soterai.lite.secretMatching'=$true;'soterai.lite.vaultMode'=$true;'soterai.lite.vaultRuntime'=$true}
Write-F28NewJson (Join-Path $taskProfile 'User/settings.json') $taskSettings
$taskContent=Read-F28Json (Resolve-F28Own $taskBinding.content.path);$taskRuntimeBindings=@()
foreach($taskRuntimeName in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){$taskRows=@($taskContent.entries|Where-Object{$_.path -ceq ('extension/dist/'+$taskRuntimeName)});if($taskRows.Count -ne 1){throw 'Unique four runtime entries required.'};$taskRuntimeBindings+=@{name=$taskRuntimeName;bytes=$taskRows[0].bytes;sha256=$taskRows[0].sha256;source=(Join-Path $taskSource ('dist/'+$taskRuntimeName));execution=(Join-Path $taskSnapshot ('dist/'+$taskRuntimeName))}}
$taskWorkerExpected=@($taskRuntimeBindings|Where-Object{$_.name -ceq 'pre-commit-client.js'})[0].sha256
$taskManifestExpected=Get-F28Sha $taskManifestPath;$taskBootstrapExpected=Get-F28Sha $taskBootstrapPath;$taskLauncherExpected=Get-F28Sha $PSCommandPath
$taskFreeze=Read-F28Json (Resolve-F28Own $taskBinding.caseFreeze.path)
function Assert-F28NativeInputs{
 [void](Assert-F28Admission $BindingPath $ExpectedBindingSha256);Assert-F28File $PSCommandPath $taskLauncherExpected;Assert-F28File $CodePath $taskCodeExpected 238751552;Assert-F28File $taskGit $taskGitExpected 46480;Assert-F28File $taskSh $taskShExpected
 foreach($taskDriverInput in @($taskHost,$taskProbe)){Assert-F28File $taskDriverInput $taskDriverExpected $taskBinding.driver.bytes}
 foreach($taskRuntime in $taskRuntimeBindings){foreach($taskFile in @($taskRuntime.source,$taskRuntime.execution)){Assert-F28File $taskFile $taskRuntime.sha256 $taskRuntime.bytes}}
 Assert-F28File $taskManifestPath $taskManifestExpected;Assert-F28File $taskBootstrapPath $taskBootstrapExpected
}
function Assert-F28Result($Observed,[string]$Phase){
 $taskCount=if($Phase -ceq 'primary'){25}else{5};$taskScopes=@($taskFreeze.cases|Where-Object{$_.phase -ceq $Phase})
 if($Observed.schemaVersion -ne 1 -or $Observed.phase -cne $Phase -or $Observed.syntheticOnly -ne $true -or $Observed.hostVersion -cne '1.144.0' -or $Observed.expectedChecks -ne $taskCount -or $Observed.passed -ne $taskCount -or $Observed.failed -ne 0 -or $Observed.notRun -ne 0 -or -not($Observed.PSObject.Properties.Name -contains 'driverFailure') -or $null -ne $Observed.driverFailure -or @($Observed.observations).Count -ne $taskCount){throw 'Exact complete native30 phase required.'}
 for($taskIndex=0;$taskIndex -lt $taskCount;$taskIndex++){$taskPrefix=if($Phase -ceq 'primary'){'F28-HP'}else{'F28-HR'};$taskRow=$Observed.observations[$taskIndex];if($taskRow.id -cne ($taskPrefix+($taskIndex+1).ToString('00')) -or $taskRow.scope -cne $taskScopes[$taskIndex].scope -or $taskRow.status -cne 'PASS'){throw 'Original frozen30 assertions/IDs/scopes required.'}}
 if($Observed.extensionBundleSha256 -cne $taskExpected -or $Observed.hostProbeSha256 -cne $taskDriverExpected -or $Observed.sourceProofSha256 -cne $taskBinding.sourceProof.sha256 -or $Observed.signalsRequested -ne 0 -or $Observed.unfinishedFixtureHandles -ne 0 -or $Observed.sourceHandleOpens -ne $Observed.sourceHandleCloses -or $Observed.originalEnvironmentDocumentEvents -ne 0 -or $Observed.readStatus.activeReads -ne 0){throw 'Exact runtime/read closure/no original document proof required.'}
 if(@($Observed.runtimeBindings).Count -ne 4){throw 'Four runtime bindings required.'};foreach($taskRuntime in $taskRuntimeBindings){$taskRows=@($Observed.runtimeBindings|Where-Object{$_.name -ceq $taskRuntime.name});if($taskRows.Count -ne 1 -or $taskRows[0].sha256 -cne $taskRuntime.sha256 -or $taskRows[0].bytes -ne $taskRuntime.bytes){throw 'Loaded four runtime identity differs.'}}
 if($Phase -ceq 'primary'){
  if($Observed.readyForInterphase -ne $true -or $Observed.safeWithdrawal -cne 'PRIMARY_DISABLED_NO_PENDING_READS_RESTART_REQUIRED' -or $Observed.readStatus.status -cne 'DISABLED' -or @($Observed.peerChildren).Count -ne 1){throw 'Primary disabled/restart/one concurrent peer basis required.'}
  $taskOpenCount=if($Phase -ceq 'primary'){2}else{0};if($Observed.sourceHandleOpens -ne $taskOpenCount -or $Observed.sourceHandleCloses -ne $taskOpenCount){throw 'Both actual delayed source handles must close.'}
  $taskPeer=$Observed.peerChildren[0];$taskPeerKeys=@('pid','closed','code','signal','stdoutEOF','stderrEOF','overflow','streamError','profile','streams','signalsRequested');if(@(Compare-Object @($taskPeer.PSObject.Properties.Name|Sort-Object) @($taskPeerKeys|Sort-Object)).Count -ne 0){throw 'Complete peer metadata including explicit null signal required.'};if(@($taskPeer.streams).Count -ne 2 -or @($taskPeer.streams.channel|Sort-Object -Unique).Count -ne 2){throw 'Both distinct peer streams required.'};if($taskPeer.closed -ne $true -or $taskPeer.code -ne 0 -or $null -ne $taskPeer.signal -or $taskPeer.stdoutEOF -ne $true -or $taskPeer.stderrEOF -ne $true -or $taskPeer.overflow -ne $false -or $taskPeer.streamError -ne $false -or $taskPeer.signalsRequested -ne 0 -or $taskPeer.pid -le 0){throw 'Actual peer natural zero/bothEOF required.'}
  if(-not [IO.Path]::GetFullPath($taskPeer.profile).Equals((Join-Path $taskExecution 'peer-profile'),[StringComparison]::OrdinalIgnoreCase)){throw 'Exact isolated peer profile required.'}
  foreach($taskStream in @($taskPeer.streams)){if($taskStream.channel -cnotin @('stdout','stderr') -or $taskStream.bytes -gt 1048576 -or -not [IO.Path]::GetFullPath($taskStream.file).Equals((Join-Path $taskExecution ('peer-'+$taskStream.channel+'.bin')),[StringComparison]::OrdinalIgnoreCase)){throw 'Bounded exact peer streams required.'};Assert-F28File $taskStream.file $taskStream.sha256 $taskStream.bytes;Copy-F28New $taskStream.file (Join-Path $taskRun ('peer-'+$taskStream.channel+'.bin'))}
  $taskPeerAbsence=@();foreach($taskNumber in @(1,2)){if($taskNumber -eq 2){Start-Sleep -Milliseconds 250};$taskPeerPresent=Get-Process -Id $taskPeer.pid -ErrorAction SilentlyContinue;$taskPeerAbsence+=@{pid=$taskPeer.pid;absent=($null -eq $taskPeerPresent);observedAt=[DateTime]::UtcNow.ToString('o')}};if(@($taskPeerAbsence|Where-Object{$_.absent -ne $true}).Count -ne 0){throw 'Peer PID absence unconfirmed.'};Write-F28NewJson (Join-Path $taskRun 'peer-owned-editor-absence.json') @{status='PASS_DECLARED_PEER_CODE_NATURAL_CLOSE_BOTH_EOF_ABSENCE_TWICE';child=$taskPeer;observations=$taskPeerAbsence;allDescendantEOF='NOT_INFERRED';signalsRequested=0}
  $taskLarge=@($Observed.measurements|Where-Object{$_.kind -ceq 'ACTUAL_PACKAGED_COMMAND_SELECTED128_OF4096'});if($taskLarge.Count -ne 1 -or $taskLarge[0].selected -ne 128 -or $taskLarge[0].bulkSyntheticFiles -ne 4096 -or $taskLarge[0].milliseconds -le 0 -or $taskLarge[0].milliseconds -ge 60000){throw 'Actual selected128/bulk4096 bounded workload required.'}
 }elseif($Observed.sourceHandleOpens -ne 0 -or $Observed.sourceHandleCloses -ne 0 -or $Observed.safeWithdrawal -cne 'ORIGINAL_FLAG_RESTORED_NO_PENDING_READS' -or @($Observed.peerChildren).Count -ne 0){throw 'Actual restart flag restore/no pending reads required.'}
}
$taskResults=@()
Write-F28NewJson (Join-Path $taskRun 'freeze.json') @{schemaVersion=1;syntheticOnly=$true;createdAt=[DateTime]::UtcNow.ToString('o');bindingSha256=$ExpectedBindingSha256;phases=@('primary','restart');expectedChecks=@{primary=25;restart=5};executionEvidenceRoot=$taskExecution;profile=$taskProfile;workspace=$taskWorkspace;workspaceFile=$taskWorkspaceFile;initialWorkspaceKind='SAVED_ONE_FOLDER_WORKSPACE';vsixSha256=$taskExpectedVsix;extensionBundleSha256=$taskExpected;workerSha256=$taskWorkerExpected;driverSha256=$taskDriverExpected;runtimeBindings=$taskRuntimeBindings;bootstrapSha256=$taskBootstrapExpected;launcherSha256=$taskLauncherExpected;configuredGitPush='NOT_AUTHORIZED_NOT_RUN';f26aNative09='USER_DEFERRED_NOT_RUN';independence='LOW';signalsRequested=0}
$taskResults=@()
foreach($taskPhase in @('primary','restart')){
 Assert-F28NativeInputs
 $taskInfo=New-Object Diagnostics.ProcessStartInfo;$taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
 $taskArgs=@("--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",'--new-window','--disable-extensions','--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm','--disable-extension=vscode.extension-editing','--disable-workspace-trust','--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspaceFile)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid Code argument.'};'"'+$_+'"'}) -join ' ');$taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskSystemName in @('SystemRoot','WINDIR','COMSPEC')){$taskSystemValue=[Environment]::GetEnvironmentVariable($taskSystemName);if($taskSystemValue){$taskInfo.EnvironmentVariables[$taskSystemName]=$taskSystemValue}}
 $taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
 foreach($taskEnvName in @('HOME','USERPROFILE','XDG_CONFIG_HOME')){$taskInfo.EnvironmentVariables[$taskEnvName]=$taskProfile}
 $taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=$taskGlobalConfig;$taskInfo.EnvironmentVariables['GIT_CONFIG_SYSTEM']=$taskSystemConfig;$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1';$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskResult=Join-Path $taskExecution ($taskPhase+'-results.json');$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_PROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_EVIDENCE']=$taskResult;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_PHASE']=$taskPhase;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_BUNDLE_SHA256']=$taskExpected;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_WORKER_SHA256']=$taskWorkerExpected;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_DRIVER_KIND']='native-bootstrap';$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_DRIVER_SHA256']=$taskDriverExpected;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_SOURCE_PROOF_SHA256']=$taskBinding.sourceProof.sha256;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F28_VSIX_SHA256']=$taskExpectedVsix
 $taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo;$taskStarted=$false
 try{
  [void]$taskProcess.Start();$taskStarted=$true;$taskPid=$taskProcess.Id;$taskStart=$taskProcess.StartTime.ToUniversalTime().ToString('o')
  Write-F28NewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-start.json')) @{schemaVersion=1;pid=$taskPid;startUtc=$taskStart;executable=$CodePath;args=$taskArgs;profile=$taskProfile;workspace=$taskWorkspace;signalsRequested=0}
  $taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 300){}
  $taskTimeout=-not $taskProcess.HasExited;$taskDrain=[Diagnostics.Stopwatch]::StartNew();while(-not $taskTimeout -and (-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted) -and $taskDrain.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}
  $taskDrainUnconfirmed=-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted
  if($taskTimeout -or $taskDrainUnconfirmed){Write-F28NewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-pending.json')) @{status='STOP_UNCONFIRMED';pid=$taskPid;observedExit=$taskProcess.HasExited;stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;signalsRequested=0;timedOut=$taskTimeout;ownership='RETAIN_PROCESS_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_LATER_PHASE'};while(-not $taskProcess.HasExited -or -not $taskOut.IsCompleted -or -not $taskErr.IsCompleted){if(-not $taskProcess.HasExited){[void]$taskProcess.WaitForExit(1000)}else{Start-Sleep -Milliseconds 20}}}
  $taskOutPath=Join-Path $taskRun ($taskPhase+'-stdout.txt');$taskErrPath=Join-Path $taskRun ($taskPhase+'-stderr.txt');Write-F28NewBytes $taskOutPath ([Text.UTF8Encoding]::new($false).GetBytes($taskOut.GetAwaiter().GetResult()));Write-F28NewBytes $taskErrPath ([Text.UTF8Encoding]::new($false).GetBytes($taskErr.GetAwaiter().GetResult()))
  $taskClose=@{observedExit=$taskProcess.HasExited;exitCode=$taskProcess.ExitCode;stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;signalsRequested=0;ownedWindowClose='workbench.action.closeWindow';executable=[IO.Path]::GetFullPath($CodePath);pid=$taskPid;pidAbsentTwice=$false;streamsStable=$false;timedOut=$taskTimeout}
  Write-F28NewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-close.json')) $taskClose
  foreach($taskSuffix in @('.driver-error.json','.additional-errors.jsonl','.startup.jsonl','.json-builtin-startup.json')){if(Test-Path -LiteralPath ($taskResult+$taskSuffix)){if((Get-Item -LiteralPath ($taskResult+$taskSuffix)).Length -gt 1048576){throw 'Bounded diagnostic metadata exceeded.'};Copy-F28New ($taskResult+$taskSuffix) (Join-Path $taskRun ($taskPhase+$taskSuffix))}}
  if(Test-Path -LiteralPath $taskResult){if((Get-Item -LiteralPath $taskResult).Length -gt 4194304){throw 'Native result bound exceeded.'};Copy-F28New $taskResult (Join-Path $taskRun ($taskPhase+'-results.json'))}
  if($taskTimeout -or $taskDrainUnconfirmed){throw 'STOP_UNCONFIRMED retained without signals until actual closure; no next phase.'}
  if($taskProcess.ExitCode -ne 0 -or -not(Test-Path -LiteralPath $taskResult) -or (Test-Path -LiteralPath ($taskResult+'.driver-error.json'))){throw 'Actual Code exit/result incomplete; no restart.'}
  $taskObserved=Read-F28Json $taskResult 4194304;Assert-F28Result $taskObserved $taskPhase
  $taskWorkspaceState=Read-F28Json $taskWorkspaceFile;if(@($taskWorkspaceState.folders).Count -ne 1 -or @($taskWorkspaceState.PSObject.Properties.Name|Where-Object{$_ -cnotin @('folders','settings')}).Count -ne 0 -or ($taskWorkspaceState.settings -and @($taskWorkspaceState.settings.PSObject.Properties).Count -ne 0)){throw 'Saved fixture workspace must return to one root without repository settings.'};$taskSavedRoot=$taskWorkspaceState.folders[0].path;$taskSavedAbsolute=if([IO.Path]::IsPathRooted($taskSavedRoot)){[IO.Path]::GetFullPath($taskSavedRoot)}else{[IO.Path]::GetFullPath((Join-Path $taskExecution $taskSavedRoot))};if(-not $taskSavedAbsolute.Equals($taskWorkspace,[StringComparison]::OrdinalIgnoreCase)){throw 'Saved fixture root drifted.'};Copy-F28New $taskWorkspaceFile (Join-Path $taskRun ($taskPhase+'-workspace.code-workspace.json'))
  $taskAbsence=@();$taskStable=@();foreach($taskObservation in @(1,2)){if($taskObservation -eq 2){Start-Sleep -Milliseconds 250};$taskPresent=Get-Process -Id $taskPid -ErrorAction SilentlyContinue;$taskAbsence+=@{pid=$taskPid;absent=($null -eq $taskPresent);observedAt=[DateTime]::UtcNow.ToString('o')};$taskStable+=@{stdout=(Get-F28Sha $taskOutPath);stderr=(Get-F28Sha $taskErrPath)}}
  if(@($taskAbsence|Where-Object{$_.absent -ne $true}).Count -ne 0 -or $taskStable[0].stdout -cne $taskStable[1].stdout -or $taskStable[0].stderr -cne $taskStable[1].stderr){throw 'Owned PID absence/stable streams unconfirmed; no later launch.'}
  $taskClose.pidAbsentTwice=$true;$taskClose.streamsStable=$true;$taskClose.pidAbsenceObservations=$taskAbsence;$taskClose.streams=@(@{path=$taskOutPath;bytes=(Get-Item -LiteralPath $taskOutPath).Length;sha256=$taskStable[1].stdout},@{path=$taskErrPath;bytes=(Get-Item -LiteralPath $taskErrPath).Length;sha256=$taskStable[1].stderr});Write-F28NewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-absence.json')) $taskClose
  Assert-F28NativeInputs;$taskResults+=@{phase=$taskPhase;passed=$(if($taskPhase -ceq 'primary'){25}else{5});result=$taskResult;sha256=(Get-F28Sha $taskResult);actualCodeClosure=(Join-Path $taskRun ($taskPhase+'-owned-editor-absence.json'))}
  if($taskPhase -ceq 'primary'){$taskState=Join-Path $taskExecution 'f28-restart-state.json';if(-not(Test-Path -LiteralPath $taskState)){throw 'Primary restart basis missing.'};Copy-F28New $taskState (Join-Path $taskRun 'f28-restart-state.json');foreach($taskPeerLeaf in @('f28-peer-ready.json','f28-peer-answer.json','peer-results.json')){Copy-F28New (Join-Path $taskExecution $taskPeerLeaf) (Join-Path $taskRun $taskPeerLeaf)}}
 }finally{if($taskStarted -and $taskProcess.HasExited -and $taskOut.IsCompleted -and $taskErr.IsCompleted){$taskProcess.Dispose()}}
}
Write-F28NewJson (Join-Path $taskRun 'summary.json') @{status='F28_NATIVE30_PASS_NOT_FEATURE_ACCEPTANCE';nativeChecks=30;phases=$taskResults;bindingSha256=$ExpectedBindingSha256;extensionBundleSha256=$taskExpected;workerSha256=$taskWorkerExpected;vsixSha256=$taskExpectedVsix;configuredGitPush='NO_REMAINING_AUTHORITY_NOT_RUN';f26aNative09='USER_DEFERRED_NOT_RUN';independence='LOW';signalsRequested=0}
