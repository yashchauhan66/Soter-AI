'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const previous=path.resolve(__dirname,'../20261018-f16-gateway-policy-6e9a31d4'),repo=path.resolve(__dirname,'../../../..');
const write=(file,text)=>fs.writeFileSync(file,text,{flag:'wx'});
for(const file of ['inspect-vsix-01.ps1','artifact-binding-01.ps1','run-functional-01.ps1','run-security-01.ps1','run-affected-hosts-01.ps1','run-hosts-01.ps1','run-native-broker-01.ps1','build-native-hosts-01.cjs']){
 let text=fs.readFileSync(path.join(previous,file),'utf8').replaceAll('20261018-f16-gateway-policy-6e9a31d4','20261018-f17-safe-read-73bc91a2').replaceAll('f16-20261018','f17-20261018').replaceAll('F16','F17').replaceAll('f16-native-host','f17-native-host');
 if(['inspect-vsix-01.ps1','artifact-binding-01.ps1'].includes(file))text=text.replaceAll('0-f16-','0-f17-');
 if(file==='inspect-vsix-01.ps1')text=text.replaceAll('soterai.lite.gatewayPolicy','soterai.lite.safeReadMcp').replaceAll('Count -ne 61','Count -ne 62').replaceAll('61 machine','62 machine');
 if(file==='run-native-broker-01.ps1')text=text.replaceAll('nativeChecks=94','nativeChecks=106').replaceAll("'primary'){91}","'primary'){103}");
 if(file==='build-native-hosts-01.cjs')text=text.replaceAll('liteGatewayPolicy.host.ts','liteSafeReadMcp.host.ts');
 write(path.join(__dirname,file),text);
}
let native=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/liteGatewayPolicy.host.ts'),'utf8');
native='import {installSafeReadMcpProbe, runSafeReadMcpChecks} from "./liteSafeReadMcpChecks.host";\n'+native;
native=native.replaceAll('SOTERAI_LITE_F16','SOTERAI_LITE_F17');
assert.ok(native.includes('setup = { phase: "harness-installed" };'));native=native.replace('setup = { phase: "harness-installed" };','installSafeReadMcpProbe(patch); setup = { phase: "harness-installed" };');
native=native.replace('phase === "primary" ? 91 : 3','phase === "primary" ? 103 : 3');
native=native.replace('id: phase === "primary" && i >= 80 ?', 'id: phase === "primary" && i >= 91 ? "F17-M" + String(i - 90).padStart(2,"0") : phase === "primary" && i >= 80 ?');
native=native.replace('await check(16, async () => { await stopped(current);','await runSafeReadMcpChecks({context,check});\n            await check(16, async () => { await stopped(current);');
write(path.join(repo,'packages/vscode-extension/src/__tests__/host/liteSafeReadMcp.host.ts'),native);
console.log('Copied retained F16 checks unchanged; added twelve F17 native route checks; new fixture not yet executed.');
