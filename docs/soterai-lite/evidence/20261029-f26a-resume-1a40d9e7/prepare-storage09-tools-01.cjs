const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),own=n=>path.join(__dirname,n);
const put=(n,s)=>{if(n.endsWith('.cjs'))new vm.Script(s);fs.writeFileSync(own(n),s,{flag:'wx'});};
let serial=fs.readFileSync(own('run-storage-fix-serial-08.cjs'),'utf8');
for(const[from,to]of [['full-inputs-08.json','full-inputs-09.json'],['storage-serial-start-08','storage-serial-start-09'],['storage-serial-result-08','storage-serial-result-09'],['storage-serial-failure-08','storage-serial-failure-09'],['compiler-08','compiler-09'],['full-tests-08','full-tests-09'],['readiness-08','readiness-09'],['package-08','package-09']])serial=serial.split(from).join(to);
const begin=serial.indexOf(" await step('backend-typecheck-08'"),end=serial.indexOf(" await step('full-tests-09'",begin);assert(begin>=0&&end>begin);
serial=serial.slice(0,begin)+` for(const name of ['backend-typecheck-08','backend-tests-08']){
  verify();const v=read(own(name+'-verification.json')),c=read(own(name+'-owned-close.json')),r=read(own(name+'.txt.result.json'));
  assert.equal(v.status,'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT');assert(v.actualClose&&v.wrapperExit===0&&v.innerExit===0&&v.stdoutEOF&&v.stderrEOF&&v.signalsRequested===0);
  assert(c.actualClose&&c.exitCode===0&&c.signal===null&&c.stdoutEOF&&c.stderrEOF&&!c.deadlineExceeded&&!c.overflow&&!c.streamError&&c.signalsRequested===0);assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());results.push(v);
 }
`+serial.slice(end);
serial=serial.replace("assert.equal(read(own('storage-uri-focused-01.txt.result.json')).exitCode,0);","assert.equal(read(own('storage-clock-focused-09.txt.result.json')).exitCode,0);assert.equal(read(own('storage-uri-focused-01.txt.result.json')).exitCode,0);");
put('run-storage-fix-serial-09.cjs',serial);
put('start-storage-fix-serial-09.ps1',fs.readFileSync(own('start-storage-fix-serial-08.ps1'),'utf8').replaceAll('-08','-09').replaceAll('Serial08','Serial09'));
put('run-storage-postfull-09.cjs',fs.readFileSync(own('run-storage-postfull-08.cjs'),'utf8').replaceAll('-08','-09').replaceAll('Serial08','Serial09').replaceAll('serial08','serial09'));
put('start-storage-postfull-09.ps1',fs.readFileSync(own('start-storage-postfull-08.ps1'),'utf8').replaceAll('-08','-09').replaceAll('postfull08','postfull09'));
const maps=[['full-inputs-08.json','full-inputs-09.json'],['storage-serial-result-08','storage-serial-result-09'],['storage-postfull-result-08','storage-postfull-result-09'],['compiler-08','compiler-09'],['full-tests-08','full-tests-09'],['readiness-08','readiness-09'],['package-08','package-09'],['content-08','content-09'],['native-build-08','native-build-09'],['content-inspection-08','content-inspection-09'],['offline-inventory-08','offline-inventory-09'],['vsix-extracted-08','vsix-extracted-09'],['prebuilt-native-hosts-08','prebuilt-native-hosts-09'],['native-driver-provenance-08','native-driver-provenance-09'],['native-current-binding-08','native-current-binding-09'],['storage-current-admission-08','storage-current-admission-09'],['FRESH1037_FULL08_COMPILER08_BUILD08_ATTEMPT02_BOUND_NATIVE_NOT_RUN','FRESH1037_FULL09_COMPILER09_BUILD09_ATTEMPT02_BOUND_NATIVE_NOT_RUN'],['849789bcba21bb5a75da7c497963ff7f35dff46ded63344cd10cfb77f9fccb1d','f3ca94a5d02afef843bc0020b18b95b8d9129b4cf7d31ead7c87af019dd10e52'],['proof.changedSource.length,2','proof.changedSource.length,3']];
for(const[fromName,toName]of [['run-content-08.cjs','run-content-09.cjs'],['build-storage-native-drivers-08.cjs','build-storage-native-drivers-09.cjs'],['storage-current-admission-08.cjs','storage-current-admission-09.cjs'],['prepare-storage-native08-packet-01.cjs','prepare-storage-native08-packet-02.cjs']]){
 let s=fs.readFileSync(own(fromName),'utf8');for(const[from,to]of maps)s=s.split(from).join(to);
 if(fromName==='storage-current-admission-08.cjs')s=s.replace("'native07-syntax-01']","'native07-syntax-01','storage-clock-focused-09']");
 if(fromName==='prepare-storage-native08-packet-01.cjs')s=s.replace('productionDelta:2','productionSourcePaths:1,testSourcePaths:2,ownedSourceDelta:3');
 put(toName,s);
}
console.log('Successor09 tools preserve08 failures; only F29 test-clock delta, backend08 reused after exact source-delta/closed-receipt checks. No native08 launch.');
