$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskH=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7'
$taskOwner=Join-Path $taskH 'affected-current-chain-owner-09.json'
$taskOut=Join-Path $taskH 'affected-current-chain-stdout-09.txt'
$taskErr=Join-Path $taskH 'affected-current-chain-stderr-09.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing affected owner refuses automatic retry'}}
$taskNative=Get-Content -LiteralPath (Join-Path $taskH 'native08-acceptance-01.json') -Raw|ConvertFrom-Json
if($taskNative.status -cne 'NATIVE34_AND_ACTUAL_OFFLINE_OWNER_PASS' -or -not $taskNative.allOwnersClosed -or -not $taskNative.bothEOFEverywhere){throw 'Fresh native34/offline acceptance and closure required'}
$taskScript=Join-Path $taskH 'run-affected-current-09.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='AFFECTED_CURRENT20_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;automaticRetry=$false}
$taskFd=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 5));$taskFd.Write($taskBytes,0,$taskBytes.Length)}finally{$taskFd.Dispose()}
$taskValue|ConvertTo-Json -Compress
