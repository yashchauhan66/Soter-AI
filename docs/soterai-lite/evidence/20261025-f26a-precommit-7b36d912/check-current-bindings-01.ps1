$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$CodePath='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
foreach($taskName in @('inspect-vsix-01.ps1','artifact-binding-01.ps1','host-current-binding-01.ps1')){
 $taskTokens=$null;$taskErrors=$null
 [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors)
 if(@($taskErrors).Count -ne 0){throw ('Bound PowerShell syntax failed: '+$taskName)}
}
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
. (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath (Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix') -ExpectedVsixSha256 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91' -ExtensionRoot (Join-Path $PSScriptRoot 'vsix-extracted-01/extension') -ExpectedBundleSha256 'f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184'
Write-Output 'Current bound syntax,989source inputs,21built drivers,full receipt,installed Code and exactfour-runtime extraction checks PASS; no Code/native launch.'
