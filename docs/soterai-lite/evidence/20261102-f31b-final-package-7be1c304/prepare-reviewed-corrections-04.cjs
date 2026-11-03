'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
let script=fs.readFileSync(own('apply-reviewed-corrections-03.cjs'),'utf8');
const old="const done=JSON.parse(fs.readFileSync(own('integrated-sharded-result-02.json'),'utf8'));assert.equal(done.status,'F31B_SHARDED_FULL_READINESS_PACKAGE_CLOSED_CONTENT_NATIVE_PENDING');";
assert(script.includes(old));script=script.replace(old,"const done=JSON.parse(fs.readFileSync(own('full-suite-acceptance-02.json'),'utf8'));assert.equal(done.counts.fail,0);assert.equal(done.counts.tests,4783);const closed=JSON.parse(fs.readFileSync(own('package-02-owned-close.json'),'utf8'));assert.equal(closed.exitCode,1);assert(closed.actualClose&&closed.stdoutEOF&&closed.stderrEOF);");
const additions=`
const litePath=file('packages/soterai-lite/package.json'),lite=JSON.parse(fs.readFileSync(litePath,'utf8'));
assert(Array.isArray(lite.files));for(const name of ['PRIVACY.md','SBOM.cdx.json','THIRD-PARTY-NOTICES.md']){assert(!lite.files.includes(name));lite.files.push(name);}
fs.writeFileSync(litePath,JSON.stringify(lite,null,2)+'\\n');
`;
script+=additions.replace("+'\\n'","+'\\n'");
// Append the real-manifest integration regression to the permanent component suite.
const check=fs.readFileSync(own('production-allowlist-review-01.test.cjs'),'utf8');
const start=check.indexOf("test('F31b actual production");assert(start>0);
let regression=check.slice(start).replace('F31b actual production files allowlist','B16 actual production files allowlist').replaceAll("path.join(repo,'packages/","path.join(repoActual,'packages/");
// Existing suite already defines crypto/fs/path and fixture.
script+="\nfs.appendFileSync(file('packages/soterai-lite/scripts/__tests__/release-package.test.cjs'),"+JSON.stringify('\n'+regression)+");\n";
fs.writeFileSync(own('apply-reviewed-corrections-04.cjs'),script,{flag:'wx'});
console.log('Prepared one bounded correction: XML/claims, production files allowlist and regression. All prior files retained.');
