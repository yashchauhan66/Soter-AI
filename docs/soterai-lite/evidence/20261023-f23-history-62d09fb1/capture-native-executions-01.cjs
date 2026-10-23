'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./scoped-git-lib-01.cjs');
const out=path.join(__dirname,'actual-native-execution-snapshots-01');fs.mkdirSync(out);const records=[];
for(const entry of fs.readdirSync(__dirname,{withFileTypes:true}).filter(row=>row.isDirectory()&&row.name.startsWith('f23-'))){
 const freeze=path.join(__dirname,entry.name,'freeze.json');if(!fs.existsSync(freeze))continue;
 const value=JSON.parse(fs.readFileSync(freeze,'utf8'));if(!value.executionExtension)continue;
 const root=path.resolve(value.executionExtension);assert(root.toLowerCase().startsWith('d:\\soterai-lite-test-profiles\\f23-'));
 for(const relative of ['package.json','dist-test/native-bootstrap.cjs','dist-test/host/index.js']){
  const source=path.join(root,relative),stat=fs.lstatSync(source);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);
  const bytes=fs.readFileSync(source),target=path.join(out,entry.name,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
  const expected=relative==='package.json'?value.fixtureManifestSha256:relative.endsWith('bootstrap.cjs')?value.bootstrapSha256:value.hostProbeSha256;
  assert.equal(e.sha(bytes),expected,'Actual executed fixture identity');records.push({source,path:path.relative(e.repo,target).replaceAll('\\','/'),bytes:bytes.length,sha256:e.sha(bytes)});
 }
}
assert(records.some(row=>row.path.includes('/f23-history-native-')),'Actual executed history fixture required');
for(const [source,name] of [['docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/privacy-host.js','functional10-driver.js'],['docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/security-host.js','security17-driver.js']]){const bytes=fs.readFileSync(path.join(e.repo,source)),target=path.join(out,name);fs.writeFileSync(target,bytes,{flag:'wx'});records.push({source,path:path.relative(e.repo,target).replaceAll('\\','/'),bytes:bytes.length,sha256:e.sha(bytes)});}
fs.writeFileSync(path.join(__dirname,'actual-native-execution-snapshots-01.json'),JSON.stringify({status:'EXACT_ACTUAL_EXECUTED_FIXTURE_BYTES',records,scope:'Private manifests/bootstrap/drivers copied only from the exact owned synthetic F23 execution roots and verified against actual freezes. Existing functional/security driver originals retained. No normal profile or source-secret read.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'CAPTURED',files:records.length}));
