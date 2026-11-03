'use strict';
// No request is possible without a fresh, exact, separately approved ONE detail run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {TextDecoder}=require('node:util'),{performance}=require('node:perf_hooks');
const BASE='docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304',REPO=path.resolve(__dirname,'../../../..');
const META=BASE+'/advisory-preparation-01.json',REVIEW=BASE+'/advisory-result-review-01.json',PROPOSAL=BASE+'/ADVISORY-DETAIL-PROPOSAL01.md',RUNNER=BASE+'/advisory-detail-runner-01.cjs';
const APPROVAL=BASE+'/advisory-detail-runner-01-user-approval.json',CONSUMPTION=BASE+'/advisory-detail-runner-01-consumption.json',OUTPUT=BASE+'/advisory-detail-runner-01-results';
const EXPECTED={metadata:'619dd0ae81cd10c8276e417b00b96f9731fd1f5ea29318e0d381cdad28236a77',queryReview:'b496c352b997769ecee4c5cf7b6fbcf9e6dc5a43d9fd812e2c237147617f49ab',proposal:'3cb1423835b721964b3a9c3de38aadff4f4e0865da87ac134c81baf03c4182c4'};
const ENDPOINT='https://api.osv.dev/v1/vulns/',ANSWER='Ek bounded 42-advisory OSV detail run allow karo';
const LIMITS=Object.freeze({endpointPrefix:ENDPOINT,method:'GET',maxInitialRequests:42,requestDeadlineMs:10000,chainDeadlineMs:480000,maxResponseBytes:1048576,retries:0,redirects:false,pagination:false,referenceVisits:false,authentication:false,cookies:false});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),demand=(v,m)=>{if(!v)throw Error(m);},parse=b=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b).replace(/^\uFEFF/,''));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),[...k].sort());
const idOk=v=>typeof v==='string'&&/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(v);
function full(p){demand(typeof p==='string'&&p.length<2048&&!/[\\:\x00-\x1f\x7f]/.test(p)&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'),'Ordinary relative path required');const f=path.resolve(REPO,p);demand(f.startsWith(REPO+path.sep),'Workspace path required');return f;}
function parents(f){for(let p=path.dirname(f);;p=path.dirname(p)){const s=fs.lstatSync(p);demand(s.isDirectory()&&!s.isSymbolicLink(),'Ordinary evidence parents required');if(p===REPO)break;demand(p.startsWith(REPO+path.sep),'Evidence escaped');}}
function read(p,cap=2097152){const f=full(p);parents(f);const a=fs.lstatSync(f);demand(a.isFile()&&!a.isSymbolicLink()&&a.nlink===1&&a.size<=cap,'Bounded ordinary input required');const b=fs.readFileSync(f),z=fs.lstatSync(f);demand(z.isFile()&&!z.isSymbolicLink()&&z.nlink===1&&a.ino===z.ino&&a.size===z.size&&a.mtimeMs===z.mtimeMs&&a.ctimeMs===z.ctimeMs&&b.length===a.size,'Input changed');return b;}
function pin(r,cap){demand(r&&Number.isSafeInteger(r.bytes)&&r.bytes>=0&&/^[a-f0-9]{64}$/.test(r.sha256),'Exact input pin required');const b=read(r.path,cap);demand(b.length===r.bytes&&sha(b)===r.sha256,'Input hash mismatch: '+r.path);return b;}
function write(p,value){const f=full(p);parents(f);fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
function absent(p){try{fs.lstatSync(full(p));throw Error('Existing output/consumption refuses');}catch(e){if(e.code!=='ENOENT')throw e;}}
function exactIds(review){demand(review?.status==='CURRENT_DECLARED_SCOPE_LOOKUP_COMPLETE_FINDINGS_REVIEW_REQUIRED'&&review.queryMapping?.length===284,'Exact completed query review required');const ids=[...new Set(review.queryMapping.flatMap(q=>q.advisories.map(v=>v.id)))].sort();demand(ids.length===42&&ids.every(idOk),'Exactly42 previously observed GHSA IDs required');return ids;}
function validateInputs(){
 demand(path.resolve(__filename)===full(RUNNER),'Reviewed detail runner path required');
 const raw={metadata:read(META),queryReview:read(REVIEW),proposal:read(PROPOSAL),runner:read(RUNNER,131072)},pins={};
 for(const [name,p]of Object.entries({metadata:META,queryReview:REVIEW,proposal:PROPOSAL,runner:RUNNER})){if(EXPECTED[name])demand(sha(raw[name])===EXPECTED[name],'Pinned '+name+' mismatch');pins[name]={path:p,sha256:sha(raw[name])};}
 const meta=parse(raw.metadata),review=parse(raw.queryReview),ids=exactIds(review);
 for(const r of review.inputEvidence)pin(r,16777216);
 demand(meta.sourceProof.sha256==='221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99'&&meta.artifact.sha256==='6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c','Exact source/artifact required');
 const proof=parse(pin(meta.sourceProof));demand(proof.fileCount===1098&&proof.files.length===1098,'Exact source count');for(const r of proof.files)pin(r,8388608);
 const lock=parse(pin(meta.lockfile));demand(meta.installedGraph.packages.length===298,'Exact installed graph');for(const r of meta.installedGraph.packages){const p=parse(pin(r.metadata));demand(p.name===r.name&&p.version===r.version&&lock.packages[r.lockfile.path]?.version===r.version,'Installed metadata/lock mismatch');}
 const originals=[];for(let i=1;i<=8;i++){const d=parse(read(BASE+'/advisory-runner-01-results/batch-'+String(i).padStart(2,'0')+'-response.bin'));demand(d.results.length===meta.proposedRequest.batches[i-1].queryCount,'Prior complete result count');for(const row of d.results){demand(!Object.hasOwn(row,'next_page_token'),'Prior pagination outside approval');for(const v of row.vulns||[])originals.push(v.id);}}
 demand(same([...new Set(originals)].sort(),ids),'IDs disagree with original raw responses');
 const schedule=ids.map((id,i)=>({ordinal:i+1,id,url:ENDPOINT+id,associations:review.queryMapping.filter(q=>q.advisories.some(v=>v.id===id)).map(q=>({name:q.name,version:q.version,ecosystem:q.ecosystem,scope:q.scope}))}));
 return{pins,schedule,idListSha256:sha(Buffer.from(JSON.stringify(ids))),sourceProof:meta.sourceProof,artifact:meta.artifact};
}
function scope(digest){demand(/^[a-f0-9]{64}$/.test(digest),'Exact ID-list digest required');return{...LIMITS,idListSha256:digest};}
function approvalTemplate(pins,digest,reference,approvedAt,expiresAt){return{schemaVersion:1,status:'USER_APPROVED_ONE_BOUNDED_OSV_DETAIL_RUN',runCount:1,decision:{reference,answer:ANSWER},approvedAt,expiresAt,...pins,scope:scope(digest)};}
function admitApproval(a,pins,digest,now=Date.now()){
 demand(keys(a,['schemaVersion','status','runCount','decision','approvedAt','expiresAt',...Object.keys(pins),'scope'])&&a.schemaVersion===1&&a.status==='USER_APPROVED_ONE_BOUNDED_OSV_DETAIL_RUN'&&a.runCount===1,'Fresh ONE detail approval required');
 demand(keys(a.decision,['reference','answer'])&&typeof a.decision.reference==='string'&&/^[A-Za-z0-9_\[\],:.-]{1,256}$/.test(a.decision.reference)&&a.decision.answer===ANSWER,'Exact new detail owner reply required');
 const issued=Date.parse(a.approvedAt),expires=Date.parse(a.expiresAt),utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v);
 demand(utc(a.approvedAt)&&utc(a.expiresAt)&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now&&expires>now&&expires-issued>0&&expires-issued<=3600000&&now-issued<=3600000,'Fresh bounded UTC approval required');
 for(const[k,v]of Object.entries(pins))demand(keys(a[k],['path','sha256'])&&a[k].path===v.path&&a[k].sha256===v.sha256,'Approval input mismatch');
 const expected=scope(digest);demand(keys(a.scope,Object.keys(expected))&&Object.keys(expected).every(k=>a.scope[k]===expected[k]),'Exact detail scope required');return true;
}
async function guardedStart({approval,pins,digest,now,consume,request}){admitApproval(approval,pins,digest,now);await consume();return request();}
function parseRecord(raw,expectedId,t,associations=[]){
 const incomplete=reason=>({status:'INCOMPLETE',id:expectedId,reason,releaseReady:false});
 if(!idOk(expectedId)||!t||t.statusCode!==200||t.requestClose!==true||t.responseClose!==true||t.responseEnd!==true||t.responseComplete!==true||t.timedOut||t.overflow||t.aborted||t.error||!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(t.contentType||'')||!['','identity'].includes(t.contentEncoding||''))return incomplete('TRANSPORT_OR_CONTENT_TYPE_NOT_ACCEPTED');
 if(!Buffer.isBuffer(raw)||raw.length>LIMITS.maxResponseBytes)return incomplete('RESPONSE_BOUNDS');let d;try{d=parse(raw);}catch{return incomplete('MALFORMED_UTF8_OR_JSON');}
 const text=(v,n)=>typeof v==='string'&&v.length<=n,stamp=v=>text(v,128)&&Number.isFinite(Date.parse(v));
 if(!d||typeof d!=='object'||Array.isArray(d)||d.id!==expectedId||!stamp(d.modified)||!Array.isArray(d.affected)||d.affected.length>128||Object.hasOwn(d,'next_page_token'))return incomplete('WRONG_ID_OR_UNSUPPORTED_RECORD');
 if((d.published!==undefined&&!stamp(d.published))||(d.withdrawn!==undefined&&!stamp(d.withdrawn))||(d.summary!==undefined&&!text(d.summary,65536))||(d.details!==undefined&&!text(d.details,1048576)))return incomplete('UNSUPPORTED_RECORD_FIELDS');
 const severity=d.severity??[];if(!Array.isArray(severity)||severity.length>32||severity.some(s=>!s||!text(s.type,128)||!text(s.score,4096)))return incomplete('UNSUPPORTED_SEVERITY');
 const aliases=d.aliases??[];if(!Array.isArray(aliases)||aliases.length>512||aliases.some(v=>!text(v,512)))return incomplete('UNSUPPORTED_ALIASES');
 const affected=[];
 for(const a of d.affected){
  if(!a||typeof a!=='object'||!a.package||!text(a.package.name,512)||!text(a.package.ecosystem,128))return incomplete('UNSUPPORTED_AFFECTED_PACKAGE');
  const ranges=a.ranges??[],versions=a.versions??[],s=a.severity??[];
  if(!Array.isArray(ranges)||ranges.length>128||!Array.isArray(versions)||versions.length>16384||versions.some(v=>!text(v,256))||!Array.isArray(s)||s.length>32||s.some(v=>!v||!text(v.type,128)||!text(v.score,4096)))return incomplete('UNSUPPORTED_AFFECTED_BOUNDS');
  for(const r of ranges){if(!r||!text(r.type,128)||(r.repo!==undefined&&!text(r.repo,4096))||!Array.isArray(r.events)||r.events.length>4096)return incomplete('UNSUPPORTED_RANGE');for(const e of r.events){if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==1||!Object.keys(e).every(k=>['introduced','fixed','last_affected','limit'].includes(k)&&text(e[k],512)))return incomplete('UNSUPPORTED_RANGE_EVENT');}}
  affected.push({package:{name:a.package.name,ecosystem:a.package.ecosystem,...(text(a.package.purl,4096)?{purl:a.package.purl}:{})},ranges,listedVersions:versions,severity:s,databaseSpecificSeverity:typeof a.database_specific?.severity==='string'?a.database_specific.severity:null});
 }
 const references=d.references??[];if(!Array.isArray(references)||references.length>2048||references.some(r=>!r||!text(r.type,128)||!text(r.url,4096)))return incomplete('UNSUPPORTED_REFERENCE_FIELDS');
 const mapped=associations.map(q=>({...q,recordPackageMatch:affected.some(a=>a.package.name===q.name&&a.package.ecosystem===q.ecosystem),versionRangeAssessment:'NOT_COMPUTED_REQUIRES_TRIAGE'}));
 return{status:'ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED',id:d.id,modified:d.modified,published:d.published??null,withdrawn:d.withdrawn??null,summary:d.summary??null,aliases,severity,databaseSpecificSeverity:typeof d.database_specific?.severity==='string'?d.database_specific.severity:null,affected,references,associations:mapped,missingSeverity:severity.length===0&&!d.database_specific?.severity&&affected.every(a=>a.severity.length===0&&!a.databaseSpecificSeverity),noGuessedSeverityOrFixedVersion:true,releaseReady:false};
}
function aggregate(rows,expectedIds){const complete=rows.length===expectedIds.length&&same(rows.map(r=>r.id),expectedIds)&&rows.every(r=>r.status==='ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED');return{status:complete?'DETAIL_RECORDS_CAPTURED_FINDINGS_TRIAGE_REQUIRED':'INCOMPLETE',expectedRecords:expectedIds.length,capturedRecords:rows.filter(r=>r.status==='ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED').length,findingsGate:'TRIAGE_REQUIRED_NOT_PASS',otherLockfileVersionRecordsUnaudited:745,referenceVisits:0,retryRequests:0,paginationRequests:0,releaseReady:false};}
function requestRecord(item,remainingMs){
 const https=require('node:https'),start=performance.now(),label=String(item.ordinal).padStart(2,'0'),rawPath=OUTPUT+'/detail-'+label+'-response.bin',target=full(rawPath);parents(target);const fd=fs.openSync(target,'wx');let req,res,timer,retained=0,observed=0;
 const t={id:item.id,endpoint:item.url,method:'GET',startedAt:new Date().toISOString(),statusCode:null,contentType:'',contentEncoding:'',requestClose:false,responseClose:false,responseEnd:false,responseComplete:false,timedOut:false,overflow:false,aborted:false,error:null};
 return new Promise(resolve=>{let done=false;function finish(){if(done)return;done=true;clearTimeout(timer);try{fs.closeSync(fd);}catch{t.error||='RESPONSE_FILE_CLOSE_FAILED';}t.elapsedMs=performance.now()-start;t.finishedAt=new Date().toISOString();t.retainedBytes=retained;t.observedBytes=observed;const raw=fs.readFileSync(target),record=parseRecord(raw,item.id,t,item.associations);write(OUTPUT+'/detail-'+label+'-transport.json',{...t,rawResponse:{path:rawPath,bytes:raw.length,sha256:sha(raw)},interpretation:record});resolve(record);}
  write(OUTPUT+'/detail-'+label+'-start.json',{ordinal:item.ordinal,id:item.id,endpoint:item.url,method:'GET',startedAt:t.startedAt});const budget=Math.min(LIMITS.requestDeadlineMs,remainingMs)-(performance.now()-start);if(budget<=0){t.timedOut=true;t.error='ABSOLUTE_DEADLINE_BEFORE_REQUEST';finish();return;}
  timer=setTimeout(()=>{t.timedOut=true;t.error||='ABSOLUTE_REQUEST_DEADLINE';req?.destroy();res?.destroy();},budget);
  try{req=https.request(item.url,{method:'GET',agent:false,minVersion:'TLSv1.2',rejectUnauthorized:true,headers:{accept:'application/json'}},response=>{res=response;t.statusCode=res.statusCode??null;t.contentType=typeof res.headers['content-type']==='string'?res.headers['content-type']:'';t.contentEncoding=typeof res.headers['content-encoding']==='string'?res.headers['content-encoding']:'';
    res.on('data',chunk=>{observed+=chunk.length;const keep=Math.max(0,Math.min(chunk.length,LIMITS.maxResponseBytes-retained));try{let at=0;while(at<keep)at+=fs.writeSync(fd,chunk,at,keep-at);retained+=keep;}catch{t.error||='RESPONSE_FILE_WRITE_FAILED';req.destroy();res.destroy();return;}if(observed>LIMITS.maxResponseBytes){t.overflow=true;req.destroy();res.destroy();}});
    res.once('end',()=>{t.responseEnd=true;t.responseComplete=res.complete===true;});res.once('aborted',()=>{t.aborted=true;});res.once('error',()=>{t.error||='RESPONSE_ERROR';});res.once('close',()=>{t.responseClose=true;t.responseComplete=res.complete===true;if(t.requestClose)finish();});
   });req.once('error',()=>{t.error||='REQUEST_ERROR';});req.once('close',()=>{t.requestClose=true;if(!res||t.responseClose)finish();});req.end();
  }catch{t.error||='REQUEST_SETUP_FAILED';if(req)req.destroy();else finish();}
 });
}
async function main(args){
 demand(args.length===1&&['--validate','--run'].includes(args[0]),'Use only --validate or --run');const prepared=validateInputs();
 if(args[0]==='--validate'){console.log(JSON.stringify({status:'PASS_READ_ONLY_DETAIL_ADMISSION_NOT_AUTHORIZED_NOT_RUN',pins:prepared.pins,idListSha256:prepared.idListSha256,records:42,sourceRecords:1098,installedMetadataRecords:298,scope:scope(prepared.idListSha256),networkAttempts:0,releaseReady:false}));return;}
 const approvalRaw=read(APPROVAL,32768),approval=parse(approvalRaw);admitApproval(approval,prepared.pins,prepared.idListSha256);absent(CONSUMPTION);absent(OUTPUT);
 const current=validateInputs();demand(same(current.pins,prepared.pins)&&current.idListSha256===prepared.idListSha256&&sha(read(APPROVAL,32768))===sha(approvalRaw),'Admission changed');const rows=[];
 await guardedStart({approval,pins:current.pins,digest:current.idListSha256,now:Date.now(),consume:()=>{absent(OUTPUT);write(CONSUMPTION,{status:'ONE_USER_APPROVED_DETAIL_RUN_CONSUMED_NO_RETRY',consumedAt:new Date().toISOString(),approval:{path:APPROVAL,bytes:approvalRaw.length,sha256:sha(approvalRaw)},pins:current.pins,scope:scope(current.idListSha256)});fs.mkdirSync(full(OUTPUT));},request:async()=>{const begin=performance.now();for(const item of current.schedule){const remaining=LIMITS.chainDeadlineMs-(performance.now()-begin);if(remaining<=0)break;const record=await requestRecord(item,remaining);rows.push(record);if(record.status==='INCOMPLETE')break;}}});
 const summary={...aggregate(rows,current.schedule.map(r=>r.id)),observedAt:new Date().toISOString(),pins:current.pins,idListSha256:current.idListSha256,artifact:current.artifact,requestAttempts:rows.length,remaining:current.schedule.slice(rows.length).map(r=>({id:r.id,status:'NOT_RUN'})),records:rows};write(OUTPUT+'/summary.json',summary);console.log(JSON.stringify(summary));
}
module.exports={ANSWER,LIMITS,exactIds,scope,approvalTemplate,admitApproval,guardedStart,parseRecord,aggregate,validateInputs};
if(require.main===module)main(process.argv.slice(2)).catch(()=>{console.error('Advisory detail admission/run incomplete; no clean result or retry authority. Retain existing evidence.');process.exitCode=1;});
