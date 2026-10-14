const fs=require('node:fs'),path=require('node:path');
let script=fs.readFileSync(path.join(__dirname,'run-f03-current-native-host-04.ps1'),'utf8');
script=script.replace("('current-native-host-'+","('current-native-d-host-'+")
 .replace("$taskWorkspace=Join-Path $taskRun 'workspace'", "$taskWorkspace=Join-Path (Split-Path -Parent $taskProfile) 'workspace'")
 .replace("$taskInstalled=Join-Path (Split-Path -Parent $taskProfile) 'extensions'", "$taskInstalled=Join-Path (Split-Path -Parent $taskProfile) 'extensions'")
 .replace("'soterai.cloud.enabled'=$false", "'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;'soterai.cloud.enabled'=$false")
 .replace("'--disable-extensions','--disable-workspace-trust'", "'--disable-extensions','--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication','--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm','--disable-extension=vscode.extension-editing','--disable-workspace-trust'")
 .replace("$taskResultPath=Join-Path $taskRun ($taskPhase+'-results.json')", "$taskResultPath=Join-Path (Split-Path -Parent $taskProfile) ($taskPhase+'-results.json')")
 .replace("if($taskResults.failed", "if($taskResults.failed")
 .replace("Write-Output ('Native phase completed: '+$taskPhase)", "Copy-Item -LiteralPath $taskResultPath -Destination (Join-Path $taskRun ($taskPhase+'-results.json'))\n  Write-Output ('Native phase completed: '+$taskPhase)")
 .replace("$taskFreeze=@{codeExecutableSha256=", "$taskFreeze=@{executionEvidenceRoot=(Split-Path -Parent $taskProfile);syntheticWorkspaceOutsideOriginalRepository=$true;testOnlyBuiltinGitAndAIDisabled=$true;codeExecutableSha256=");
fs.writeFileSync(path.join(__dirname,'run-f03-current-d-host-05.ps1'),script,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',scope:'Current1.141.1; synthetic workspace/profile/raw phase results on D; no parent original repository or built-in AI/Git workload; source runtime unchanged.'}));
