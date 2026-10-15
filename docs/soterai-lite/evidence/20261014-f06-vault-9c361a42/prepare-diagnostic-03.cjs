const fs=require('node:fs'),path=require('node:path');
const runner=fs.readFileSync(path.join(__dirname,'run-native-01.ps1'),'utf8').replace("errorName:error instanceof Error ? error.name : 'UnknownFailure'", "errorName:error instanceof Error ? error.name : 'UnknownFailure',fixtureDiagnostic:typeof driver.setupDiagnostic==='function'?driver.setupDiagnostic():undefined");
fs.writeFileSync(path.join(__dirname,'run-native-02.ps1'),runner,{flag:'wx'});
const build=fs.readFileSync(path.join(__dirname,'build-host-01.cjs'),'utf8').replace('prebuilt-host-01','prebuilt-host-02');
fs.writeFileSync(path.join(__dirname,'build-host-02.cjs'),build,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'agent-service-failure-01.json'),JSON.stringify({status:'NOT_EXECUTED',agent:'/root/f04_command_tests',task:'F06 native fixture diagnostic',reason:'Agent usage limit; try again at 11:34 PM reported on earlier run',rootDisposition:'User resumed on 2026-10-15; root continues authorized work. No alternate approval route.'},null,2)+'\n',{flag:'wx'});
console.log('Prepared test-only setup descriptor diagnostic, preserving previous failed native attempts.');
