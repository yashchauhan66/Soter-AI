param([Parameter(Mandatory=$true)][ValidateSet('serial','native')][string]$Kind)
$ErrorActionPreference='Stop'
$taskRevision=if($Kind -eq 'serial'){'01'}else{'01'}
$taskStartPath=Join-Path $PSScriptRoot ('durable-'+$Kind+'-start-'+$taskRevision+'.json')
$taskStart=Get-Content -LiteralPath $taskStartPath -Raw -Encoding UTF8|ConvertFrom-Json
$taskInnerPath=Join-Path $PSScriptRoot ($Kind+'-gates-'+$taskRevision+'.txt')
$taskInner=Get-Content -LiteralPath ($taskInnerPath+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskInner.exitCode -ne 0 -or (Get-FileHash -LiteralPath $taskInnerPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInner.sha256.ToLowerInvariant()){throw 'Passing actual inner receipt/hash required.'}
if((Get-FileHash -LiteralPath $taskStart.entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskStart.entrySha256){throw 'Recorded entry bytes changed.'}
$taskOwned=@(Get-CimInstance Win32_Process -Filter ('ProcessId = '+[string][int]$taskStart.pid))
if($taskOwned.Count -ne 0){throw 'Owned wrapper still present; no byte indexing.'}
function Read-F23Streams {
 return @(@($taskStart.stdout,$taskStart.stderr)|ForEach-Object{@{path=$_;bytes=(Get-Item -LiteralPath $_).Length;sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()}})
}
$taskFirst=Read-F23Streams
Start-Sleep -Milliseconds 500
$taskSecond=Read-F23Streams
if(($taskFirst|ConvertTo-Json -Compress) -cne ($taskSecond|ConvertTo-Json -Compress)){throw 'Owned wrapper streams remain unstable.'}
$taskValue=@{status='PASS_INNER_RECEIPT_OWNED_RUNNER_ABSENT_STABLE_STREAMS';kind=$Kind;innerExitCode=0;runnerAbsent=$true;pid=$taskStart.pid;wrapperExitCode=$null;wrapperExitObserved=$false;signalsRequested=0;streams=$taskSecond;observedAt=[DateTime]::UtcNow.ToString('o')}
$taskOut=Join-Path $PSScriptRoot ('durable-'+$Kind+'-exit-'+$taskRevision+'.json')
$taskBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskValue|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
$taskStream=[IO.File]::Open($taskOut,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$taskStream.Write($taskBytes,0,$taskBytes.Length)}finally{$taskStream.Dispose()}
$taskValue|ConvertTo-Json -Depth 10
