const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\uFEFF/,''));
assert.deepEqual(read('expired-run-reconciliation-01.json').matches,[]);assert.equal(read('typecheck-06.txt.result.json').exitCode,0);assert.ok(!fs.existsSync(path.join(__dirname,'full-tests-03.txt.result.json')));
let text=fs.readFileSync(path.join(__dirname,'run-final-local-04.ps1'),'utf8').replaceAll("'full-tests-03'","'full-tests-04'");text=text.split(/\r?\n/).filter(line=>!line.startsWith("Invoke-F14 'typecheck-06'")).join('\n');
fs.writeFileSync(path.join(__dirname,'run-final-local-05.ps1'),text,{flag:'wx'});
for(const name of ['create-final-bindings-01.cjs','record-source-review-02.cjs']){const f=path.join(__dirname,name);fs.writeFileSync(f,fs.readFileSync(f,'utf8').replaceAll('full-tests-03','full-tests-04'));}
console.log('Expired run not graded; fresh full04 before unused package02/inspection02/build02. No process signals or output overwrite.');
