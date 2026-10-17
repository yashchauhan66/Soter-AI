const fs=require('node:fs'),path=require('node:path');const old=path.resolve(__dirname,'../20261017-f12-cmd-74b6d291'),read=n=>fs.readFileSync(path.join(old,n),'utf8'),write=(n,s)=>fs.writeFileSync(path.join(__dirname,n),s,{flag:'wx'});
const oldHelper=require(path.join(old,'f12-evidence-lib.cjs')),p=JSON.parse(fs.readFileSync(path.join(__dirname,'implementation-progress-01.json'),'utf8'));
const sources=[...new Set([...p.sources.map(r=>r.path),'docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md'])].sort(),indexOnly=[...new Set([...oldHelper.indexOnlyPaths,...oldHelper.sourcePaths.filter(n=>n.includes('/src/__tests__/')),'docs/soterai-lite/LITE-CATALOG.json'])].filter(n=>!sources.includes(n)).sort();
let helper=read('f12-evidence-lib.cjs'),start=helper.indexOf('const sourcePaths = ['),end=helper.indexOf('module.exports',start);helper=helper.slice(0,start)+'const sourcePaths = '+JSON.stringify(sources,null,2)+';\nconst indexOnlyPaths = '+JSON.stringify(indexOnly,null,2)+';\n'+helper.slice(end);write('f13-evidence-lib.cjs',helper);
const convert=s=>s.replaceAll('F13','F14').replaceAll('F12','F13').replaceAll('f12','f13').replaceAll('d46b845d047dc14d64bcdcbb6d8b3e9330a74334','3d176ee3525915c4f0ba9cee10da4f7aefcca5aa');
let acceptance=convert(read('prepare-acceptance-01.cjs')).replaceAll('inspection.machineSettings, 50','inspection.machineSettings, 51').replaceAll('cmdTerminal','gitBashTerminal').replaceAll('soterai.cmd.checked','soterai.gitbash.checked').replaceAll('CheckedCmd','CheckedGitBash').replaceAll('checkedCmd','checkedGitBash')
 .replace('"native", "nativePs51", "affected"','"native", "nativeCmd", "nativePs51", "affected"')
 .replace('plan.focusedPartition.f13 + plan.focusedPartition.retainedPs51','plan.focusedPartition.f13 + plan.focusedPartition.retainedCmd + plan.focusedPartition.retainedPs51')
 .replace('assert.equal(plan.focusedPartition.retainedPs51, 342);','assert.equal(plan.focusedPartition.retainedPs51, 342); assert.equal(plan.focusedPartition.retainedCmd, 168);')
 .replaceAll('20261017-f11-ps7-availability-6f721c9d','20261017-f12-cmd-74b6d291');
start=acceptance.indexOf('const probeFile =');end=acceptance.indexOf('const ps51Facts =',start);if(start<0||end<0)throw Error('Native validator markers missing');
const cmdBlock=acceptance.slice(start,end).replaceAll('plan.native','plan.cmdNative').replaceAll('"F13-H"','"F12-H"');const at=acceptance.indexOf('const affectedFile =');acceptance=acceptance.slice(0,at)+'const cmdFacts = [], cmdCopies = [];\n{\n'+cmdBlock+'cmdFacts.push(...nativeFacts); cmdCopies.push(...externalCopies);\n}\n'+acceptance.slice(at);
acceptance=acceptance.replace('entries: [...externalCopies, ...ps51Copies]','entries: [...externalCopies, ...cmdCopies, ...ps51Copies]')
 .replace('nativePs51: { distinct: 19','nativeCmd: { distinct: 19, pass: 19, phases: cmdFacts, summary: fileFact(bound(plan.cmdNative.summary)) }, nativePs51: { distinct: 19')
 .replaceAll('scoped checked cmd acceptance','scoped checked Git Bash acceptance').replaceAll(' F13,342 retained PS5.1 and76 retained extension parity',' F13,168 retained cmd,342 retained PS5.1 and76 retained extension parity')
 .replaceAll('Cmd native19PASS plus affected PS5.1 native19PASS','Git Bash native19PASS plus affected cmd19/PS5119PASS')
 .replace('Finite declared cmd checked commands only. type/find/set/copy are managed safe-view routes; cmd public output uses bounded UTF16LE decoding. PS5.1 staged Git metadata is retained separately.','Finite declared Git Bash checked commands only. File/search/bounded sed+awk/copy/env forms use managed safe data; public scripts and UTF8 stdin are fixed and reviewed-version gated. Staged Git metadata uses the shared checked backend. Affected cmd preserves leading BOM before filtering.')
 .replaceAll('Declared finite cmd and affected PS5.1/staged-only Git metadata','Declared finite Git Bash and affected cmd/PS5.1/staged-only Git metadata');
write('prepare-acceptance-01.cjs',acceptance);
for(const n of ['check-staged-01.cjs','verify-commit-01.cjs'])write(n,convert(read(n)));
write('commit-f13-01.ps1',convert(read('commit-f12-01.ps1')).replaceAll('finite checked cmd terminal','finite checked Git Bash terminal'));
console.log(JSON.stringify({status:'DEFERRED_NOT_EXECUTED',sourcePaths:sources.length,indexOnlyPaths:indexOnly.length}));
