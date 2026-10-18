// Recover only exact frozen fixture bytes; SHA mismatch never becomes a match.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),freeze=JSON.parse(fs.readFileSync(path.join(__dirname,'fixture-freeze-01.json'),'utf8'));
const facts=[];
for(const expected of freeze.files){
 let source=fs.readFileSync(path.join(repo,expected.path),'utf8').replace(/\r\n/g,'\n');
 if(expected.path.endsWith('gatewayPolicyBoundary.test.ts')){
  source=source.slice(0,source.indexOf('test("F16-P13'));
  const start=source.indexOf('    const high='),end=source.indexOf('    assert.ok(boundary([]).prepareRequest("openai",chat("a".repeat(100)))',start);assert.ok(start>=0&&end>start);
  source=source.slice(0,start)+'    for(const content of ["sk-proj-"+"SYNTHETIC_F16_PROVIDER".repeat(5),"aZ7+Qx3/Pr8=Td4_Bu9-Ke2.Mw6:Vy5!Ns0"])assert.throws(()=>boundary([]).prepareRequest("openai",chat(content)));\n'+source.slice(end);
 }
 if(expected.path.endsWith('gatewayPolicyWire.test.ts')){
  source=source.slice(0,source.indexOf('test("F16-W14'));
  source=source.replace('import type {ServerResponse} from "node:http";\n','').replace('import { randomUUID } from "node:crypto";\n','');
  source=source.replace('if(typeof output==="function"){output(res);return;}','').replace('] as Record<string,string>[])','])');
 }
 const candidates=new Map();for(const ending of ['\n','\r\n'])for(let trailing=0;trailing<=2;trailing++){const text=source.replace(/\n+$/,'')+'\n'.repeat(trailing),bytes=Buffer.from(text.replace(/\n/g,ending));candidates.set(sha(bytes),bytes);}
 const bytes=candidates.get(expected.sha256);assert.ok(bytes,'Exact frozen content could not be recovered: '+expected.path);assert.equal(bytes.length,expected.bytes);
 const name='frozen-01-'+path.basename(expected.path)+'.txt';fs.writeFileSync(path.join(__dirname,name),bytes,{flag:'wx'});facts.push({original:expected.path,retained:name,bytes:bytes.length,sha256:sha(bytes)});
}
fs.writeFileSync(path.join(__dirname,'frozen-fixture-retention-01.json'),JSON.stringify({status:'EXACT_FROZEN_SHA_BYTES_RETAINED',method:'Documented later fixture edits removed from current source; every resulting byte/length required to match the original before-production freeze. These are verified reconstructions, not a claimed earlier backup.',files:facts,observedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',frozenFiles:facts.length}));
