'use strict';
// Synthetic public record and injected callbacks only. No networking or approval writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('./advisory-detail-runner-01.cjs'),now=Date.parse('2026-11-03T03:00:00Z'),digest='a'.repeat(64);
const pins=Object.fromEntries(['metadata','queryReview','proposal','runner'].map((k,i)=>[k,{path:k+'.fixture',sha256:String(i+1).repeat(64)}]));
const approval=()=>api.approvalTemplate(pins,digest,'call_explicit_new_detail_decision',new Date(now-1000).toISOString(),new Date(now+60000).toISOString());
const id='GHSA-aaaa-bbbb-cccc',record=()=>({id,modified:'2026-11-03T00:00:00Z',summary:'Synthetic public advisory fixture',severity:[{type:'CVSS_V3',score:'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'}],database_specific:{severity:'HIGH'},affected:[{package:{name:'public-fixture',ecosystem:'npm'},ranges:[{type:'SEMVER',events:[{introduced:'0'},{fixed:'2.0.0'}]}],versions:['1.0.0']}],references:[{type:'ADVISORY',url:'https://example.invalid/public-fixture'}]});
const transport=()=>({statusCode:200,contentType:'application/json',contentEncoding:'',requestClose:true,responseClose:true,responseEnd:true,responseComplete:true,timedOut:false,overflow:false,aborted:false,error:null});
const raw=v=>Buffer.from(JSON.stringify(v)),association=[{name:'public-fixture',version:'1.0.0',ecosystem:'npm',scope:'BUILD_OR_VERIFICATION_CLOSURE'}];
async function refuses(a){let consumes=0,requests=0;await assert.rejects(api.guardedStart({approval:a,pins,digest,now,consume:()=>{consumes++;},request:()=>{requests++;}}));assert.equal(consumes,0);assert.equal(requests,0);}
test('missing new detail approval cannot request or consume',()=>refuses(undefined));
for(const[label,change]of [
 ['old eight-query authority',a=>{a.status='USER_APPROVED_ONE_BOUNDED_OSV_RUN';a.decision.answer='Ek bounded 8-request OSV metadata run allow karo';}],
 ['generic continue',a=>{a.decision.answer='continue';}],
 ['changed42-ID digest',a=>{a.scope.idListSha256='f'.repeat(64);}],
 ['changed reviewed runner',a=>{a.runner={...a.runner,sha256:'f'.repeat(64)};}],
 ['43rd request',a=>{a.scope.maxInitialRequests=43;}],
 ['alternative endpoint',a=>{a.scope.endpointPrefix='https://example.invalid/';}],
 ['followed references',a=>{a.scope.referenceVisits=true;}],
 ['redirects/retries',a=>{a.scope.redirects=true;a.scope.retries=1;}],
 ['expired approval',a=>{a.expiresAt=new Date(now-1).toISOString();}]
])test('detail authority refuses '+label+' before callbacks',()=>{const a=approval();change(a);return refuses(a);});
test('valid exact new detail approval consumes before callback',async()=>{const events=[];await api.guardedStart({approval:approval(),pins,digest,now,consume:()=>events.push('consume'),request:()=>events.push('synthetic-no-network')});assert.deepEqual(events,['consume','synthetic-no-network']);});
test('existing exclusive consumption blocks callback',async()=>{let requests=0;await assert.rejects(api.guardedStart({approval:approval(),pins,digest,now,consume:()=>{throw Error('Existing consumption');},request:()=>{requests++;}}),/consumption/);assert.equal(requests,0);});
test('exact42 IDs derive from retained284 raw-result mapping',()=>{const review=JSON.parse(fs.readFileSync(path.join(__dirname,'advisory-result-review-01.json'),'utf8')),ids=api.exactIds(review);assert.equal(ids.length,42);assert.equal(new Set(ids).size,42);const changed=structuredClone(review);changed.queryMapping[0].advisories.push({id:'GHSA-zzzz-yyyy-xxxx'});assert.throws(()=>api.exactIds(changed),/Exactly42/);});
test('record preserves explicit vector, fixed events and references without following or interpreting them',()=>{const r=api.parseRecord(raw(record()),id,transport(),association);assert.equal(r.status,'ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED');assert.equal(r.databaseSpecificSeverity,'HIGH');assert.equal(r.severity[0].score,record().severity[0].score);assert.deepEqual(r.affected[0].ranges[0].events,[{introduced:'0'},{fixed:'2.0.0'}]);assert.equal(r.associations[0].recordPackageMatch,true);assert.equal(r.associations[0].versionRangeAssessment,'NOT_COMPUTED_REQUIRES_TRIAGE');assert.equal(r.releaseReady,false);});
test('absent severity is named and no numeric severity or fixed version invented',()=>{const d=record();delete d.severity;delete d.database_specific;const r=api.parseRecord(raw(d),id,transport(),association);assert.equal(r.status,'ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED');assert.equal(r.missingSeverity,true);assert.deepEqual(r.severity,[]);assert.equal(r.fixedVersion,undefined);assert.equal(r.cvssScore,undefined);});
test('withdrawn record remains explicit findings-review evidence',()=>{const d=record();d.withdrawn='2026-11-03T01:00:00Z';const r=api.parseRecord(raw(d),id,transport(),association);assert.equal(r.withdrawn,d.withdrawn);assert.equal(r.status,'ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED');});
test('package disagreement remains named for triage',()=>{const r=api.parseRecord(raw(record()),id,transport(),[{name:'different-fixture',version:'1.0.0',ecosystem:'npm'}]);assert.equal(r.status,'ADVISORY_DETAILS_CAPTURED_REVIEW_REQUIRED');assert.equal(r.associations[0].recordPackageMatch,false);});
for(const[label,change]of [
 ['wrong ID',d=>{d.id='GHSA-zzzz-yyyy-xxxx';}],['malformed range event',d=>{d.affected[0].ranges[0].events=[{fixed:'2.0.0',introduced:'0'}];}],
 ['pagination',d=>{d.next_page_token='more';}],['wrong affected shape',d=>{d.affected='unsupported';}]
])test('record refuses '+label,()=>{const d=record();change(d);assert.equal(api.parseRecord(raw(d),id,transport(),association).status,'INCOMPLETE');});
for(const[label,change]of [
 ['redirect',t=>{t.statusCode=302;}],['deadline',t=>{t.timedOut=true;}],['oversize',t=>{t.overflow=true;}],
 ['missing request close',t=>{t.requestClose=false;}],['missing response close',t=>{t.responseClose=false;}],
 ['incomplete response',t=>{t.responseComplete=false;}],['compressed body',t=>{t.contentEncoding='gzip';}]
])test('transport refuses '+label,()=>{const t=transport();change(t);assert.equal(api.parseRecord(raw(record()),id,t,association).status,'INCOMPLETE');});
test('invalid UTF8, malformed JSON and raw size above1MiB refuse',()=>{for(const b of [Buffer.from([0xff]),Buffer.from('{'),Buffer.alloc(1048577)])assert.equal(api.parseRecord(b,id,transport(),association).status,'INCOMPLETE');});
test('complete detail records still require findings triage; partial or wrong IDs incomplete',()=>{const r=api.parseRecord(raw(record()),id,transport(),association);const complete=api.aggregate([r],[id]);assert.equal(complete.status,'DETAIL_RECORDS_CAPTURED_FINDINGS_TRIAGE_REQUIRED');assert.equal(complete.findingsGate,'TRIAGE_REQUIRED_NOT_PASS');assert.equal(complete.releaseReady,false);assert.equal(api.aggregate([],[id]).status,'INCOMPLETE');assert.equal(api.aggregate([r],['GHSA-zzzz-yyyy-xxxx']).status,'INCOMPLETE');});
