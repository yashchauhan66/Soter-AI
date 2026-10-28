$ErrorActionPreference='Stop'
$taskRepo=(Get-Location).Path
$taskEvidence=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261028-f30-setup-verification-847d2f09'
$taskOwner=Join-Path $taskEvidence 'native-chain-owner-02.json'
$taskOut=Join-Path $taskEvidence 'native-chain-stdout-02.txt'
$taskErr=Join-Path $taskEvidence 'native-chain-stderr-02.txt'
foreach($taskFile in @($taskOwner,$taskOut,$taskErr)){if(Test-Path -LiteralPath $taskFile){throw 'Existing native owner evidence refuses duplicate launch'}}
$taskSerial=Get-Content -LiteralPath (Join-Path $taskEvidence 'serial-result-03.json') -Raw | ConvertFrom-Json
if($taskSerial.status -cne 'CURRENT_F30_SERIAL_SOURCE_AND_PACKAGE_PASS_NATIVE_CONTENT_PENDING'){throw 'Current serial run must pass and close before native launch'}
$taskScript=Join-Path $taskEvidence 'run-native-chain-02.cjs'
$taskProcess=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @('"'+$taskScript+'"') -WorkingDirectory $taskRepo -WindowStyle Hidden -RedirectStandardOutput $taskOut -RedirectStandardError $taskErr -PassThru
$taskValue=[ordered]@{status='F30_FIRST_NORMAL_IMPROVEMENT_STARTED_NOT_COMPLETED';pid=$taskProcess.Id;observedAt=[DateTime]::UtcNow.ToString('o');script=$taskScript;stdout=$taskOut;stderr=$taskErr;signalsRequested=0;native06='F26a_USER_DEFERRED_NOT_RUN'}
$taskBytes=[Text.Encoding]::UTF8.GetBytes(($taskValue|ConvertTo-Json -Depth 4))
$taskStream=[IO.File]::Open($taskOwner,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Compress
