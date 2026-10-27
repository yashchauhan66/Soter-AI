const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),text=require(path.join(repo,'packages/vscode-extension/src/history-hooks/PowerShellHistoryText.ts'));
const core=require(path.join(repo,'packages/guard-core/src/detectors/SecretDetector.ts')),generation='a1234567-1234-4567-8123-123456789abc';
const output=text.buildHistoryProfile(undefined,{enabled:true,generation});assert(Buffer.isBuffer(output));assert(output.length<65536);
fs.writeFileSync(path.join(__dirname,'generated-history-01.ps1'),output,{flag:'wx'});
const fact=name=>{const raw=fs.readFileSync(path.join(repo,name));return{path:name,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')}};
const result={status:'GENERATED_ONLY_NOT_EXECUTED',generation,patternCount:core.SECRET_PATTERN_SNAPSHOT.length,canonicalClasses:[...new Set(core.SECRET_PATTERN_SNAPSHOT.map(row=>row.type))],sources:['packages/guard-core/src/detectors/SecretDetector.ts','packages/vscode-extension/src/history-hooks/PowerShellHistoryText.ts','packages/vscode-extension/src/__tests__/powerShellHistoryText.test.ts'].map(fact),output:fact(path.relative(repo,path.join(__dirname,'generated-history-01.ps1')).replace(/\\/g,'/'))};
fs.writeFileSync(path.join(__dirname,'generated-text-inputs-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
