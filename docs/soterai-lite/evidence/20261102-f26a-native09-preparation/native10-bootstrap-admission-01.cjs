'use strict';
// Static identity admission only. No vscode import, profile, child or listener.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),C=require('./native09-current-admission-01.cjs');
const {own,repo,read,sha,fact}=C;
function inspect(){
 const b=read(own('native09-current-binding-01.json'));C.pin(b.hostReview);const review=read(path.resolve(repo,b.hostReview.path));
 const appRoot=path.dirname(review.currentHost.applicationFiles.find(x=>path.basename(x.path)==='package.json').path),candidate=fs.readFileSync(own('native10-current-candidate-01.ps1.txt'),'utf8');
 const root=/const jsonBuiltinAppRoot = ("[^\r\n]+");/.exec(candidate);assert(root);assert.equal(JSON.parse(root[1]),appRoot);
 const pins=/const jsonBuiltinPins = (\[[\s\S]*?\]);/.exec(candidate);assert(pins);assert.deepEqual(JSON.parse(pins[1]),review.jsonBuiltinPins);assert.equal(review.jsonBuiltinPins.length,4);
 const facts=[];for(const row of review.jsonBuiltinPins){const absolute=path.join(appRoot,'extensions/json-language-features',row.relative);C.pin({...row,path:absolute});facts.push({path:absolute,bytes:row.bytes,sha256:row.sha256});}
 return {status:'PASS_CURRENT_JSON_BOOTSTRAP_ROOT_AND_FOUR_ALREADY_REVIEWED_PINS',appRoot,jsonPins:facts,candidate:fact(own('native10-current-candidate-01.ps1.txt')),nativeLaunches:0,signalsRequested:0};
}
module.exports={inspect};if(require.main===module)try{console.log(JSON.stringify(inspect()));}catch(e){console.error(e);process.exitCode=1;}
