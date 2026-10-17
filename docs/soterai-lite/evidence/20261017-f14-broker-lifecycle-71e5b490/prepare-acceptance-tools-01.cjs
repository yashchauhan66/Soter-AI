const fs=require('node:fs'),path=require('node:path'),old=path.resolve(__dirname,'../20261017-f13-gitbash-291c8e70');
const sourcePaths=['docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md','docs/vscode-extension-readiness.md','apps/local-ai-broker/src/BrokerServer.ts','apps/local-ai-broker/src/cli.ts','packages/vscode-extension/src/broker/BrokerManager.ts','packages/vscode-extension/src/broker/OwnedBrokerLifecycle.ts','packages/vscode-extension/src/broker/commands.ts','packages/vscode-extension/src/__tests__/ownedBrokerLifecycle.test.ts','packages/vscode-extension/src/__tests__/ownedBrokerManager.test.ts','packages/vscode-extension/src/__tests__/ownedBrokerCli.test.ts','packages/vscode-extension/src/__tests__/brokerSessionBoundary.test.ts','packages/vscode-extension/src/__tests__/mcp-canary-boundary.test.ts','packages/vscode-extension/src/__tests__/host/liteBrokerLifecycle.host.ts','packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json','packages/vscode-extension/README.md','packages/soterai-lite/README.md'];
const indexOnlyPaths=['docs/soterai-lite/LITE-CATALOG.json','packages/vscode-extension/src/__tests__/broker-autostart.test.ts','packages/vscode-extension/src/__tests__/extension.test.ts'];
let lib=fs.readFileSync(path.join(old,'f13-evidence-lib.cjs'),'utf8');lib=lib.slice(0,lib.indexOf('const sourcePaths = ['))+'const sourcePaths = '+JSON.stringify(sourcePaths,null,2)+';\nconst indexOnlyPaths = '+JSON.stringify(indexOnlyPaths,null,2)+';\n'+lib.slice(lib.indexOf('module.exports = '));fs.writeFileSync(path.join(__dirname,'f14-evidence-lib.cjs'),lib,{flag:'wx'});
for(const name of ['check-staged-01.cjs','verify-commit-01.cjs','commit-f13-01.ps1','f13-transition-lib-01.cjs','prepare-transition-01.cjs','verify-transition-01.cjs','commit-transition-01.ps1']){
 let text=fs.readFileSync(path.join(old,name),'utf8').replaceAll('F14','F15').replaceAll('F13','F14').replaceAll('f13','f14');
 if(name==='commit-f13-01.ps1')text=text.replace('add finite checked Git Bash terminal','own broker sessions and atomic loopback lifecycle');
 if(name==='f13-transition-lib-01.cjs')text=text.replace('assert.equal(acceptance.checks.nativeCmd.pass, 19); assert.equal(acceptance.checks.nativeCmd.distinct, 19); assert.equal(acceptance.checks.nativePs51.pass, 19); assert.equal(acceptance.checks.nativePs51.distinct, 19); ','');
 if(name==='prepare-transition-01.cjs'){
  text=text.replace("replace('F15-F32 and L2-L7','F15-F32 and L2-L7');","replace('F15-F32 and L2-L7','F16-F32 and L2-L7');");
  text=text.replaceAll('F01-F10 and F12-F13 DONE;', 'F01-F10 and F12-F14 DONE;');
  // Current side of the exact ledger header must still name completed F12-F13.
  text=text.replace("replace('F01-F10 and F12-F14 DONE;", "replace('F01-F10 and F12-F13 DONE;");
  text=text.replace('before the separate F13 transition commit and f14-transition-byte-verification-01.json','before the separate F13 transition commit and f13-transition-byte-verification-01.json');
  text=text.replaceAll('F01-F10 and F12-F13 DONE for exact scoped objects','F01-F10 and F12-F14 DONE for exact scoped objects');
  text=text.replace('GitBash19+affectedCmd19+PS5119','OwnedBroker19').replace('Finite declared Git Bash with private safe-data file/search/sed/awk/cp/env and shared staged Git backend; affected cmd BOM decoding preserves registered prefixes','Private IPC-owned per-window atomic port0 sessions, distinct ephemeral controller/data credentials, validated startup policy/canaries and cooperative shutdown');
 }
 if(name==='verify-transition-01.cjs')text=text.replaceAll('F01-F10 and F12-F13 DONE;', 'F01-F10 and F12-F14 DONE;');
 fs.writeFileSync(path.join(__dirname,name.replaceAll('f13','f14')),text,{flag:'wx'});
}
console.log(JSON.stringify({status:'AUTHORED_NOT_EXECUTED',sourcePaths:sourcePaths.length,indexOnlyPaths:indexOnlyPaths.length}));
