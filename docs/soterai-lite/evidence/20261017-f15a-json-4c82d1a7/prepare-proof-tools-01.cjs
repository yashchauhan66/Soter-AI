const fs=require('node:fs'),path=require('node:path');
let lib=fs.readFileSync(path.join(__dirname,'../20261017-f14-broker-lifecycle-71e5b490/f14-evidence-lib.cjs'),'utf8');
const sources=['apps/local-ai-broker/src/BoundedJson.ts','apps/local-ai-broker/src/BrokerServer.ts','apps/local-ai-broker/src/cli.ts','packages/vscode-extension/src/broker/BrokerManager.ts','packages/vscode-extension/src/__tests__/gatewayJsonDecoder.test.ts','packages/vscode-extension/src/__tests__/gatewayJsonWire.test.ts','packages/vscode-extension/src/__tests__/ownedBrokerManager.test.ts','packages/vscode-extension/src/__tests__/host/liteGatewayJson.host.ts','packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','packages/soterai-lite/README.md','docs/vscode-extension-readiness.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md'];
lib=lib.replace(/const sourcePaths = \[[\s\S]*?\];\r?\nconst indexOnlyPaths = \[[\s\S]*?\];/, 'const sourcePaths = '+JSON.stringify(sources,null,2)+';\nconst indexOnlyPaths = ["docs/soterai-lite/LITE-CATALOG.json"];');
fs.writeFileSync(path.join(__dirname,'f15a-evidence-lib.cjs'),lib,{flag:'wx'});
for(const [from,to] of [['check-staged-02.cjs','check-staged-01.cjs'],['verify-commit-02.cjs','verify-commit-01.cjs']]){
 let s=fs.readFileSync(path.join(__dirname,'../20261017-f14-broker-lifecycle-71e5b490',from),'utf8').replaceAll('f14','f15a').replaceAll('F14','F15a').replaceAll('-02.', '-01.');
 s=s.replace('assert.equal(queue.activeFeature, "F15a"); assert.equal(queue.features.find(row => row.id === "F15a").status, "ACTIVE");', 'assert.equal(queue.activeFeature, "F15"); assert.equal(queue.features.find(row => row.id === "F15").subcards.find(row => row.id === "F15a").status, "ACTIVE");');
 fs.writeFileSync(path.join(__dirname,to),s,{flag:'wx'});
}
let commit=fs.readFileSync(path.join(__dirname,'../20261017-f14-broker-lifecycle-71e5b490/commit-f14-02.ps1'),'utf8').replaceAll('f14','f15a').replaceAll('F14','F15a').replaceAll('-02.', '-01.');
commit=commit.replace(/& git -c core.autocrlf=false add --renormalize -- packages[^\n]*\r?\nif\([^\n]*\r?\n/,'');
commit=commit.replace('docs(lite): align F15a indexed baseline bytes and preserve failed proof','feat(lite): bound complete JSON gateway bodies and withdraw safely');
fs.writeFileSync(path.join(__dirname,'commit-f15a-01.ps1'),commit,{flag:'wx'});
console.log('Prepared F15a scoped byte proof helpers; not executed.');
