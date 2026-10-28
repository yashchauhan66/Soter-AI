$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f29-protection-center-6c93e15a'
$taskOwner=Join-Path $taskEvidence 'native-chain-owner-05.json'
$taskOut=Join-Path $taskEvidence 'native-chain-stdout-05.txt'
$taskErr=Join-Path $taskEvidence 'native-chain-stderr-05.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing native owner evidence refuses duplicate launch'}}
$taskApproval=Join-Path $taskEvidence 'extra05-approval-01.json'
if(-not(Test-Path -LiteralPath $taskApproval)){throw 'Explicit single-extra user approval is required; nothing launched'}
$taskAffected=Join-Path $taskEvidence 'affected-acceptance-04.json'
if(-not(Test-Path -LiteralPath $taskAffected)){throw 'Current affected owner must finish before another native launch'}
$taskAffectedResult=Get-Content -LiteralPath $taskAffected -Raw -Encoding UTF8|ConvertFrom-Json
if($taskAffectedResult.status -cne 'PASS_CURRENT_AFFECTED66_FUNCTIONAL10_SECURITY17_UNCHANGED_RENDERER_REQUIRED'){throw 'Current affected batch has not passed and closed'}
$taskScript=Join-Path $taskEvidence 'run-f29-native-chain-05.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='EXPLICIT_SINGLE_EXTRA05_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4))
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
