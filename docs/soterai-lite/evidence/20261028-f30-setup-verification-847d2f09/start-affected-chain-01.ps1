$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f30-setup-verification-847d2f09'
$taskOwner=Join-Path $taskEvidence 'affected-chain-owner-01.json'
$taskOut=Join-Path $taskEvidence 'affected-chain-stdout-01.txt'
$taskErr=Join-Path $taskEvidence 'affected-chain-stderr-01.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing affected owner refuses duplicate launch'}}
$taskNative=Get-Content -LiteralPath (Join-Path $taskEvidence 'native-chain-result-02.json') -Raw | ConvertFrom-Json
if($taskNative.status -cne 'NATIVE_WRAPPER_CLOSED_PASS_ROOT_AGGREGATION_PENDING' -or -not $taskNative.actualClose -or -not $taskNative.stdoutEOF -or -not $taskNative.stderrEOF){throw 'Current native owner must pass and close first'}
$taskScript=Join-Path $taskEvidence 'run-affected-chain-01.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='F30_AFFECTED166_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4));$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
