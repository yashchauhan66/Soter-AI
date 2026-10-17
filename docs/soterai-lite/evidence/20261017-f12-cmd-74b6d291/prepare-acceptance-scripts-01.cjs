// Deferred evidence tooling only. No acceptance, staging or queue transition.
const fs=require('node:fs'),path=require('node:path');const old=path.resolve(__dirname,'../20261015-f10-ps51-3f12ab64'),repo=path.resolve(__dirname,'../../../..'),read=n=>fs.readFileSync(path.join(old,n),'utf8'),write=(n,t)=>fs.writeFileSync(path.join(__dirname,n),t,{flag:'wx'});
const oldHelper=require(path.join(old,'f10-evidence-lib.cjs')),progress=JSON.parse(fs.readFileSync(path.join(__dirname,'implementation-progress-01.json'),'utf8'));
const sources=[...new Set([...progress.sources.map(r=>r.path),'packages/vscode-extension/src/firewall/VaultManager.ts','packages/vscode-extension/src/__tests__/cmdOutputBinding.test.ts','docs/vscode-extension-readiness.md','docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md'])].sort();
const indexOnly=[...new Set([...oldHelper.sourcePaths.filter(n=>n.includes('/src/__tests__/')),...oldHelper.indexOnlyPaths])].filter(n=>!sources.includes(n)).sort();
let helper=read('f10-evidence-lib.cjs'),start=helper.indexOf('const sourcePaths = ['),end=helper.indexOf('module.exports',start);helper=helper.slice(0,start)+'const sourcePaths = '+JSON.stringify(sources,null,2)+';\nconst indexOnlyPaths = '+JSON.stringify(indexOnly,null,2)+';\n'+helper.slice(end);write('f12-evidence-lib.cjs',helper);
const convert=s=>s.replaceAll('f10-evidence-lib.cjs','f12-evidence-lib.cjs').replaceAll('24da9ce9907cd6082b7ce3a3e79136cd4c551508','d46b845d047dc14d64bcdcbb6d8b3e9330a74334').replaceAll('F10','F12').replaceAll('f10','f12').replaceAll('F11','F13');
let acceptance=convert(read('prepare-acceptance-01.cjs')).replaceAll('inspection.machineSettings, 49','inspection.machineSettings, 50').replaceAll('ps51Terminal','cmdTerminal').replaceAll('soterai.ps51.checked','soterai.cmd.checked').replaceAll('CheckedPowerShell','CheckedCmd').replaceAll('checkedPowerShell','checkedCmd')
 .replace('"hostBuild", "native", "affected"','"hostBuild", "native", "nativePs51", "affected"').replace('plan.focusedPartition.f12 >= 332','plan.focusedPartition.f12 >= 160').replace('plan.focusedPartition.f12 + plan.focusedPartition.extensionParity','plan.focusedPartition.f12 + plan.focusedPartition.retainedPs51 + plan.focusedPartition.extensionParity')
 .replace('assert.equal(plan.focusedPartition.extensionParity, 76);','assert.equal(plan.focusedPartition.extensionParity, 76); assert.equal(plan.focusedPartition.retainedPs51, 342);')
 .replace('20261015-f09-runtime-81e65c2a','20261017-f11-ps7-availability-6f721c9d');
start=acceptance.indexOf('const probeFile =');end=acceptance.indexOf('const affectedFile =',start);if(start<0||end<0)throw Error('Native validator markers changed');
const nativeBlock=acceptance.slice(start,end).replaceAll('plan.native','plan.ps51Native').replaceAll('"F12-H"','"F10-H"');
acceptance=acceptance.slice(0,end)+'const ps51Facts = [], ps51Copies = [];\n{\n'+nativeBlock+'ps51Facts.push(...nativeFacts); ps51Copies.push(...externalCopies);\n}\n'+acceptance.slice(end);
acceptance=acceptance.replace('entries: externalCopies','entries: [...externalCopies, ...ps51Copies]').replace('functional: { path: relative(functionalFile)','nativePs51: { distinct: 19, pass: 19, phases: ps51Facts, summary: fileFact(bound(plan.ps51Native.summary)) }, functional: { path: relative(functionalFile)')
 .replace('" F12 and76 retained extension parity"','" F12,342 retained PS5.1 and76 retained extension parity"')
 .replaceAll('Declared finite PS5.1 and staged-only Git metadata','Declared finite cmd and affected PS5.1/staged-only Git metadata')
 .replaceAll('Finite declared PowerShell 5.1 checked commands only. Git metadata is staged names/statistics only.','Finite declared cmd checked commands only. type/find/set/copy are managed safe-view routes; cmd public output uses bounded UTF16LE decoding. PS5.1 staged Git metadata is retained separately.')
 .replaceAll('Native19PASS (primary16/restart3), functional10PASS','Cmd native19PASS plus affected PS5.1 native19PASS, functional10PASS')
 .replace('assert.equal(queue.activeFeature, "F12");','assert.equal(queue.features.find(row => row.id === "F11").coverage, "NOT_TESTED/NOT_COVERED"); assert.equal(queue.activeFeature, "F12");');
write('prepare-acceptance-01.cjs',acceptance);
for(const name of ['check-staged-01.cjs','verify-commit-01.cjs'])write(name,convert(read(name)));
write('commit-f12-01.ps1',convert(read('commit-f10-01.ps1')).replaceAll('finite checked PowerShell 5.1 terminal','finite checked cmd terminal'));
console.log(JSON.stringify({status:'DEFERRED_ACCEPTANCE_TOOLING_CREATED',sourcePaths:sources.length,indexOnlyPaths:indexOnly.length}));
