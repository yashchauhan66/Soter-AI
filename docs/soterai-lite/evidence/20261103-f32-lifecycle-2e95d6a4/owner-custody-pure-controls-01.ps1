# Pure fixture controls only. Does not call any CIM, listener, file fact,
# process helper, token observation, launch or output-writing helper function.
param([Parameter(Mandatory=$true)][string]$SourcePath)
$ErrorActionPreference='Stop'
$taskSyntaxErrors=$null;$taskSyntaxTokens=$null
[void][Management.Automation.Language.Parser]::ParseFile($SourcePath,[ref]$taskSyntaxTokens,[ref]$taskSyntaxErrors)
if(@($taskSyntaxErrors).Count -ne 0){throw 'F32 custody source syntax errors.'}
. $SourcePath
$taskResults=[Collections.Generic.List[object]]::new()
function Assert-F32Pure([string]$Name,[bool]$Condition){
    $taskResults.Add([pscustomobject]@{id=$Name;pass=$Condition})
    if(-not $Condition){throw ('Pure custody control failed: '+$Name)}
}
$taskRoot='D:\SoterAI-Lite-test-profiles\f32-installed-20261103T160000Z-a1b2c3d4'
$taskProfile=$taskRoot+'\Profile'
$taskPatterns=@([IO.File]::ReadAllLines($SourcePath)|Where-Object{$_.Contains('if($taskBinding.runRoot -cnotmatch ')})
Assert-F32Pure 'P01-two-root-guards' ($taskPatterns.Count -eq 2)
$taskIndex=0
foreach($taskLine in $taskPatterns){
    $taskIndex++;$taskStart=$taskLine.IndexOf("'");$taskEnd=$taskLine.IndexOf("'",$taskStart+1)
    $taskPattern=$taskLine.Substring($taskStart+1,$taskEnd-$taskStart-1)
    Assert-F32Pure ('P02-root-positive-'+$taskIndex) ($taskRoot -cmatch $taskPattern)
    Assert-F32Pure ('P03-root-foreign-'+$taskIndex) (('C:\Users\USER\normal-profile') -cnotmatch $taskPattern)
}
Assert-F32Pure 'P04-child-profile' (Test-F32ChildPath -Root $taskRoot -Candidate $taskProfile)
Assert-F32Pure 'P05-sibling-refused' (-not (Test-F32ChildPath -Root $taskRoot -Candidate ($taskRoot+'-other\Profile')))
Assert-F32Pure 'P06-parent-traversal-refused' (-not (Test-F32ChildPath -Root $taskRoot -Candidate ($taskRoot+'\..\Profile')))
Assert-F32Pure 'P07-UNC-refused' (-not (Test-F32ChildPath -Root $taskRoot -Candidate '\\server\share\Profile'))
$taskArguments=Split-F32WindowsArguments ('"C:\Program Files\Code.exe" --user-data-dir="'+$taskProfile+'" --new-window')
Assert-F32Pure 'P08-Windows-quote-parser' ($taskArguments.Count -eq 3 -and $taskArguments[0] -ceq 'C:\Program Files\Code.exe' -and $taskArguments[1] -ceq '--user-data-dir='+$taskProfile)
Assert-F32Pure 'P09-profile-equals-form' (Test-F32ExactProfileArguments -Arguments $taskArguments -Profile $taskProfile)
Assert-F32Pure 'P10-profile-two-argument-form' (Test-F32ExactProfileArguments -Arguments @('Code.exe','--user-data-dir',$taskProfile) -Profile $taskProfile)
Assert-F32Pure 'P11-profile-duplicate-refused' (-not (Test-F32ExactProfileArguments -Arguments @('Code.exe',('--user-data-dir='+$taskProfile),('--user-data-dir='+$taskProfile)) -Profile $taskProfile))
Assert-F32Pure 'P12-profile-suffix-refused' (-not (Test-F32ExactProfileArguments -Arguments @('Code.exe',('--user-data-dir='+$taskProfile+'-other')) -Profile $taskProfile))
Assert-F32Pure 'P13-profile-foreign-refused' (-not (Test-F32ExactProfileArguments -Arguments @('Code.exe','--user-data-dir=C:\Users\USER\normal-profile') -Profile $taskProfile))
$taskQuoteRejected=$false
try{[void](Split-F32WindowsArguments 'Code.exe --user-data-dir="unterminated')}catch{$taskQuoteRejected=$true}
Assert-F32Pure 'P14-malformed-quote-refused' $taskQuoteRejected
[pscustomobject]@{status='PURE_CUSTODY_CONTROLS_PASS_NOT_NATIVE';sourcePath=$SourcePath;controls=$taskResults.ToArray();processQueries=0;listenerQueries=0;helperTokenObservations=0;launches=0;signalsRequested=0}|ConvertTo-Json -Depth 6 -Compress
