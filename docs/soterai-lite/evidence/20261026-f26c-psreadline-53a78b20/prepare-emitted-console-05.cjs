const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);
let script=fs.readFileSync(own('probe-console-04.ps1'),'utf8').replaceAll('f26c-console-probe-v4','f26c-console-probe-v5').replaceAll('ACTUAL_GENERATED_HISTORY_CALLBACK_PUBLIC_READLINE_PERSISTENCE_COMPONENT_ONLY','ACTUAL_NATIVE_EMITTED_PROFILE_PUBLIC_READLINE_PERSISTENCE_SCOPE_ONLY');
fs.writeFileSync(own('probe-console-05.ps1'),script,{flag:'wx'});
let runner=fs.readFileSync(own('run-console-probe-04.cjs'),'utf8');
runner=runner.replaceAll('f26c-console-probe-v4','f26c-console-probe-v5').replaceAll('probe-console-04.ps1','probe-console-05.ps1');
for(const kind of ['console-probe-start','console-probe-timeout','console-probe-error','console-probe-close','console'])runner=runner.replaceAll(kind+'-04',kind+'-05');
const old="const binding=read('generated-text-inputs-01.json');for(const pin of [...binding.sources,binding.output]){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}fs.writeFileSync(path.join(profile,'generated-history.ps1'),fs.readFileSync(path.join(repo,binding.output.path)),{flag:'wx'});";
assert(runner.includes(old));runner=runner.replace(old,`const binding=read('native-emitted-profile-binding-05.json');assert.equal(binding.status,'BOUND_ACTUAL_NATIVE28_PASS_EMITTED_PROFILE_NOT_CONSOLE_TESTED');
for(const pin of [binding.nativeSummary,binding.emittedProfile,binding.sourceProof]){const raw=fs.readFileSync(path.join(repo,pin.path));assert.equal(raw.length,pin.bytes);assert.equal(sha(raw),pin.sha256);}
const summary=JSON.parse(fs.readFileSync(path.join(repo,binding.nativeSummary.path),'utf8'));assert.equal(summary.status,'PASS_SCOPED_NATIVE_OWNER_API_ONLY');assert.equal(summary.nativeChecks,28);assert.equal(summary.vsixSha256,'6857b94f8405489430dc832bb4b4fe838370b662d01bb61de6da4d02e0a565f3');
fs.writeFileSync(path.join(profile,'generated-history.ps1'),fs.readFileSync(path.join(repo,binding.emittedProfile.path)),{flag:'wx'});`);
const spawn="const child=cp.spawn(exe,args,{env,cwd:profile,windowsHide:true,shell:false,stdio:'inherit'});";assert(runner.includes(spawn));runner=runner.replace(spawn,"assert.equal(fs.statSync(exe).size,454656);assert.equal(sha(fs.readFileSync(exe)),'8e8b07b3e7de55252ecc09dd7082542b6592afba8410e640acb7cda965a4ba16');\n"+spawn);
fs.writeFileSync(own('run-console-probe-05.cjs'),runner,{flag:'wx'});console.log('Prepared emitted-profile console05; actual native28 PASS binding still required.');
