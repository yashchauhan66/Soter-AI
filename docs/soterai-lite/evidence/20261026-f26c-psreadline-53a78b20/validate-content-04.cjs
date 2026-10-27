// Successor to inspection03's incorrect per-property `restricted` assertion.
// VS Code stores that restriction in capabilities.untrustedWorkspaces.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
async function main(){
 const packageReceipt=read(own('package-03.txt.result.json')),packageRaw=fs.readFileSync(own('package-03.txt'));assert.equal(packageReceipt.exitCode,0);assert.equal(sha(packageRaw),packageReceipt.sha256.toLowerCase());
 const packed=packageRaw.toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).find(row=>row.status==='PACKAGED_NOT_HOST_VERIFIED');assert(packed);
 const artifact=path.join(repo,packed.output),provenance=path.join(repo,'packages/soterai-lite/builds',packed.runId,'build-provenance.json');
 const {auditRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));const audit=await auditRelease({repoRoot:repo,vsixPath:artifact,expectedSha256:packed.sha256,buildReceiptPath:provenance});
 assert.deepEqual(read(own('offline-inventory-03/release-inventory.json')),audit.report);assert.deepEqual(read(own('offline-inventory-03/sbom.cdx.json')),audit.sbom);assert.equal(audit.report.entries.length,15);assert.equal(audit.report.runtimes.length,4);
 for(const pin of audit.report.entries){const raw=fs.readFileSync(own('vsix-extracted-03/'+pin.path));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}
 const manifest=read(own('vsix-extracted-03/extension/package.json')),props=manifest.contributes.configuration.properties,flagName='soterai.lite.historyHooks.psReadLine',flag=props[flagName];
 assert.equal(flag.default,false);assert.equal(flag.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flagName));assert.equal(Object.values(props).filter(row=>row.scope==='machine').length,83);
 for(const id of ['installPSReadLineHistoryGuard','restorePSReadLineHistoryGuard','psReadLineHistoryGuardStatus'])assert.equal(manifest.contributes.commands.filter(row=>row.command==='soterai.'+id).length,1);
 const frontend=fs.readFileSync(own('vsix-extracted-03/extension/dist/extension.js'));assert.equal(sha(frontend),packed.extensionSha256);
 for(const needle of ['psreadline-history-state-v1.json','History journal unavailable.','AddToHistoryHandler','INSTALLED_CONSOLE_LOAD_UNVERIFIED'])assert(frontend.includes(Buffer.from(needle)),needle);
 const proof=read(own('full-inputs-03.json'));for(const pin of proof.files){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes,pin.path);assert.equal(sha(raw),pin.sha256,pin.path);}
 const result={status:'CONTENT_SOURCE_ONLY_NOT_NATIVE_ACCEPTANCE',observedAt:new Date().toISOString(),vsixSha256:packed.sha256,vsixBytes:packed.bytes,frontend:packed.extensionSha256,runId:packed.runId,buildReceipt:path.relative(repo,provenance).replace(/\\/g,'/'),machineSettings:83,scope:'machine',flagDefault:false,restrictedConfigurations:true,entryCount:15,runtimeCount:4,entries:audit.report.entries,privateJournal:'FIXED_OWN_METADATA_ONLY_NOT_HISTORY_OR_PROFILE_DISCOVERY',releaseReady:false,priorInspection03:'FAIL_RETAINED_WRONG_PER_PROPERTY_RESTRICTED_ASSERTION',productionDeltaAfterFullFreeze:0};
 fs.writeFileSync(own('content-inspection-04.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_OFFLINE_INVENTORY_AND_CONTENT_ONLY',artifactSha256:packed.sha256,frontendSha256:packed.extensionSha256,entries:15,runtimes:4,machineSettings:83,releaseReady:false,productionChanges:0}));
}
main().catch(error=>{console.error('F26c content04 refused: '+(error instanceof Error?error.name:'UnknownFailure'));process.exitCode=1});
