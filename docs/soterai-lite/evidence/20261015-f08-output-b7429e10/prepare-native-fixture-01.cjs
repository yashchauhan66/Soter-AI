const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),previous=path.resolve(__dirname,'../20261015-f07-matching-64a72df1');
let driver=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/liteSecretMatching.host.ts'),'utf8')
 .replaceAll('F07','F08').replaceAll('f07','f08').replaceAll('lite.secretMatching','lite.outputRedactor').replaceAll('MatchingReport','OutputReport')
 .replaceAll('.matching','.output').replace('matching: { status:','output: { status:').replace('matching: { status:','output: { status:')
 .replace('["pass", "matching"]','["pass", "matching", "output"]').replaceAll('OutputReport["matching"]','OutputReport["output"]');
for(let i=1;i<=10;i++){const id=String(i).padStart(2,'0');driver=driver.replaceAll('"M'+id+'"','"S'+id+'"').replaceAll('    M'+id+':','    S'+id+':');}
const scopes={S01:'Public stdout and stderr remain usable after completed stream filtering.',S02:'A raw registered value split over chunks is redacted.',S03:'A registered encoded value split over chunks is redacted.',S04:'UTF-8 scalar bytes split across chunks remain recognized.',S05:'ANSI SGR insertion and split sequences are removed before matching.',S06:'OSC payloads never reach the released plain-text output.',S07:'Nonzero process exit retains sanitized public output and status.',S08:'Incomplete final UTF-8 withholds all output; incomplete controls have separate unit coverage.',S09:'Oversized combined output is withheld without a raw fallback.',S10:'Fresh sequential operations retain separate private states; interleaved instances have separate unit coverage.'};
for(const [id,scope]of Object.entries(scopes))driver=driver.replace(new RegExp('('+id+': )"[^"\\n]*"'),(_,prefix)=>prefix+JSON.stringify(scope));
assert.ok(driver.includes('record(value, ["pass", "matching", "output"])'));
driver=driver.replace('record(value.output, ["status", "cases"]);',`record(value.matching, ["status", "cases"]);
    assert.ok(["PASS", "FAIL", "WITHHELD"].includes(value.matching.status as string));
    assert.ok(Array.isArray(value.matching.cases) && value.matching.cases.length <= 10);
    for (const retained of value.matching.cases) { record(retained, ["id", "pass"]); assert.match(retained.id as string, /^M(?:0[1-9]|10)$/); assert.equal(typeof retained.pass, "boolean"); }
    if (value.pass === true) { assert.equal(value.matching.status, "PASS"); assert.equal(value.matching.cases.length, 10); assert.ok(value.matching.cases.every(item => item.pass === true)); }
    record(value.output, ["status", "cases"]);`);
fs.writeFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/liteStreamingOutput.host.ts'),driver,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'run-native-01.ps1'),fs.readFileSync(path.join(previous,'run-native-01.ps1'),'utf8').replaceAll('F07','F08').replaceAll('f07','f08').replaceAll('lite.secretMatching','lite.outputRedactor'),{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'build-host-01.cjs'),fs.readFileSync(path.join(previous,'build-host-01.cjs'),'utf8').replaceAll('liteSecretMatching.host.ts','liteStreamingOutput.host.ts').replaceAll('lite-secret-matching-host.js','lite-streaming-output-host.js'),{flag:'wx'});
console.log('Prepared F08 test-only native fixture and unique isolated launcher; no hosts executed.');
