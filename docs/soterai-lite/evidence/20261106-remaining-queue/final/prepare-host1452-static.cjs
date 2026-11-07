'use strict';
// Inert successor creation only. No installed host reads or process launches.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../../../..'),life=path.join(repo,'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4');
const sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};};
const changes=[],outputs=[];
function replace(text,before,after,file,count){const found=text.split(before).length-1;assert(found>0&&(count===undefined||count===found),file+': '+before);changes.push({file,before,after,count:found});return text.split(before).join(after);}
function put(name,text){const file=path.join(life,name);if(name.endsWith('.cjs'))new vm.Script(text,{filename:file});fs.writeFileSync(file,text,{flag:'wx'});outputs.push(fact(file));}
let observer=fs.readFileSync(path.join(life,'observe-public-vendor-04.cjs'),'utf8');
for(const[a,b]of[['1.145.1','1.145.2'],['6bab64e2d12b04d04c0d99c27ff166023efd1dda','c4453f8ea430795f941c1b2ff6c9321135a74a02'],['6bab64e2d1','c4453f8ea4'],['public-vendor-observation-04.json','public-vendor-observation-05.json']])observer=replace(observer,a,b,'observer05');
put('observe-public-vendor-05.cjs',observer);
let signatures=fs.readFileSync(path.join(life,'observe-current-signatures-04.ps1'),'utf8');
for(const[a,b]of[['1.145.1','1.145.2'],['current-signature-observation-04.json','current-signature-observation-05.json'],['public-vendor-observation-04.json','public-vendor-observation-05.json']])signatures=replace(signatures,a,b,'signatures05');
put('observe-current-signatures-05.ps1',signatures);
let cli=fs.readFileSync(path.join(life,'qualify-vendor-installed-size-04.cjs'),'utf8');
for(const[a,b]of[['1.145.1','1.145.2'],['6bab64e2d1','c4453f8ea4'],['public-vendor-observation-04.json','public-vendor-observation-05.json'],['vendor-installed-size-qualification-04.json','vendor-installed-size-qualification-05.json']])cli=replace(cli,a,b,'cli05');
const admission=[
"  assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--run');",
"  assert.equal(process.argv[3],fact(own('public-vendor-observation-05.json')).sha256,'Exact new vendor receipt required');",
"  const signature=read(own('current-signature-observation-05.json'));",
"  assert.equal(signature.vendorReceiptSha256,process.argv[3]);assert.equal(signature.rows.length,3);",
"  for(const row of signature.rows){assert.equal(row.status,'Valid');assert.equal(fact(row.path).sha256,row.sha256);}",
"  const prior=read(own('installed-extra09-admission.json'));",
"  const config=read(path.join(__dirname,'../20261106-remaining-queue/candidate-01/f32-candidate-config.json'));",
"  const currentVsix=config.currentVsix,oldVsix=prior.oldVsix;",
"  assert.equal(currentVsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');",
"  assert.equal(oldVsix.sha256,'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677');",
"  verifyFact(currentVsix);verifyFact(oldVsix);",
"  fs.writeFileSync(own('vendor-installed-size-consumption-05.json'),JSON.stringify({status:'ONE_EXPLICIT_CURRENT_HOST_CLI_QUALIFICATION_CONSUMED',observedAt:new Date().toISOString(),vendorReceiptSha256:process.argv[3],currentVsix,oldVsix},null,2)+'\\n',{flag:'wx'});"
].join('\n');
cli=replace(cli,"  const prior = read(own('vendor-installed-size-qualification-03.json'));\n  const currentVsix = prior.current.vsix, oldVsix = prior.old.vsix;",admission,'cli05',1);
cli=replace(cli,"  const source = fs.readFileSync(vendor.currentHost.cliProcessMain.path, 'utf8');","  for(const row of [vendor.currentHost.executable,vendor.currentHost.codeCli,vendor.currentHost.cliProcessMain])verifyFact(row);\n  const source = fs.readFileSync(vendor.currentHost.cliProcessMain.path, 'utf8');",'cli05',1);
put('qualify-vendor-installed-size-05.cjs',cli);
const receipt={status:'PASS_INERT_HOST1452_OBSERVER_SIGNATURE_CLI_SCRIPTS_PREPARED_NOT_EXECUTED',observedAt:new Date().toISOString(),outputs,changes,hostObservations:0,nativeLaunches:0,productWrites:0};
fs.writeFileSync(path.join(__dirname,'host1452-static-preparation-01.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,outputs}));
