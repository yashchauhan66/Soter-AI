$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
. (Join-Path $PSScriptRoot 'affected-native-binding-07.ps1')
$VsixPath=Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26b-20261029-attempt01.vsix'
$ExpectedVsixSha256='6c299712aa6f8da35b32bacc12b3e4b26b9e5d26689a2fdcb7b06eadb186d12b'
$ExpectedBundleSha256='786882b16d9010834a5b0372860f16b900750ef9df605cfec23ae763d5f1e3e1'
$HostTestsPath=$null
$taskWrong=Join-Path $PSScriptRoot 'vsix-extracted-09/extension'
$taskRight=Join-Path $PSScriptRoot 'vsix-extracted-03/extension'
$taskRefused=$false
try{Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskWrong -ExpectedBundleSha256 $ExpectedBundleSha256}catch{if($_.Exception.Message -cne 'F26c exact extracted extension required.'){throw};$taskRefused=$true}
if(-not $taskRefused){throw 'Wrong archive suffix unexpectedly accepted.'}
'ok 1 - unchanged guard refuses output suffix09 as an archive source'
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskRight -ExpectedBundleSha256 $ExpectedBundleSha256
'ok 2 - unchanged guard admits exact archive03 and all retained entry bytes'
'1..2'
'# tests 2'
'# pass 2'
'# fail 0'
'# scope read-only prelaunch selection only; no Code process, profile or Git push'
