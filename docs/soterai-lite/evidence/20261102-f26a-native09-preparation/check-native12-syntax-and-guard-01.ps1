$ErrorActionPreference='Stop'
foreach($taskName in @('native12-current-candidate-01.ps1.txt','native12-current-preapproval-01.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if($taskErrors.Count -ne 0){throw ($taskName+': '+($taskErrors.Message -join '; '))}
}
& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot 'run-native12-current-chain-01.cjs')
if($LASTEXITCODE -ne 0){throw 'Native12 runner syntax failed.'}
$taskText=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'native12-current-candidate-01.ps1.txt'))
$taskBegin=$taskText.IndexOf('   $taskPrimaryState=Get-Content')
$taskEnd=$taskText.IndexOf('   $taskOfflineInput=Join-Path',$taskBegin)
if($taskBegin -lt 0 -or $taskEnd -le $taskBegin){throw 'Exact guard block missing'}
$taskBody=$taskText.Substring($taskBegin,$taskEnd-$taskBegin)
$taskGuard=[ScriptBlock]::Create('param([string]$taskState,[string]$taskWorkspace)'+[Environment]::NewLine+$taskBody+[Environment]::NewLine+'return $taskOfflineRoot')
$taskRoot='D:\SoterAI-Lite-test-profiles\f26a-precommit-native-20261102T140059Z-3bd8bf22\workspace'
$taskLower='d'+$taskRoot.Substring(1)
$taskCases=@(
 @{name='01-drive-lower';workspace=$taskRoot;root=$taskLower;pass=$true},
 @{name='02-drive-upper';workspace=$taskLower;root=$taskRoot;pass=$true},
 @{name='03-exact';workspace=$taskRoot;root=$taskRoot;pass=$true},
 @{name='04-other-drive';workspace=$taskRoot;root=('E'+$taskRoot.Substring(1));pass=$false},
 @{name='05-other-root';workspace=$taskRoot;root=$taskLower.Replace('workspace','other');pass=$false},
 @{name='06-other-case';workspace=$taskRoot;root=$taskLower.Replace('SoterAI-Lite','soterai-lite');pass=$false},
 @{name='07-traversal';workspace=$taskRoot;root=$taskLower.Replace('workspace','..\workspace');pass=$false}
)
$taskDir=Join-Path $PSScriptRoot 'native12-drive-guard-controls-01'
if(Test-Path -LiteralPath $taskDir){throw 'Existing controls refused'}
[void][IO.Directory]::CreateDirectory($taskDir)
$taskResults=@()
foreach($taskCase in $taskCases){
 $taskFile=Join-Path $taskDir ($taskCase.name+'.json')
 [IO.File]::WriteAllText($taskFile,(@{root=$taskCase.root}|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
 $taskSucceeded=$false;$taskReturned=$null
 try{$taskReturned=& $taskGuard $taskFile $taskCase.workspace;$taskSucceeded=$true}catch{}
 if($taskSucceeded -ne $taskCase.pass -or ($taskSucceeded -and $taskReturned -cne $taskCase.root)){throw ('Guard control failed: '+$taskCase.name)}
 $taskResults+=@{id=$taskCase.name;status='PASS';expectedAdmitted=$taskCase.pass}
}
@{status='PASS_PS2_JS1_SYNTAX_AND_EXACT_EXTRACTED_PS_ROOT_GUARD7_COMPONENT_ONLY';controls=$taskResults;nativeLaunches=0;signalsRequested=0}|ConvertTo-Json -Depth 6
