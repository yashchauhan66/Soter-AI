$ErrorActionPreference='Stop'
$taskRoot='D:\SoterAI-Lite-test-profiles\f20a-product-20261019T141643Z-1f629d90'
$taskCode='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$taskCli='C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\6d62b1d5da\resources\app\out\cli.js'
$taskPackage=Join-Path $PSScriptRoot 'close-owned-window-01.vsix'
$taskExpected=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'close-owned-window-package-01.json') -Raw|ConvertFrom-Json
if((Get-FileHash -LiteralPath $taskPackage -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskExpected.sha256){throw 'Local fixture bytes changed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive=[IO.Compression.ZipFile]::OpenRead($taskPackage)
try {
 foreach($taskName in @('package.json','close.cjs')){
  $taskEntry=@($taskArchive.Entries|Where-Object{$_.FullName -ceq ('extension/'+$taskName)})
  if($taskEntry.Count -ne 1){throw 'Fixture critical entry missing'}
  $taskStream=$taskEntry[0].Open();$taskBytes=[IO.MemoryStream]::new()
  try{$taskStream.CopyTo($taskBytes);$taskActual=$taskBytes.ToArray()}finally{$taskStream.Dispose();$taskBytes.Dispose()}
  $taskAlgorithm=[Security.Cryptography.SHA256]::Create()
  try{$taskHash=[BitConverter]::ToString($taskAlgorithm.ComputeHash($taskActual)).Replace('-','').ToLowerInvariant()}finally{$taskAlgorithm.Dispose()}
  if($taskHash -cne (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot ('close-owned-window-01/'+$taskName)) -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Fixture manifest/main differ'}
 }
}finally{$taskArchive.Dispose()}
if(-not(Test-Path -LiteralPath $taskCli -PathType Leaf)){throw 'Installed public CLI entry unavailable'}
$taskInfo=[Diagnostics.ProcessStartInfo]::new();$taskInfo.FileName=$taskCode
$taskArgs=@($taskCli,('--user-data-dir='+(Join-Path $taskRoot 'profile')),('--extensions-dir='+(Join-Path $taskRoot 'extensions')),'--install-extension',$taskPackage,'--do-not-sync','--force')
$taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid argument'};'"'+$_+'"'}) -join ' ')
$taskInfo.WorkingDirectory=Join-Path $taskRoot 'workspace';$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
foreach($taskKey in @('SystemRoot','WINDIR','COMSPEC')){$taskValue=[Environment]::GetEnvironmentVariable($taskKey);if($taskValue){$taskInfo.EnvironmentVariables[$taskKey]=$taskValue}}
$taskInfo.EnvironmentVariables['ELECTRON_RUN_AS_NODE']='1'
$taskInfo.EnvironmentVariables['USERPROFILE']=Join-Path $taskRoot 'profile';$taskInfo.EnvironmentVariables['HOME']=Join-Path $taskRoot 'profile';$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskRoot 'public-vendor';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskRoot 'profile/AppData/Local';$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskRoot 'profile/Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskRoot 'profile/Temp'
$taskInfo.EnvironmentVariables['PATH']='C:\Windows\System32;C:\Program Files\nodejs';$taskInfo.EnvironmentVariables['DO_NOT_TRACK']='1'
$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo
try{
 [void]$taskProcess.Start();$taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync()
 if(-not $taskProcess.WaitForExit(30000)){throw 'Owned close-fixture install still pending; no signal sent'}
 $taskOut.GetAwaiter().GetResult();$taskErr.GetAwaiter().GetResult()
 if($taskProcess.ExitCode -ne 0){throw 'Local close fixture install failed'}
}finally{$taskProcess.Dispose()}
