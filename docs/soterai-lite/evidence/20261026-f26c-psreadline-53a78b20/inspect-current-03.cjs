const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),yauzl=require('yauzl');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
async function main(){
 const receipt=read(own('package-03.txt.result.json'));assert.equal(receipt.exitCode,0);const output=fs.readFileSync(own('package-03.txt'));assert.equal(sha(output),receipt.sha256.toLowerCase());
 const packed=output.toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line)).find(row=>row.status==='PACKAGED_NOT_HOST_VERIFIED');assert(packed);assert.equal(packed.output.replace(/\\/g,'/'),'packages/soterai-lite/soterai-lite-0.7.0-f26c-20261027-attempt03.vsix');
 const vsix=path.join(repo,packed.output),provenance=path.join(repo,'packages/soterai-lite/builds',packed.runId,'build-provenance.json');
 const {auditRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));const audit=await auditRelease({repoRoot:repo,vsixPath:vsix,expectedSha256:packed.sha256,buildReceiptPath:provenance});assert.equal(audit.report.entries.length,15);assert.equal(audit.report.runtimes.length,4);
 const out=own('offline-inventory-03');assert(!fs.existsSync(out));fs.mkdirSync(out);for(const[name,value]of [['release-inventory.json',audit.report],['sbom.cdx.json',audit.sbom]])fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const extracted=own('vsix-extracted-03');assert(!fs.existsSync(extracted));fs.mkdirSync(extracted);
 const zip=await yauzl.fromBufferPromise(fs.readFileSync(vsix),{lazyEntries:true,validateEntrySizes:true,strictFileNames:true});let count=0;
 try { for await(const entry of zip.eachEntry()){
  const pin=audit.report.entries.find(row=>row.path===entry.fileName);assert(pin);assert(!path.isAbsolute(pin.path)&&pin.path.split('/').every(part=>part&&part!=='.'&&part!=='..'));
  const stream=await zip.openReadStreamPromise(entry),chunks=[];let bytes=0;for await(const raw of stream){bytes+=raw.length;assert(bytes<=pin.bytes);chunks.push(raw);}const raw=Buffer.concat(chunks);assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);
  const target=path.join(extracted,pin.path);assert(target.startsWith(extracted+path.sep));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw,{flag:'wx'});count++;
 }}finally{zip.close();}assert.equal(count,15);
 const manifest=read(path.join(extracted,'extension/package.json')),properties=manifest.contributes.configuration.properties,flag=properties['soterai.lite.historyHooks.psReadLine'];
 assert.equal(flag.default,false);assert.equal(flag.scope,'machine');assert.equal(flag.restricted,true);assert.equal(Object.values(properties).filter(row=>row.scope==='machine').length,83);
 for(const id of ['installPSReadLineHistoryGuard','restorePSReadLineHistoryGuard','psReadLineHistoryGuardStatus'])assert.equal(manifest.contributes.commands.filter(row=>row.command==='soterai.'+id).length,1);
 const frontend=fs.readFileSync(path.join(extracted,'extension/dist/extension.js'));assert.equal(sha(frontend),packed.extensionSha256);
 for(const needle of ['psreadline-history-state-v1.json','History journal unavailable.','AddToHistoryHandler','INSTALLED_CONSOLE_LOAD_UNVERIFIED'])assert(frontend.includes(Buffer.from(needle)),needle);
 const result={status:'CONTENT_SOURCE_ONLY_NOT_NATIVE_ACCEPTANCE',observedAt:new Date().toISOString(),vsixSha256:packed.sha256,vsixBytes:packed.bytes,frontend:packed.extensionSha256,runId:packed.runId,buildReceipt:path.relative(repo,provenance).replace(/\\/g,'/'),machineSettings:83,scope:'machine',flagDefault:false,entryCount:15,runtimeCount:4,entries:audit.report.entries,privateJournal:'FIXED_OWN_METADATA_ONLY_NOT_HISTORY_OR_PROFILE_DISCOVERY',releaseReady:false};
 fs.writeFileSync(own('content-inspection-03.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS_OFFLINE_INVENTORY_AND_CONTENT_ONLY',artifactSha256:packed.sha256,frontendSha256:packed.extensionSha256,entries:15,runtimes:4,machineSettings:83,releaseReady:false}));
}
main().catch(error=>{console.error('F26c offline/content verification refused: '+(error instanceof Error?error.name:'UnknownFailure'));process.exitCode=1});
