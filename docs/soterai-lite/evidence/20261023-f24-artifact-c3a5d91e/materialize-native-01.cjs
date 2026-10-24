'use strict';
// PREPARED ONLY until current serial/package/full receipts actually exist.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./input-lib-01.cjs');
const repo=e.repo,base=path.relative(repo,__dirname).replaceAll('\\','/');e.check();
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^\uFEFF/,''));
function receipt(name){const value=read(name+'.result.json'),bytes=fs.readFileSync(path.join(__dirname,name));assert.equal(value.exitCode,0,name);assert.equal(value.sha256.toLowerCase(),e.sha(bytes),name);return value;}
for(const name of ['serial-gates-01.txt','typecheck-02.txt','readiness-tests-01.txt','full-tests-01.txt','backend-typecheck-01.txt','backend-tests-01.txt','build-native-hosts-run-01.txt','package-01.txt'])receipt(name);
const full=fs.readFileSync(path.join(__dirname,'full-tests-01.txt'),'utf8');for(const [key,expected] of Object.entries({tests:3570,pass:3566,fail:0,cancelled:0,skipped:4})){const found=[...full.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(found.length,1);assert.equal(+found[0][1],expected,'Exact current full '+key);}
const packageText=fs.readFileSync(path.join(__dirname,'package-01.txt'),'utf8'),lines=packageText.split(/\r?\n/).filter(line=>line.startsWith('{"status":"PACKAGED_NOT_HOST_VERIFIED",'));
assert.equal(lines.length,1);const pkg=JSON.parse(lines[0]),artifact=path.join(repo,pkg.output),bytes=fs.readFileSync(artifact);assert.equal(e.sha(bytes),pkg.sha256);assert.equal(bytes.length,pkg.bytes);
assert.equal(path.basename(artifact),'soterai-lite-0.7.0-f24-20261023-attempt01.vsix');assert(/^[a-f0-9]{64}$/.test(pkg.extensionSha256));
const frozen=read('native-template-inputs-01.json');assert.equal(frozen.status,'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND');assert.equal(frozen.templates.length,22);
const review=read('host-version-review-01.json');for(const row of [review.currentHost.executable,...review.currentHost.applicationFiles]){const actual=fs.readFileSync(row.path);assert.equal(actual.length,row.bytes);assert.equal(e.sha(actual),row.sha256);}
const replacements={__F24_TEMPLATE_BOUND__:'F24_CURRENT_FACTS_BOUND',__F24_EDITOR_EXECUTABLE__:review.currentHost.executable.path,__F24_EDITOR_VERSION__:review.currentHost.version,
 __F24_EXTRACTED_EXTENSION_RELATIVE__:'vsix-extracted-01/extension',__F24_FULL_GATE_RAW_RELATIVE__:base+'/full-tests-01.txt',__F24_FULL_GATE_RESULT_JSON__:'full-tests-01.txt.result.json',
 __F24_FULL_GATE_RESULT_SHA256__:e.sha(fs.readFileSync(path.join(__dirname,'full-tests-01.txt.result.json'))),__F24_HOST_VERSION_REVIEW_JSON__:'host-version-review-01.json',
 __F24_NATIVE_DRIVER_PROVENANCE_JSON__:'native-driver-provenance-01.json',__F24_NATIVE_HOST_OUTPUT_DIR__:'prebuilt-native-hosts-01',__F24_SOURCE_INPUTS_JSON__:'source-inputs-01.json'};
const rows=[];
for(const name of fs.readdirSync(__dirname).filter(name=>/\.template\.ps1$/.test(name))){
 const source=fs.readFileSync(path.join(__dirname,name)),expected=frozen.templates.find(row=>row.path===name||row.name===name||row.template===name);assert(expected,'Template manifest membership required');
 assert.equal(e.sha(source),expected.sha256);let text=source.toString('utf8');for(const [token,value] of Object.entries(replacements))text=text.replaceAll(token,value);assert(!text.includes('__F24_'));
 rows.push({name:name.replace('.template.ps1','.ps1'),bytes:Buffer.from(text),source:name,sourceSha256:e.sha(source)});
}
assert.equal(rows.length,21);for(const row of rows)assert(!fs.existsSync(path.join(__dirname,row.name)),'Existing executed/helper copy refused');
for(const row of rows)fs.writeFileSync(path.join(__dirname,row.name),row.bytes,{flag:'wx'});
const report={status:'MATERIALIZED_CURRENT_BOUND_FIXTURES_NOT_NATIVE_EXECUTED',sourceInputs:e.fact(base+'/source-inputs-01.json'),fullReceipt:e.fact(base+'/full-tests-01.txt.result.json'),artifact:{path:pkg.output,bytes:bytes.length,sha256:pkg.sha256,frontendSha256:pkg.extensionSha256},
 files:rows.map(row=>({path:base+'/'+row.name,bytes:row.bytes.length,sha256:e.sha(row.bytes),source:row.source,sourceSha256:row.sourceSha256})),scope:'Current passing full/backend/compiler/build/newpackage gates checked before immutable materialization. Templates remain original. Actual ZIP inspection/native execution/withdrawal/acceptance and source+transition bytes still pending.',time:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'native-materialization-01.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,files:rows.length,artifact:pkg.sha256}));
