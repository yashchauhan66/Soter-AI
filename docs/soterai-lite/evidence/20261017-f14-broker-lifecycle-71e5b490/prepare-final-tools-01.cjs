const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'../../../..'),old=path.resolve(__dirname,'../20261017-f13-gitbash-291c8e70');
for(const name of ['inspect-vsix-01.ps1','artifact-binding-01.ps1','run-check-01.ps1','run-functional-01.ps1','run-security-01.ps1','run-affected-hosts-01.ps1','run-native-bash-01.ps1']){
 let text=fs.readFileSync(path.join(old,name),'utf8').replaceAll('20261017-f13-gitbash-291c8e70','20261017-f14-broker-lifecycle-71e5b490');
 text=text.replaceAll('F13','F14').replaceAll('f13','f14');
 if(name==='inspect-vsix-01.ps1')text=text.replaceAll('51','52').replaceAll('soterai.lite.gitBashTerminal','soterai.lite.gatewayLifecycle');
 fs.writeFileSync(path.join(__dirname,name==='run-native-bash-01.ps1'?'run-native-broker-01.ps1':name),text,{flag:'wx'});
}
// Correct a compiler-only duplicate-property diagnostic without changing expectations.
const f=path.join(repo,'packages/vscode-extension/src/__tests__/ownedBrokerLifecycle.test.ts');let t=fs.readFileSync(f,'utf8');assert.ok(t.includes('Response.json({ session: new Headers(init?.headers).get("x-soterai-session"), ...body })'));fs.writeFileSync(f,t.replace('Response.json({ session: new Headers(init?.headers).get("x-soterai-session"), ...body })','Response.json(Object.assign({ session: new Headers(init?.headers).get("x-soterai-session") }, body))'));
console.log('F14 final tools prepared, not executed');
