// Exact current F30 artifact inspection only. No native launch or release claim.
'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),yauzl=require('yauzl');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),emit=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function inputs(){const proof=read(own('full-inputs-03.json'));assert.equal(proof.fileCount,1036);for(const pin of proof.files){const b=fs.readFileSync(path.join(repo,pin.path));assert.equal(b.length,pin.bytes,pin.path);assert.equal(sha(b),pin.sha256,pin.path);}return proof;}
function output(name){const receipt=read(own(name+'.txt.result.json')),raw=fs.readFileSync(own(name+'.txt'));assert.equal(receipt.exitCode,0,name);assert.equal(sha(raw),receipt.sha256.toLowerCase(),name);return raw;}
function closed(name){const record=read(own(name+'-verification.json'));assert.equal(record.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT',name);assert.equal(record.actualClose,true);assert.equal(record.signal,null);assert.equal(record.stdoutEOF,true);assert.equal(record.stderrEOF,true);assert.equal(record.signalsRequested,0);assert.equal(record.wrapperExit,0);assert.equal(record.innerExit,0);assert.equal(record.deadlineExceeded,false);output(name);}
async function main(){
 const proof=inputs();
 assert.equal(read(own('serial-result-03.json')).status,'CURRENT_F30_SERIAL_SOURCE_AND_PACKAGE_PASS_NATIVE_CONTENT_PENDING');
 for(const name of ['compiler-03','backend-typecheck-01','backend-tests-01','full-tests-03','readiness-02','package-02'])closed(name);
 const full=output('full-tests-03').toString(),count=label=>{const match=full.match(new RegExp('^# '+label+' (\\d+)$','m'));assert(match,label);return Number(match[1]);};
 const counts={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped')};assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.tests,4464);assert.equal(counts.pass,4460);assert.equal(counts.skipped,4);assert.equal(counts.tests,counts.pass+counts.skipped);
 const packageRows=output('package-02').toString().split(/\r?\n/).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
 const packed=packageRows.find(row=>row.status==='PACKAGED_NOT_HOST_VERIFIED');assert(packed);assert.equal(packed.output.replaceAll('\\','/'),'packages/soterai-lite/soterai-lite-0.7.0-f30-20261028-attempt02.vsix');
 const artifact=path.join(repo,packed.output),artifactRaw=fs.readFileSync(artifact);assert.equal(artifactRaw.length,packed.bytes);assert.equal(sha(artifactRaw),packed.sha256);
 const provenance=path.join(repo,'packages/soterai-lite/builds',packed.runId,'build-provenance.json');
 const {auditRelease}=require(path.join(repo,'packages/soterai-lite/scripts/audit-release.cjs'));
 const audit=await auditRelease({repoRoot:repo,vsixPath:artifact,expectedSha256:packed.sha256,buildReceiptPath:provenance});
 assert.equal(audit.report.entries.length,15);assert.equal(audit.report.runtimes.length,4);
 const inventory=own('offline-inventory-02'),extracted=own('vsix-extracted-02');assert(!fs.existsSync(inventory));assert(!fs.existsSync(extracted));
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
 assert.equal(seen.size,15);
 const manifest=read(path.join(extracted,'extension/package.json')),properties=manifest.contributes.configuration.properties,flag=properties['soterai.lite.selfHygiene'];
 assert.equal(flag.default,false);assert.equal(flag.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.selfHygiene'));
 const machine=Object.entries(properties).filter(([,row])=>row.scope==='machine');assert.equal(machine.length,86);for(const [key]of machine)assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(key),key);
 const center=properties['soterai.lite.protectionCenter'];assert.equal(center.default,true);assert.equal(center.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.protectionCenter'));for(const id of ['soterai-protected-items','soterai-protection-activity','soterai-protection-coverage']){const v=manifest.contributes.views['soterai-explorer'].find(row=>row.id===id);assert(v&&v.when==='soterai.protectionCenter'&&v.type===undefined);}
 const setup=properties['soterai.lite.setupVerification'];assert.equal(setup.default,true);assert.equal(setup.scope,'machine');assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes('soterai.lite.setupVerification'));assert.equal(manifest.contributes.commands.filter(c=>c.command==='soterai.verifySetup').length,1);
 const frontend=fs.readFileSync(path.join(extracted,'extension/dist/extension.js'));assert.equal(sha(frontend),packed.extensionSha256);
 for(const marker of ['owned-metadata-v1','Owned ledger storage unavailable.','sanitizedProjection'])assert(frontend.includes(Buffer.from(marker)),marker);
 const backend=fs.readFileSync(path.join(extracted,'extension/dist/local-ai-broker.js'));for(const marker of ['owned-metadata-v1','owned_activity_withheld','SOTERAI_SELF_HYGIENE'])assert(backend.includes(Buffer.from(marker)),marker);
 const mcp=fs.readFileSync(path.join(extracted,'extension/dist/soterai-mcp-server.js'));for(const marker of ['Unknown tool','Method not found','SoterAI check unavailable'])assert(mcp.includes(Buffer.from(marker)),marker);
 inputs();assert.equal(sha(fs.readFileSync(artifact)),packed.sha256);
 emit('content-inspection-02.json',{status:'CONTENT_AND_OFFLINE_INVENTORY_PASS_NOT_NATIVE_OR_FEATURE_ACCEPTANCE',observedAt:new Date().toISOString(),vsix:packed,buildReceipt:path.relative(repo,provenance).replace(/\\/g,'/'),sourceCount:proof.fileCount,full:counts,machineSettings:machine.length,selfHygieneDefault:false,protectionCenterDefault:true,setupVerificationDefault:true,restricted:true,entryCount:15,runtimeCount:4,entries:audit.report.entries,extractedRoot:path.relative(repo,path.join(extracted,'extension')).replace(/\\/g,'/'),releaseReady:false,native:'NOT_RUN',native06:'F26a_USER_DEFERRED_NOT_RUN'});
 console.log(JSON.stringify({status:'PASS_CURRENT_CONTENT_ONLY',vsixSha256:packed.sha256,entries:15,runtimes:4,machineSettings:86,full:counts,releaseReady:false}));
}
main().catch(error=>{console.error('F30 exact content inspection refused: '+(error instanceof Error?error.name:'UnknownFailure'));process.exitCode=1;});
