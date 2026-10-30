'use strict';
// Prepare successor tools only. Generated preparation still refuses absent native09 acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');const own=n=>path.join(__dirname,n),put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});
let preparation=fs.readFileSync(own('prepare-affected-native08-05.cjs'),'utf8');
const substitutions=[
 ['accepted native08','accepted native09'],['native-launch-binding-08.json','native-launch-binding-09.json'],['58ab3b7580b966bd4a5405917b08898f90b2452fd4b1f7fff32bbbc9028267ce','ab44ff537291790635b181a85d4a345a66ac1471dbc5e6bb223f83fdd7b879cb'],
 ['affected-native-binding-03.ps1','affected-native-binding-04.ps1'],['affected-functional10-03.ps1','affected-functional10-04.ps1'],['affected-security17-03.ps1','affected-security17-04.ps1'],["'-03.ps1'","'-04.ps1'"],['affected-scope-05.json','affected-scope-06.json'],['affected-packet-binding-05.json','affected-packet-binding-06.json'],['affected-current-materialization-05.json','affected-current-materialization-06.json'],['affected-native08-preparation-05.json','affected-native09-preparation-06.json'],['native-driver-provenance-05.json','native-driver-provenance-06.json'],['CURRENT_NATIVE08','CURRENT_NATIVE09'],['native08 binding58ab3b75','native09 bindingab44ff53']
];
for(const[from,to]of substitutions){assert(preparation.includes(from),from);preparation=preparation.replaceAll(from,to);}
// Keep source admission05/shared02 bound to native07; only the generated output is admission07.
preparation=preparation.replaceAll('affected-current-admission-06.cjs','affected-current-admission-07.cjs');
const from="['native-driver-provenance-04.json','native-driver-provenance-06.json']";assert(preparation.includes(from));
new vm.Script(preparation,{filename:'prepare-affected-native09-06.cjs'});put('prepare-affected-native09-06.cjs',preparation);
let runner=fs.readFileSync(own('run-affected-native08-05.cjs'),'utf8');
for(const[from,to]of [['Native08 acceptance','Native09 acceptance'],['affected-current-admission-06.cjs','affected-current-admission-07.cjs'],['affected-current-materialization-05.json','affected-current-materialization-06.json'],['58ab3b7580b966bd4a5405917b08898f90b2452fd4b1f7fff32bbbc9028267ce','ab44ff537291790635b181a85d4a345a66ac1471dbc5e6bb223f83fdd7b879cb'],['affected-native08-admission-05','affected-native09-admission-06'],['affected-native08-chain','affected-native09-chain'],["-05.json'","-06.json'"],['-native08-05','-native09-06'],['affected-functional-security-03.ps1','affected-functional-security-04.ps1'],["'-InspectionName','05'","'-InspectionName','06'"]]){assert(runner.includes(from),from);runner=runner.replaceAll(from,to);}
new vm.Script(runner,{filename:'run-affected-native09-06.cjs'});put('run-affected-native09-06.cjs',runner);
console.log(JSON.stringify({status:'SUCCESSOR_TOOL_SYNTAX_ONLY_NOT_EXECUTED',nativeAcceptanceRequired:'ab44ff537291790635b181a85d4a345a66ac1471dbc5e6bb223f83fdd7b879cb',families:20,assertions:509,phases:37,nativeRuns:0,configuredPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN'}));
