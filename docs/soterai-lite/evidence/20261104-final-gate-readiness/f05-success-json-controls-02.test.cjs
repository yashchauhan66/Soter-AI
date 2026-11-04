'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('./run-f05-current-proposed-02.cjs'),b=JSON.parse(fs.readFileSync(path.join(__dirname,'f05-current-binding-02.json'))),repo=path.resolve(__dirname,'../../../..');
const source=fs.readFileSync(path.join(repo,b.driverSource.path),'utf8'),declarations=[...source.matchAll(/\["(F05-H\d{2})", "([^"\r\n]+)"\]/g)].map(m=>({id:m[1],scope:m[2]}));
function sample(phase='save'){const ids=phase==='save'?['01','02','03','04','05','06','07']:['08','09','10'];const observations=declarations.filter(o=>ids.includes(o.id.slice(-2))).map(o=>({...o,status:'PASS'}));return JSON.parse(JSON.stringify({phase,hostVersion:b.codeVersion,syntheticOnly:true,passed:observations.length,failed:0,notRun:0,extensionBundleSha256:b.frontendSha256,currentDeveloperBundleSha256:b.frontendSha256,hostProbeSha256:b.driver.sha256,observations,driverFailure:undefined}));}
test('F05 original JSON success omits undefined driverFailure; old exact predicate rejects before native launch',()=>{const r=sample();assert(!Object.hasOwn(r,'driverFailure'));assert.throws(()=>assert.equal(r.driverFailure,null));});
test('F05 successor accepts exact original save7 success serialization',()=>api.validateResult(sample(),b,b.phases[0]));
test('F05 successor accepts exact original reload3 IDs and scopes',()=>api.validateResult(sample('reload'),b,b.phases[1]));
test('F05 successor rejects actual driver failure',()=>{const r=sample();r.driverFailure='AssertionError';assert.throws(()=>api.validateResult(r,b,b.phases[0]));});
test('F05 successor rejects altered ID despite passing counts',()=>{const r=sample();r.observations[0].id='F05-H99';assert.throws(()=>api.validateResult(r,b,b.phases[0]));});
test('F05 successor rejects weakened scope despite passing counts',()=>{const r=sample();r.observations[0].scope='weakened';assert.throws(()=>api.validateResult(r,b,b.phases[0]));});
test('F05 successor rejects stale loaded runtime and host',()=>{for(const k of ['extensionBundleSha256','currentDeveloperBundleSha256','hostProbeSha256','hostVersion']){const r=sample();r[k]='stale';assert.throws(()=>api.validateResult(r,b,b.phases[0]));}});
test('F05 successor rejects omitted or failed native observations',()=>{for(const mode of ['missing','failed']){const r=sample();if(mode==='missing')r.observations.pop();else r.observations[0].status='FAIL';assert.throws(()=>api.validateResult(r,b,b.phases[0]));}});
test('F05 successor rejects incorrect phase and non-synthetic result',()=>{for(const [k,v]of [['phase','reload'],['syntheticOnly',false]]){const r=sample();r[k]=v;assert.throws(()=>api.validateResult(r,b,b.phases[0]));}});
test('F05 prelaunch correction did not consume either invocation',()=>{for(const n of ['f05-current-consumption-01.json','f05-current-consumption-02.json'])assert(!fs.existsSync(path.join(__dirname,n)));});
