'use strict';
// Rebinds existing route packets to the observed common1.145.2 host; no launches.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../../../..'),common=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-current-02');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fact=p=>{const raw=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};};
function pin(row){const p=path.resolve(repo,row.path),st=fs.lstatSync(p),actual=fact(p);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1);assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);return p;}
function prepare(){
 const b=require(path.join(common,'v01-admission.cjs')).binding();assert.equal(b.hostVersion,'1.145.2');assert.equal(b.vsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');assert.equal(b.sourceProof.sha256,'23fd63bb04122bf055f656a77424085b75ff3e3c813121c15034cd209fd1c8f6');
 const results=[];
 for(const id of ['cline','claude','gemini']){
  const old=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-'+id+'-02'),out=path.join(repo,'docs/soterai-lite/evidence/20261106-v01-'+id+'-03'),own=n=>path.join(out,n);
  const r=read(path.join(old,'route-binding.json'));assert.equal(r.id,id);assert.equal(r.hostVersion,'1.145.1');assert.equal(r.vsix.sha256,b.vsix.sha256);assert.equal(r.sourceProof.sha256,b.sourceProof.sha256);
  for(const row of [r.originalPin,r.originalWrapper,r.ownedHelper,...r.selectedInputs,...r.publicInputs,...r.fixtureInputs,...(r.failedAttemptInputs||[])])pin(row);
  assert(!fs.existsSync(out),'Fresh route03 required');fs.mkdirSync(out);
  const put=(name,value)=>fs.writeFileSync(own(name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const unique=new Map();for(const row of r.fixtureInputs){assert.equal(path.dirname(path.resolve(repo,row.path)),old,'Only flat fixture files are copied');const name=path.basename(row.path);assert(!unique.has(name));unique.set(name,row);put(name,fs.readFileSync(pin(row)));}
  r.affectedAdmission=fact(path.join(common,'v01-admission.cjs'));r.affectedBinding=fact(path.join(common,'binding.json'));r.code=b.code;r.hostVersion=b.hostVersion;
  r.wrapper=fact(own(path.basename(r.wrapper.path)));r.driver=fact(own(path.basename(r.driver.path)));r.guard=fact(own(path.basename(r.guard.path)));r.fixtureInputs=[...unique.keys()].map(n=>fact(own(n)));
  r.copied=r.copied.map(row=>({...row,target:fact(own(path.basename(row.target.path)))}));if(r.hook)r.hook.driver=fact(own(path.basename(r.hook.driver.path)));
  r.hostRebinding={priorBinding:fact(path.join(old,'route-binding.json')),previousHostVersion:'1.145.1',newHostVersion:'1.145.2',sourceProof:b.sourceProof,vsix:b.vsix,fixtureByteChanges:0,vendorByteChanges:0,resultTransfer:0,newNativeLaunches:0};
  put('route-binding.json',r);for(const name of unique.keys())if(name.endsWith('.cjs'))new vm.Script(fs.readFileSync(own(name),'utf8'),{filename:name});
  const wrapper=fs.readFileSync(own('run-current-route.ps1'),'utf8');const bootstraps=[...wrapper.matchAll(/@'\r?\n([\s\S]*?)\r?\n'@/g)];for(const item of bootstraps)new vm.Script(item[1]);
  require(own('route-admission.cjs')).validate();
  const result={status:'PREPARED_HOST1452_ROUTE_NOT_RUN',id,binding:fact(own('route-binding.json')),runner:fact(own('run-v01-route.cjs')),checks:r.count,hookChecks:r.hook?.expected||0,hostRebinding:r.hostRebinding,embeddedBootstrapsParsed:bootstraps.length};put('preparation.json',result);results.push(result);
 }
 console.log(JSON.stringify(results));return results;
}
module.exports={prepare};if(require.main===module){try{prepare();}catch(error){console.error(error);process.exitCode=1;}}
