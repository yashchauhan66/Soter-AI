$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a'
$taskOwner=Join-Path $taskEvidence 'affected-chain-owner-01.json'
$taskOut=Join-Path $taskEvidence 'affected-chain-stdout-01.txt'
$taskErr=Join-Path $taskEvidence 'affected-chain-stderr-01.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing owner evidence refuses duplicate launch'}}
$taskScript=Join-Path $taskEvidence 'run-affected-chain-01.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='AFFECTED_CURRENT_ARTIFACT_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4))
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
