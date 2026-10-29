const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const C=require('./current-admission-01.cjs'),{own,repo,read,pin,relativeFile}=C;
async function guard(){
 const current=await C.guard(),p=read(own('native-driver-provenance-07.json'));
 assert(p.diagnosticOnly);assert.equal(p.unchangedOracles,34);assert.equal(p.reusedExactCurrentDrivers,24);assert.equal(p.drivers.length,25);assert.equal(p.sourceInputs.length,2);
 assert.deepEqual(p.sourceProof,current.sourceProof);
 for(const r of p.drivers)await pin({...r,path:path.relative(repo,own(r.path)).replace(/\\/g,'/')});
 for(const r of [...p.sourceInputs,p.transform,...p.componentEvidence])await pin(r);
 const original=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts'),'utf8');
 const transformed=fs.readFileSync(own('f26a-install-diagnostics-08.host.ts'),'utf8');
 const review=read(own('diagnostic-transform-08.json'));let reversed=transformed;
 for(const r of [...review.changes].reverse()){assert.equal(reversed.split(r.after).length,2);reversed=reversed.replace(r.after,r.before);}assert.equal(reversed,original);
 const checks=text=>{const sf=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true),rows=[];function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='add')rows.push(n.getText(sf));ts.forEachChild(n,visit);}visit(sf);return rows;};
 assert.equal(checks(original).length,34);assert.deepEqual(checks(original),checks(transformed));
 const previous=read(own('native-driver-provenance-02.json'));
 for(const row of previous.drivers.filter(n=>!n.path.endsWith('/lite-precommit-guard-host.js'))){const match=p.drivers.find(n=>path.basename(n.path)===path.basename(row.path));assert(match);assert.equal(match.sha256,row.sha256);assert.equal(match.bytes,row.bytes);}
 for(const name of ['install-diagnostics-component-07','diagnostic-delegation-08','native-typecheck-08','native-build-07']){
  const r=read(own(name+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(C.sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());
 }
 return {status:'DIAGNOSTIC07_STATIC_ADMISSION_PASS_NOT_AUTHORIZED_NOT_RUN',sourceCount:1036,vsix:current.vsix.sha256,unchangedCallbacks:34,driver:p.freshPrecommitDriver,otherDrivers:24};
}
module.exports={...C,guard};if(require.main===module)guard().then(v=>console.log(JSON.stringify(v))).catch(e=>{console.error(e);process.exitCode=1;});
