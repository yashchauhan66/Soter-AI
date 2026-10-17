const fs=require('node:fs'),path=require('node:path');
let text=fs.readFileSync(path.join(__dirname,'run-final-local-01.ps1'),'utf8').replaceAll("'final-focused-01'","'final-focused-02'").replaceAll("'typecheck-03'","'typecheck-04'").replaceAll("'full-tests-01'","'full-tests-02'");
text=text.replace("'mcp-canary-boundary','extension'","'mcp-canary-boundary','extension','automatic-ide-protection','readme-accuracy'");
fs.writeFileSync(path.join(__dirname,'run-final-local-02.ps1'),text,{flag:'wx'});
text=fs.readFileSync(path.join(__dirname,'run-native-broker-01.ps1'),'utf8').replace('Native checked Git Bash evidence:','Native owned broker lifecycle evidence:').replace('captured actual registered provider callback and real native terminal/PS/task','private IPC-owned broker lifecycle, concurrent isolated peer window and cooperative child shutdown');
text=text.replace("$taskResults+=@{phase=$taskPhase;", "foreach($taskPeerName in @('peer-ready.json','peer-closed.json','peer-stop.json','restart-binding.json')){ $taskPeerSource=Join-Path $taskExecution $taskPeerName; $taskPeerCopy=Join-Path $taskRun $taskPeerName; if((Test-Path -LiteralPath $taskPeerSource) -and -not(Test-Path -LiteralPath $taskPeerCopy)){Copy-Item -LiteralPath $taskPeerSource -Destination $taskPeerCopy} }\n  $taskResults+=@{phase=$taskPhase;");
fs.writeFileSync(path.join(__dirname,'run-native-broker-01.ps1'),text);
console.log('Final02 unique logs authored; attempt01 artifact still absent, no raw/receipt overwritten');
