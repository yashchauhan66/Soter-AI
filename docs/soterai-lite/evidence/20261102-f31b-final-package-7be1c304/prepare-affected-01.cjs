'use strict';
// Prepare existing assertions only. No native host or F26a run.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),esbuild=require('esbuild'),C=require('./current-native-admission-01.cjs'),{own,repo,read,sha,fact,pin}=C;
const prior=path.resolve(__dirname,'../20261101-f28-reliability-9a4c2e71'),put=(n,v)=>fs.writeFileSync(own(n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const git='C:\\Program Files\\Git\\cmd\\git.exe';assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');
function source(name){const file=path.join(prior,name),relative=path.relative(repo,file).replaceAll('\\','/'),raw=fs.readFileSync(file),committed=cp.execFileSync(git,['cat-file','blob','HEAD:'+relative],{cwd:repo,shell:false,windowsHide:true,maxBuffer:16*1024*1024});assert(raw.equals(committed),name+' must equal retained Git bytes');return raw;}
(async()=>{
 const proof=C.sources(),old=read(path.join(prior,'native-driver-provenance-05.json')),scopeOld=JSON.parse(source('affected-scope-01.json')),ids=['ps51','editor','mcp','retained'],families=ids.map(id=>{const f=scopeOld.families.find(x=>x.id===id);assert(f);return f;});
 const entryPoints=Object.fromEntries(families.map(f=>{const name=path.basename(f.driver,'.js');assert(old.entryPoints[name]);return[name,old.entryPoints[name]];}));assert(!Object.keys(entryPoints).some(n=>/precommit|pre-commit/i.test(n)));
 const out=own('prebuilt-affected-01');assert(!fs.existsSync(out));const {parserBundleOptions}=require(path.join(repo,'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const built=await esbuild.build({...parserBundleOptions(repo),absWorkingDir:repo,entryPoints,outdir:out,metafile:true,bundle:true,platform:'node',format:'cjs',external:['vscode'],target:'node18',tsconfig:path.join(repo,'packages/vscode-extension/tsconfig.json'),loader:{'.txt':'ts'},sourcemap:false,logLevel:'warning'});
 const drivers=fs.readdirSync(out).filter(n=>n.endsWith('.js')).sort().map(n=>fact(path.join(out,n)));assert.equal(drivers.length,4);assert(!Object.keys(built.metafile.inputs).some(p=>/phase2\/|vscode-stub/.test(p.replaceAll('\\','/'))));
 const current=new Map(proof.files.map(r=>[r.path,r])),before=new Map(old.sourceInputs.map(r=>[r.path,r]));
 const sourceInputs=Object.keys(built.metafile.inputs).sort().map(p=>{const row=fact(path.resolve(repo,p)),expected=current.get(row.path)??before.get(row.path);assert(expected,row.path);assert.deepEqual(row,expected);return row;});for(const r of old.auxiliaryInputs??[])pin(r);
 put('affected-driver-provenance-01.json',{status:'CURRENT_F31B_AFFECTED_DRIVERS4_PREPARED_ASSERTIONS_NOT_RESULTS',observedAt:new Date().toISOString(),sourceProof:fact(own('full-inputs-02.json')),entryPoints,drivers,sourceInputs,auxiliaryInputs:old.auxiliaryInputs??[],comparison:drivers.map(r=>{const p=old.drivers.find(x=>path.basename(x.path)===path.basename(r.path));assert(p);return{name:path.basename(r.path),previousSha256:p.sha256,currentSha256:r.sha256,unchanged:p.sha256===r.sha256};}),f26a:'USER_SKIPPED_NO_MORE_HOST_NATIVE_RUNS'});
 const helpers=[...families.map(f=>f.helper),'affected-functional10-01.ps1','affected-security17-01.ps1'];const copied=[];
 for(const name of [...helpers,'affected-preparation-pipe-ownership-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js']){const raw=source(name);fs.writeFileSync(own(name),raw,{flag:'wx'});copied.push({source:fact(path.join(prior,name)),target:fact(own(name)),byteExact:true});}
 let shared=source('affected-native-binding-01.ps1').toString('utf8'),start=shared.indexOf('function Get-F26cCurrentBinding'),end=shared.indexOf('function Assert-F26AAffectedInputs',start);assert(start>=0&&end>start);
 let gate=String.raw`function Get-F26cCurrentBinding {
    $taskF31bGuard=Join-Path $PSScriptRoot 'current-native-admission-01.cjs'
    if((Get-FileHash -LiteralPath $taskF31bGuard -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__GUARD_SHA__'){throw 'F31b exact read-only admission changed.'}
    $taskF31bAnswer=& 'C:\Program Files\nodejs\node.exe' $taskF31bGuard --emit-binding
    if($LASTEXITCODE -ne 0){throw 'F31b current full/source/package/runtime/host gate failed.'}
    return ($taskF31bAnswer | ConvertFrom-Json)
}
`;
 gate=gate.replace('__GUARD_SHA__',fact(own('current-native-admission-01.cjs')).sha256);shared=shared.slice(0,start)+gate+shared.slice(end);shared=shared.replaceAll('content-inspection-02.json','content-inspection-01.json');put('affected-native-binding-01.ps1',shared);
 put('affected-scope-01.json',{...scopeOld,status:'F31B_AFFECTED_SCOPE_PREDECLARED_NOT_RUN',sourceProof:fact(own('full-inputs-02.json')),families,assertions:175,phases:8,functional:10,security:17,totalAssertions:202,totalPhases:10,originalFullScope:fact(path.join(prior,'affected-scope-01.json')),remaining:'Complete final V01/V02 integrated/tool/catalog corpus retained; this intermediate package checks affected reader/editor/terminal/proxy/MCP plus original functional/security baseline. No F26a34.',f26a:'USER_SKIPPED_INCOMPLETE_NO_MORE_HOST_NATIVE_RUNS'});
 const names=[...helpers,'affected-native-binding-01.ps1','affected-preparation-pipe-ownership-01.ps1'];
 put('affected-syntax-01.ps1',"$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @("+names.map(n=>"'"+n+"'").join(',')+")){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}\nWrite-Output 'PASS: eight affected PowerShell files parsed; no native run.'\n");
 C.sources();put('affected-preparation-01.json',{status:'PREPARED_F31B_AFFECTED202_10_NOT_BOUND_NOT_RUN',observedAt:new Date().toISOString(),sourceProof:fact(own('full-inputs-02.json')),driverProvenance:fact(own('affected-driver-provenance-01.json')),scope:fact(own('affected-scope-01.json')),copied,fixtureInputs:[...copied.map(r=>r.target),fact(own('affected-native-binding-01.ps1')),fact(own('current-native-admission-01.cjs'))],nativeRuns:0,f26aNativeRuns:0});console.log('PREPARED_F31B_AFFECTED202_10_NO_NATIVE_EXECUTION');
})().catch(error=>{console.error(error);process.exitCode=1;});
