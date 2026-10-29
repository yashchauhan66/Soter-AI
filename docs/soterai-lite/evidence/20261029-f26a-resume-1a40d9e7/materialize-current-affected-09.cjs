'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./storage-current-admission-09.cjs'),{repo,own,read,fact,sha}=C;
const old=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402'),h29=path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a');
const put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});
(async()=>{
 const b=await C.guard(),scope=read(own('affected-scope-08.json')),original=read(path.join(old,'affected-materialization-01.json'));
 assert.equal(scope.families.length,20);assert.equal(scope.assertions,509);assert.equal(scope.phases,37);
 const names=new Set(scope.families.map(f=>f.helper));for(const n of ['affected-functional10-01.ps1','affected-security17-01.ps1','affected-functional-security-01.ps1','affected-preparation-pipe-ownership-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js'])names.add(n);
 const copied=[];
 for(const n of names){const from=path.join(n.startsWith('affected-functional')||n.startsWith('affected-security')?h29:old,n);assert(fs.existsSync(from),n);put(n,fs.readFileSync(from));copied.push({source:fact(from),target:fact(own(n))});}
 let binding=fs.readFileSync(path.join(old,'affected-native-binding-01.ps1'),'utf8');
 for(const [a,z]of [['native-binding-01.json','native-current-binding-09.json'],['current-native-guard-02.cjs','storage-current-admission-09.cjs'],['096f91da0249100960f54045edd56799fc2a124a4e84703cb586f69ef5d1e7ed',fact(own('native-current-binding-09.json')).sha256],['dcad267553684553f2364b794a2fbd47acaacd5cbbabba1e9d6892ad8af5a3af',fact(own('storage-current-admission-09.cjs')).sha256],['offline-inventory-01/','offline-inventory-09/']])binding=binding.replaceAll(a,z);
 const before='$taskF26cProvenance.drivers | ForEach-Object';assert.equal(binding.split(before).length,2);binding=binding.replace(before,"$taskF26cProvenance.drivers | Where-Object { [IO.Path]::GetFileName($_.path) -cne 'lite-precommit-guard-host.js' } | ForEach-Object");
 const extra=['affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js'].map(n=>fact(own(n)));
 const extraChecks=extra.map(r=>"    if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '"+path.basename(r.path)+"') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '"+r.sha256+"'){throw 'Retained actual affected driver bytes differ.'}").join('\n');
 const needle='    return (Get-Content -LiteralPath $taskF26cBindingPath';assert.equal(binding.split(needle).length,2);binding=binding.replace(needle,extraChecks+'\n'+needle);put('affected-native-binding-01.ps1',binding);
 const drivers=read(path.join(repo,b.driverProvenance.path)).drivers;
 const families=scope.families.map(f=>{const row=drivers.find(d=>path.basename(d.path)===f.driver);assert(row);const orig=original.families.find(o=>o.id===f.id);assert(orig);assert.equal(orig.assertions,f.assertions);assert.equal(orig.phases,f.phases);return {...f,driver:fact(own(row.path)),helper:fact(own(f.helper))};});
 const localRefs=[];for(const row of copied.filter(r=>r.target.path.endsWith('.ps1'))){const text=fs.readFileSync(path.join(repo,row.target.path),'utf8');for(const match of text.matchAll(/Join-Path \$PSScriptRoot '([^']+\.(?:ps1|cjs|js))'/g)){const name=match[1];assert(fs.existsSync(own(name)),row.target.path+' missing '+name);localRefs.push(name);}}
 const r={status:'CURRENT1037_ARTIFACT16B_BOUND_AFFECTED20_509_37_NOT_RUN',observedAt:new Date().toISOString(),sourceProof:b.sourceProof,vsix:b.vsix,bindingHelper:fact(own('affected-native-binding-01.ps1')),families,outputs:copied,transitiveHelperClosure:[...new Set(localRefs)].sort(),precommitExcluded:true,sourceChecksRemoved:0,independence:'LOW',native:'NOT_RUN',signalsRequested:0};
 put('affected-current-materialization-09.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({status:r.status,helpers:copied.length,families:20,assertions:509,phases:37,closure:r.transitiveHelperClosure}));
})().catch(e=>{console.error(e);process.exitCode=1;});
