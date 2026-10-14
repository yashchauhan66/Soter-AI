const fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const prior = path.join(repo, 'docs/soterai-lite/evidence/20261013-f02-policy-6fb804da');
const write = (name, content) => fs.writeFileSync(path.join(__dirname, name), content, {flag:'wx'});
let native = fs.readFileSync(path.join(prior, 'run-f02-native-host.ps1'), 'utf8');
native = native.replaceAll('F02', 'F03').replaceAll('f02', 'f03')
    .replace("$taskProfile=Join-Path $taskRun 'profile'", "$taskProfile=Join-Path 'D:\\SoterAI-Lite-test-profiles' ((Split-Path -Leaf $taskRun)+'/profile')")
    .replace("$taskInstalled=Join-Path $taskRun 'extensions'", "$taskInstalled=Join-Path (Split-Path -Parent $taskProfile) 'extensions'")
    .replace("require('./host/index.js').run()", "require('./host/index.js').run(context)")
    .replace("$taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile", "$taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp'\n $taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'\n [void][IO.Directory]::CreateDirectory((Join-Path $taskProfile 'Temp'))\n $taskInfo.EnvironmentVariables['USERPROFILE']=$taskProfile");
write('run-f03-native-host-01.ps1', native);
for (const [source, target] of [['run-project-privacy-host.ps1','run-functional-01.ps1'],['run-security-review-host.ps1','run-security-01.ps1']]) {
    let script = fs.readFileSync(path.join(repo, 'packages/vscode-extension/scripts', source), 'utf8');
    script = script.replace("Join-Path $PSScriptRoot '../../..'", "Join-Path $PSScriptRoot '../../../..'")
        .replace("$profile = Join-Path $runRoot 'profile'", "$profile = Join-Path 'D:\\SoterAI-Lite-test-profiles' ($runId+'/profile')")
        .replace("$installed = Join-Path $runRoot 'extensions'", "$installed = Join-Path (Split-Path -Parent $profile) 'extensions'")
        .replace("$labRoot = Join-Path ([IO.Path]::GetTempPath())", "$labRoot = Join-Path 'D:\\SoterAI-Lite-test-profiles'");
    write(target, script);
}
const inspection = fs.readFileSync(path.join(prior, 'inspect-vsix-attempt04.ps1'), 'utf8')
    .replaceAll('f02-20261013-attempt04', 'f03-20261014-attempt01').replaceAll('vsix-extracted-04', 'vsix-extracted-01').replaceAll('vsix-inspection-04', 'vsix-inspection-01');
write('inspect-vsix-01.ps1', inspection);
console.log(JSON.stringify({status:'PREPARED_NOT_RUN', profileRoot:'D:/SoterAI-Lite-test-profiles', priorHarnessBytesPreserved:true}));
