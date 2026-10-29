$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7'
$taskOwner=Join-Path $taskEvidence 'native07-chain-owner-01.json'
$taskOut=Join-Path $taskEvidence 'native07-chain-stdout-01.txt'
$taskErr=Join-Path $taskEvidence 'native07-chain-stderr-01.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr,(Join-Path $taskEvidence 'native07-consumption-01.json'))){if(Test-Path -LiteralPath $taskFile){throw 'Existing owner/consumption refuses duplicate native07 launch'}}
$taskApproval=Get-Content -LiteralPath (Join-Path $taskEvidence 'native07-user-approval-01.json') -Raw|ConvertFrom-Json
if($taskApproval.status -cne 'EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE07' -or $taskApproval.allowedAttempts -ne 1){throw 'Single exact user approval required'}
$taskScript=Join-Path $taskEvidence 'run-native07-chain-01.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='ONE_APPROVED_NATIVE07_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;automaticRetry=$false}
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4));$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
