'use strict';
// Evidence-only authoring/static observation. No listeners/clients/Code/CIM or
// native run. Exact original driver/guard remain unchanged copies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const route=require('./codexcli-route-current-01.cjs');
const repo=path.resolve(__dirname,'../../../../..'),historical=path.join(repo,'docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70'),own=n=>path.join(__dirname,n);
(async()=>{
 const current=await route.verifyCurrent(),codexdir=own('codexcli');assert(!fs.existsSync(codexdir));fs.mkdirSync(codexdir);
 for(const n of ['responses-matrix-01.cjs','matrix-guards-01.cjs','installed-cli-public-inputs-01.json'])fs.copyFileSync(path.join(historical,n),path.join(codexdir,n),fs.constants.COPYFILE_EXCL);
 const extraction=own('exact-current-extension-01');assert(!fs.existsSync(extraction));fs.mkdirSync(extraction);
 for(const[relative,bytes]of current.payload.entries){const file=path.join(extraction,relative);assert(file.startsWith(extraction+path.sep));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
 const inspection=JSON.parse(fs.readFileSync(current.q.inspection.path,'utf8'));Object.assign(inspection,{status:'PASS_CONTENT_INSPECTION_NOT_HOST_VERIFIED',vsix:current.q.vsix.path,sha256:current.q.vsix.sha256,extractedExtensionRoot:extraction});
 fs.writeFileSync(own('current-inspection-01.json'),JSON.stringify(inspection,null,2)+'\n',{flag:'wx'});
 const pending=[current.oldVendor.vendor],files=[];let bytes=0;
 while(pending.length){const dir=pending.pop();for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  assert(!entry.isSymbolicLink());const full=path.join(dir,entry.name);if(entry.isDirectory())pending.push(full);else{
   assert(entry.isFile());assert(/\.(?:json|js|md|txt|exe|dll)$/i.test(entry.name));const fact=route.fact(full);files.push({...fact,relative:path.relative(current.oldVendor.vendor,full).split(path.sep).join('/')});bytes+=fact.bytes;assert(files.length<=128&&bytes<=1073741824);
  }
 }}files.sort((a,b)=>a.relative.localeCompare(b.relative));
 for(const row of current.oldVendor.files){const actual=files.find(f=>f.relative===row.relative);assert(actual&&actual.sha256===row.sha256&&actual.bytes===row.bytes);}
 fs.writeFileSync(own('codexcli-public-graph-01.json'),JSON.stringify({status:'READ_ONLY_CURRENT_COMPLETE_PUBLIC_CODEXCLI_GRAPH_NO_NATIVE',originalVendorPinSha256:current.originalVendorPin.sha256,vendor:current.oldVendor.vendor,fileCount:files.length,bytes,files,networkRequests:0,clientLaunches:0},null,2)+'\n',{flag:'wx'});
 let ps=fs.readFileSync(path.join(historical,'run-affected-cli-04.ps1'),'utf8');
 function replace(before,after,count=1){assert.equal(ps.split(before).length-1,count,before);ps=ps.split(before).join(after)}
 replace("$ErrorActionPreference='Stop'","param([Parameter(Mandatory=$true)][string]$AdmissionPath,[Parameter(Mandatory=$true)][string]$AdmissionSha256)\r\n$ErrorActionPreference='Stop'\r\n$taskCurrentOwner=Join-Path $PSScriptRoot 'codexcli-route-current-01.cjs'\r\n& 'C:\\Program Files\\nodejs\\node.exe' $taskCurrentOwner --validate-prepared $AdmissionPath $AdmissionSha256\r\nif($LASTEXITCODE -ne 0){throw 'Current final route admission refused'}\r\n$taskRouteAdmission=Get-Content -LiteralPath $AdmissionPath -Raw|ConvertFrom-Json");
 replace("Join-Path $PSScriptRoot '../../../..'","Join-Path $PSScriptRoot '../../../../..'");
 replace("Join-Path $PSScriptRoot 'vsix-inspection-03.json'","Join-Path $PSScriptRoot 'current-inspection-01.json'");
 replace("Join-Path $PSScriptRoot 'installed-cli-public-inputs-01.json'","Join-Path $PSScriptRoot 'codexcli/installed-cli-public-inputs-01.json'");
 replace("$taskName='f20a-product-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)","$taskName=[IO.Path]::GetFileName($taskRouteAdmission.runRoot)");
 replace("$taskEvidence=Join-Path $PSScriptRoot $taskName","$taskEvidence=$taskRouteAdmission.receipts");
 replace("@('extension.js','local-ai-broker.js','soterai-mcp-server.js')","@('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')");
 replace("Join-Path $PSScriptRoot $taskDriver","Join-Path (Join-Path $PSScriptRoot 'codexcli') $taskDriver");
 for(const name of ['responses-matrix-01.cjs','matrix-guards-01.cjs'])replace("Join-Path $PSScriptRoot '"+name+"'","Join-Path $PSScriptRoot 'codexcli/"+name+"'");
 const cut=ps.indexOf('$taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo');assert(cut>0);
 ps=ps.slice(0,cut)+String.raw`$taskEnv=@{}
foreach($taskEnvKey in $taskInfo.EnvironmentVariables.Keys){$taskEnv[$taskEnvKey]=[string]$taskInfo.EnvironmentVariables[$taskEnvKey]}
$taskLaunch=Join-Path $taskEvidence 'codexcli-code-launch-01.json'
Write-F20ANew $taskLaunch (@{admissionPath=$AdmissionPath;admissionSha256=$AdmissionSha256;executable=$taskCode;args=$taskArgs;cwd=$taskWorkspace;env=$taskEnv;run=$taskEvidence;profile=$taskProfile;deadlineMs=300000}|ConvertTo-Json -Depth 15)
& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'run-owned-code-current-01.cjs') $taskLaunch
if($LASTEXITCODE -ne 0){throw 'INCOMPLETE exact owned Code close/EOF; no next route or signals'}
Assert-F20AProductBytes
if((Get-F20AHash $taskCode) -cne $taskCodeSha){throw 'Editor bytes changed'}
if(-not(Test-Path -LiteralPath $taskResult)){throw 'INCOMPLETE actual native vendor result missing'}
$taskObserved=Get-Content -LiteralPath $taskResult -Raw|ConvertFrom-Json
if($taskObserved.status -cne 'PASS_SCOPED_PRODUCT_CLI_MATRIX'){throw 'INCOMPLETE original20 matrix'}
`;
 fs.writeFileSync(own('run-codexcli-current-01.ps1'),ps,{flag:'wx'});
 fs.writeFileSync(own('codexcli-preparation-01.json'),JSON.stringify({status:'PREPARED_INERT_CODEXCLI_PACKET_NOT_NATIVE_ACCEPTANCE',source:current.source,qualification:current.qualification,vsix:current.q.vsix,entries:18,runtimes:4,originalChecks:20,driver:route.fact(path.join(codexdir,'responses-matrix-01.cjs')),guard:route.fact(path.join(codexdir,'matrix-guards-01.cjs')),completePublicGraphFiles:files.length,networkRequests:0,nativeLaunches:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS_INERT_CURRENT_CODEXCLI_PREPARATION',entries:18,runtimes:4,originalAssertions:20,publicGraphFiles:files.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
