"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const old = path.resolve(__dirname, "../20261015-f09-runtime-81e65c2a");
const read = name => fs.readFileSync(path.join(old, name), "utf8").replace(/\r\n/g, "\n");
function replace(text, from, to) { assert.ok(text.includes(from), "Missing source anchor: " + from); return text.replace(from, to); }
function write(name, text) { fs.writeFileSync(path.join(__dirname, name), text, { flag: "wx" }); }
let inspect = read("inspect-vsix-01.ps1").replaceAll("F09", "F10").replaceAll("48", "49");
inspect = replace(inspect, "# F10 scaffolding: execution creates immutable content inspection evidence only.", `param(
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256,
 [ValidatePattern('^[0-9]{2}$')][string]$InspectionName='01'
)
# Execution creates new immutable content inspection/extraction evidence only.`);
inspect = replace(inspect, "$taskVsix=Join-Path $taskLiteRoot 'soterai-lite-0.7.0-f09-20261015-attempt01.vsix'", "$taskVsix=[IO.Path]::GetFullPath($VsixPath)\nAssert-F10Contained $taskLiteRoot $taskVsix\nif([IO.Path]::GetFileName($taskVsix) -notmatch '^soterai-lite-0\\.7\\.0-f10-20261016-attempt[0-9]{2}\\.vsix$'){throw 'An explicitly named new F10 artifact is required.'}");
// Function definitions must precede the first containment invocation.
inspect = replace(inspect, "\nAssert-F10Contained $taskLiteRoot $taskVsix\n", "\n");
inspect = replace(inspect, "$taskOutput=Join-Path $PSScriptRoot 'vsix-extracted-01'", "$taskOutput=Join-Path $PSScriptRoot ('vsix-extracted-'+$InspectionName)");
inspect = replace(inspect, "$taskReport=Join-Path $PSScriptRoot 'vsix-inspection-01.json'", "$taskReport=Join-Path $PSScriptRoot ('vsix-inspection-'+$InspectionName+'.json')");
inspect = replace(inspect, "if(-not(Test-Path -LiteralPath $taskVsix -PathType Leaf))", "Assert-F10Contained $taskLiteRoot $taskVsix\nif(-not(Test-Path -LiteralPath $taskVsix -PathType Leaf))");
inspect = replace(inspect, "$taskVsixBytes=(Get-Item -LiteralPath $taskVsix).Length", "$taskVsixBytes=(Get-Item -LiteralPath $taskVsix).Length\nif($taskVsixHash -cne $ExpectedVsixSha256.ToLowerInvariant()){throw 'Exact new VSIX SHA256 binding failed.'}");
inspect = inspect.replaceAll("soterai.lite.vaultRuntime", "soterai.lite.ps51Terminal");
inspect = inspect.replaceAll("'soterai.configureVaultApp','soterai.runVaultApp','soterai.stopVaultApp','soterai.vaultAppStatus'", "'soterai.configureCheckedPowerShell','soterai.openCheckedPowerShell','soterai.runCheckedPowerShell','soterai.restoreCheckedPowerShell','soterai.checkedPowerShellStatus'");
inspect = replace(inspect, " foreach($taskGroup in @('taskDefinitions','debuggers')){", ` $taskProfile=@($Manifest.contributes.terminal.profiles|Where-Object{$_.id -ceq 'soterai.ps51.checked'})
 if($taskProfile.Count -ne 1 -or $taskProfile[0].title -cne 'SoterAI PowerShell 5.1 (checked commands)'){throw 'Missing or duplicate F10 contributed profile.'}
 foreach($taskCommand in @('soterai.configureCheckedPowerShell','soterai.openCheckedPowerShell','soterai.runCheckedPowerShell','soterai.restoreCheckedPowerShell','soterai.checkedPowerShellStatus')){
  $taskGate=@($Manifest.contributes.menus.commandPalette|Where-Object{$_.command -ceq $taskCommand})
  if($taskGate.Count -ne 1 -or $taskGate[0].when -cne 'soterai.advancedCommands'){throw 'Missing F10 advanced command gate.'}
 }
 foreach($taskGroup in @('taskDefinitions','debuggers')){`);
inspect = replace(inspect, "$taskManifestBytes=$taskContents['extension/package.json']", `if(@($taskProvenance.inventory|Where-Object{$_.name -ceq 'extension.js'})[0].sha256 -cne $ExpectedBundleSha256.ToLowerInvariant()){throw 'Exact extracted extension runtime SHA256 binding failed.'}
$taskScannedText=@()
$taskForbiddenPaths=@($taskRepoRoot,$taskRepoRoot.Replace('\\','\\\\'),[Environment]::GetFolderPath('UserProfile'),[Environment]::GetFolderPath('UserProfile').Replace('\\','\\\\'),'D:\\SoterAI-Lite-test-profiles','D:\\\\SoterAI-Lite-test-profiles')|Where-Object{$_ -and $_.Length -gt 3}|Select-Object -Unique
foreach($taskTextName in @($taskAllowed|Where-Object{$_ -notmatch '\\.png$'})){
 $taskText=[Text.UTF8Encoding]::new($false,$true).GetString($taskContents[$taskTextName])
 foreach($taskForbiddenPath in $taskForbiddenPaths){if($taskText.IndexOf($taskForbiddenPath,[StringComparison]::OrdinalIgnoreCase) -ge 0){throw ('Local workspace/profile path found in '+$taskTextName)}}
 $taskScannedText+=@{path=$taskTextName;utf8=$true;localWorkspaceOrProfileMatches=0}
}
$taskManifestBytes=$taskContents['extension/package.json']`);
inspect = replace(inspect, "machineSettings=49;runtimeFlag=", "profileId='soterai.ps51.checked';localPathScannedEntries=$taskScannedText;localPathScanScope='Exact current workspace/user-profile paths and isolated synthetic-profile prefix, literal and JavaScript-escaped; system executable paths are intentional';machineSettings=49;runtimeFlag=");
write("inspect-vsix-01.ps1", inspect);

const bindingParams = `    [Parameter(Mandatory=$true)][string]$VsixPath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256,`;
for (const kind of ["functional", "security"]) {
 let text = read("run-" + kind + "-01.ps1");
 text = replace(text, "param(", "param(\n" + bindingParams);
 if (kind === "functional") text = replace(text, "    [string]$ExtensionRoot", "    [Parameter(Mandatory=$true)][string]$ExtensionRoot");
 else text = replace(text, "    [string]$ExtensionRoot, [switch]$UsePrebuilt, [string]$HostTestsPath)", "    [Parameter(Mandatory=$true)][string]$ExtensionRoot, [switch]$UsePrebuilt, [Parameter(Mandatory=$true)][string]$HostTestsPath)");
 text = replace(text, "$ErrorActionPreference = 'Stop'", "$ErrorActionPreference = 'Stop'\n. (Join-Path $PSScriptRoot 'f10-artifact-binding-01.ps1')\nAssert-F10RuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $ExtensionRoot -ExpectedBundleSha256 $ExpectedBundleSha256");
 if (kind === "security") {
  const begin = text.indexOf("if (-not $UsePrebuilt) {"), end = text.indexOf("foreach ($name in @('extension.js'", begin);
  assert.ok(begin >= 0 && end > begin);
  text = text.slice(0, begin) + "if(-not $UsePrebuilt){throw 'F10 affected checks require the exact inspected prebuilt artifact; rebuilding is refused.'}\n" + text.slice(end);
  text = replace(text, "limitation='Working-tree launch; hashes identify prepared bytes, not an immutable complete runtime.'", "vsixPath=[IO.Path]::GetFullPath($VsixPath);vsixSha256=$ExpectedVsixSha256.ToLowerInvariant();limitation='Inspected F10 extracted runtime, explicit artifact/runtime binding; LOW scripted baseline route.'");
 }
 if (kind === "functional") text = replace(text, "extensionBundleSha256=$bundleHash; hostTestsSha256=", "vsixPath=[IO.Path]::GetFullPath($VsixPath);vsixSha256=$ExpectedVsixSha256.ToLowerInvariant();extensionBundleSha256=$bundleHash; hostTestsSha256=");
 const exit = kind === "functional" ? "exit $hostExit" : "exit $hostExitCode";
 text = replace(text, exit, "Assert-F10RuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $ExtensionRoot -ExpectedBundleSha256 $ExpectedBundleSha256\n" + exit);
 write("run-" + kind + "-01.ps1", text);
}
let affected = read("run-affected-hosts-01.ps1").replaceAll("F09", "F10");
affected = replace(affected, "param(\n", "param(\n    [Parameter(Mandatory=$true)][string]$VsixPath,\n    [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,\n    [ValidatePattern('^[0-9]{2}$')][string]$InspectionName='01',\n");
affected = replace(affected, "$taskSource=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'", "$taskSource=Join-Path $PSScriptRoot ('vsix-extracted-'+$InspectionName+'/extension')\n. (Join-Path $PSScriptRoot 'f10-artifact-binding-01.ps1')\nAssert-F10RuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskSource -ExpectedBundleSha256 $ExpectedBundleSha256");
affected = replace(affected, "$taskExpected=$ExpectedBundleSha256.ToLowerInvariant()", "$taskExpected=$ExpectedBundleSha256.ToLowerInvariant()\n$taskVsixFull=[IO.Path]::GetFullPath($VsixPath)\n$taskExpectedVsix=$ExpectedVsixSha256.ToLowerInvariant()");
affected = replace(affected, "    $taskOutput=Join-Path $taskRunRoot $Name", "    Assert-F10RuntimeBinding -VsixPath $taskVsixFull -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected\n    $taskOutput=Join-Path $taskRunRoot $Name");
affected = replace(affected, "    if((Get-FileHash -LiteralPath $taskBundle", "    Assert-F10RuntimeBinding -VsixPath $taskVsixFull -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected\n    if((Get-FileHash -LiteralPath $taskBundle");
affected = replace(affected, "sourceExtension=$taskSource;extensionBundleSha256=", "vsixPath=$taskVsixFull;vsixSha256=$taskExpectedVsix;sourceExtension=$taskSource;extensionBundleSha256=");
affected = affected.replaceAll("'-ExtensionRoot',$taskSource)", "'-ExtensionRoot',$taskSource,'-VsixPath',$taskVsixFull,'-ExpectedVsixSha256',$taskExpectedVsix,'-ExpectedBundleSha256',$taskExpected)");
affected = replace(affected, "schemaVersion=1;status='PASS_SCOPED';extensionBundleSha256=", "schemaVersion=1;status='PASS_SCOPED';vsixPath=$taskVsixFull;vsixSha256=$taskExpectedVsix;extensionBundleSha256=");
write("run-affected-hosts-01.ps1", affected);
process.stdout.write("Prepared four F10 scripts from retained F09 templates; no inspected artifact or host was executed.\n");
