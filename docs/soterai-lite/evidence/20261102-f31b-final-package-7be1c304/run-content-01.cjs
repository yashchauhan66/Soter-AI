// Exact current F28 artifact inspection only. No native launch, push or release claim.
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),yauzl=require('yauzl');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),emit=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function inputs(){const proof=read(own('full-inputs-02.json'));assert(proof.fileCount>1037);for(const pin of proof.files){const b=fs.readFileSync(path.join(repo,pin.path));assert.equal(b.length,pin.bytes,pin.path);assert.equal(sha(b),pin.sha256,pin.path);}return proof;}
function output(name){const c=read(own(name+'-owned-close.json'));for(const[k,v]of Object.entries({actualClose:true,exitCode:0,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(c[k],v,name+':'+k);for(const s of c.streams){const b=fs.readFileSync(own(name+'-'+s.name+'.bin'));assert.equal(b.length,s.bytes);assert.equal(b.length,s.observedBytes);assert.equal(sha(b),s.sha256);}return fs.readFileSync(own(name+'-stdout.bin'));}
function closed(name){output(name);}
function fullSuite(proof){const full=read(own('full-suite-acceptance-02.json'));assert.equal(full.status,'PASS_CURRENT_FULL_SUITE_ALL_FROZEN_TEST_FILES_SHARDED');assert.equal(full.sourceProof.sha256,sha(fs.readFileSync(own('full-inputs-02.json'))));const expected=proof.files.filter(r=>r.path.startsWith('packages/vscode-extension/src/__tests__/')&&r.path.endsWith('.test.ts')).map(r=>r.path).sort();assert.deepEqual(full.shards.flatMap(r=>r.files).sort(),expected);assert.equal(new Set(expected).size,expected.length);const counts={tests:0,pass:0,fail:0,cancelled:0,skipped:0};for(const shard of full.shards){assert.match(shard.name,/^unit-shard-d{2}-02$/);const raw=output(shard.name).toString();for(const key of Object.keys(counts)){const found=[...raw.matchAll(new RegExp('^# '+key+' (\d+)\r?$','gm'))];assert.equal(found.length,1);counts[key]+=Number(found[0][1]);}}for(const[k,v]of Object.entries(counts))assert.equal(full.counts[k],v);assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.skipped,4);assert.equal(counts.tests,counts.pass+counts.skipped);assert(counts.tests>=4783);return counts;}
async function main(){
 const proof=inputs();
 assert.equal(read(own('integrated-sharded-result-02.json')).status,'F31B_SHARDED_FULL_READINESS_PACKAGE_CLOSED_CONTENT_NATIVE_PENDING');
 for(const name of ['compiler-02','readiness-02','package-02'])closed(name);
 const counts=fullSuite(proof);
 const packageRows=output('package-02').toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
 const packed=packageRows.find(row=>row.status==='PACKAGED_NOT_HOST_VERIFIED');assert(packed);assert.equal(packed.output.replaceAll('\\','/'),'packages/soterai-lite/soterai-lite-0.7.0-f31b-20261102-attempt01.vsix');
 const artifact=path.join(repo,packed.output),artifactRaw=fs.readFileSync(artifact);assert.equal(artifactRaw.length,packed.bytes);assert.equal(sha(artifactRaw),packed.sha256);
 const provenance=path.join(repo,'packages/soterai-lite/builds',packed.runId,'build-provenance.json');
 const {auditFinalRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));
 const audit=await auditFinalRelease({repoRoot:repo,vsixPath:artifact,expectedSha256:packed.sha256,buildReceiptPath:provenance,packageReceiptPath:path.join(path.dirname(provenance),'package-receipt.json')});
 assert.equal(audit.report.entries.length,18);assert.equal(audit.report.runtimes.length,4);
 const inventory=own('offline-inventory-01'),extracted=own('vsix-extracted-01');assert(!fs.existsSync(inventory));assert(!fs.existsSync(extracted));
 await fsp.mkdir(inventory);await fsp.writeFile(path.join(inventory,'release-inventory.json'),JSON.stringify(audit.report,null,2)+'\n',{flag:'wx'});await fsp.writeFile(path.join(inventory,'sbom.cdx.json'),JSON.stringify(audit.sbom,null,2)+'\n',{flag:'wx'});
 const expected=new Map(audit.report.entries.map(row=>[row.path,row])),seen=new Set();let total=0;
 const zip=await yauzl.fromBufferPromise(artifactRaw,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true});
 try{for await(const entry of zip.eachEntry()){
  const pin=expected.get(entry.fileName);assert(pin);assert(!seen.has(entry.fileName));seen.add(entry.fileName);
  assert(entry.uncompressedSize<=8*1024*1024);assert.equal(entry.generalPurposeBitFlag&1,0);const mode=(entry.externalFileAttributes>>>16)&0o170000;assert(mode===0||mode===0o100000);
  const stream=await zip.openReadStreamPromise(entry),chunks=[];let size=0;
  for await(const chunk of stream){size+=chunk.length;total+=chunk.length;assert(size<=entry.uncompressedSize&&size<=8*1024*1024&&total<=32*1024*1024);chunks.push(chunk);}
  const raw=Buffer.concat(chunks);assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);
  const target=path.resolve(extracted,entry.fileName);assert(target.startsWith(extracted+path.sep));await fsp.mkdir(path.dirname(target),{recursive:true});await fsp.writeFile(target,raw,{flag:'wx'});
 }}finally{zip.close();}
 assert.equal(seen.size,18);
 const manifest=read(path.join(extracted,'extension/package.json')),properties=manifest.contributes.configuration.properties,flag=properties['soterai.lite.selfHygiene'];
 assert.equal(flag.default,false);assert.equal(flag.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.selfHygiene'));
 const machine=Object.entries(properties).filter(([,row])=>row.scope==='machine');assert.equal(machine.length,88);for(const [key]of machine)assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(key),key);
 const center=properties['soterai.lite.protectionCenter'];assert.equal(center.default,true);assert.equal(center.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.protectionCenter'));for(const id of ['soterai-protected-items','soterai-protection-activity','soterai-protection-coverage']){const v=manifest.contributes.views['soterai-explorer'].find(row=>row.id===id);assert(v&&v.when==='soterai.protectionCenter'&&v.type===undefined);}
 const setup=properties['soterai.lite.setupVerification'];assert.equal(setup.default,true);assert.equal(setup.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.setupVerification'));assert.equal(manifest.contributes.commands.filter(c=>c.command==='soterai.verifySetup').length,1);
 const prepush=properties['soterai.lite.historyHooks.prePush'];assert(prepush);assert.equal(prepush.default,false);assert.equal(prepush.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.historyHooks.prePush'));for(const id of ['installPrePushGuard','resumePrePushGuard','restorePrePushGuard','prePushGuardStatus'])assert.equal(manifest.contributes.commands.filter(row=>row.command==='soterai.'+id).length,1);
 const client=fs.readFileSync(path.join(extracted,'extension/dist/pre-commit-client.js'));for(const marker of ['--pre-push','--pin','--index','--replay','/pre-push','SoterAI-PrePush-'])assert(client.includes(Buffer.from(marker)),marker);
 const reliability=properties['soterai.lite.reliability'];assert(reliability&&reliability.default===true&&reliability.scope==='machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.reliability'));assert.equal(manifest.contributes.commands.filter(c=>c.command==='soterai.readReliabilityStatus').length,1);
 assert.equal(manifest.capabilities.virtualWorkspaces.supported,false);assert.deepEqual(manifest.soteraiLiteRelease.unsupportedFeatures,['preCommit']);assert.equal(audit.report.preRelease,true);assert.equal(audit.report.status,'PASS_FINAL_OFFLINE_PACKAGE_NOT_RELEASE_READY');
 const frontend=fs.readFileSync(path.join(extracted,'extension/dist/extension.js'));assert.equal(sha(frontend),packed.extensionSha256);
 for(const marker of ['owned-metadata-v1','Owned ledger storage unavailable.','sanitizedProjection'])assert(frontend.includes(Buffer.from(marker)),marker);
 const backend=fs.readFileSync(path.join(extracted,'extension/dist/local-ai-broker.js'));for(const marker of ['owned-metadata-v1','owned_activity_withheld','SOTERAI_SELF_HYGIENE'])assert(backend.includes(Buffer.from(marker)),marker);
 const mcp=fs.readFileSync(path.join(extracted,'extension/dist/soterai-mcp-server.js'));for(const marker of ['Unknown tool','Method not found','SoterAI check unavailable'])assert(mcp.includes(Buffer.from(marker)),marker);
 inputs();assert.equal(sha(fs.readFileSync(artifact)),packed.sha256);
 emit('content-inspection-01.json',{status:'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE',observedAt:new Date().toISOString(),vsix:packed,buildReceipt:path.relative(repo,provenance).replace(/\\/g,'/'),sourceCount:proof.fileCount,full:counts,machineSettings:machine.length,selfHygieneDefault:false,protectionCenterDefault:true,setupVerificationDefault:true,restricted:true,entryCount:18,runtimeCount:4,entries:audit.report.entries,extractedRoot:path.relative(repo,path.join(extracted,'extension')).replace(/\\/g,'/'),releaseReady:false,native:'NOT_RUN',f26aNative09:'USER_SKIPPED_INCOMPLETE_NO_MORE_HOST_NATIVE_RUNS',push:'NOT_AUTHORIZED_NOT_RUN'});
 console.log(JSON.stringify({status:'PASS_CURRENT_CONTENT_ONLY',vsixSha256:packed.sha256,entries:18,runtimes:4,machineSettings:88,full:counts,releaseReady:false}));
}
main().catch(error=>{console.error('F31b exact content inspection refused: '+(error instanceof Error?error.name:'UnknownFailure'));process.exitCode=1;});
