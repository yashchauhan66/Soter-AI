const h=require('./f09-evidence-lib.cjs');const{path,read,own,hash,repo,fs,write,relative}=h;
const native='f09-native-host-20261015T125328Z-98fcf3b8',affected='affected-20261015T125430Z-ef6e0a01fc2d4cca8724d2f1d04c4d66';
const fact=name=>({path:name,sha256:hash(own(name))});
const summary=read(own(affected+'/affected-summary-01.json'));
const sourcePaths=['docs/soterai-lite/FEATURE-QUEUE.json','docs/soterai-lite/ledger.md','docs/vscode-extension-readiness.md',
 'packages/core/src/index.ts','packages/core/src/VaultAppDescriptor.ts','packages/soterai-lite/README.md','packages/soterai-lite/package.json',
 'packages/vscode-extension/README.md','packages/vscode-extension/package.json','packages/vscode-extension/src/extension.ts',
 'packages/vscode-extension/src/firewall/commands.ts','packages/vscode-extension/src/firewall/VaultManager.ts','packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts',
 ...['VaultAppJob.ts','RuntimeBinding.ts','VaultRuntime.ts','VaultSurfaces.ts','commands.ts'].map(name=>'packages/vscode-extension/src/vault-runtime/'+name),
 ...['vaultAppDescriptor.test.ts','vaultAppJob.test.ts','vaultAppJob.review.test.ts','vaultAppJob.short.test.ts','vaultRuntimeLease.test.ts','vaultRuntimeCoordinator.test.ts',
 'vaultRuntimeSurfaces.test.ts','vaultRuntimeSurfaces.review.test.ts','vaultRuntimeOwnership.review.test.ts','vaultRuntimePolicy.review.test.ts','host/liteVaultRuntime.host.ts'].map(name=>'packages/vscode-extension/src/__tests__/'+name),
 ...['acceptance-preflight-01.txt','acceptance-preflight-01.txt.result.json','f08-byte-verification-launch-01.txt','f08-byte-verification-launch-01.txt.result.json',
 'f08-transition-allowlist-01.txt','f08-transition-commit-01.txt','f08-transition-byte-verification-01.json','f08-transition-verification-launch-01.txt',
 'f08-transition-verification-launch-01.txt.result.json'].map(name=>'docs/soterai-lite/evidence/20261015-f08-output-b7429e10/'+name)];
for(const name of sourcePaths)if(!fs.statSync(path.join(repo,name)).isFile())throw new Error('Required scoped source missing.');
write('acceptance-bindings-01.json',{schemaVersion:1,feature:'F09',parentCommit:'583e4f79e8bbfd2c18a4bbe64c9fbd08d091f2cc',
 artifact:{path:'packages/soterai-lite/soterai-lite-0.7.0-f09-20261015-attempt01.vsix',sha256:'04157b046e5c01e111e5ef5830a4998c06085a85c14566af9bce5c9704c20bba'},
 inspection:fact('vsix-inspection-01.json'),checks:[{role:'typecheck',log:'typecheck-04.txt'},
 {role:'focused',log:'focused-after-05.txt',kind:'tap',expected:{tests:150,pass:150,fail:0,cancelled:0,skipped:0}},
 {role:'full',log:'full-tests-02.txt',kind:'tap',expected:{tests:1464,pass:1460,fail:0,cancelled:0,skipped:4}},
 {role:'metadata',log:'metadata-sync-02.txt'},{role:'readiness',log:'generate-readiness-02.txt'},
 {role:'package',log:'package-01.txt'},{role:'inspection',log:'vsix-inspection-01.txt'},{role:'hostBuild',log:'host-build-01.txt'},
 {role:'native',log:'native-host-launch-01.txt'},{role:'affected',log:'affected-verification-01.txt'}],
 native:{result:fact(native+'/runtime-results.json'),probe:fact('prebuilt-host-01/lite-vault-runtime-host.js')},
 affected:{summary:fact(affected+'/affected-summary-01.json'),comparison:fact(affected+'/security-comparison-01.json'),
 functional:fact(path.relative(__dirname,summary.functionalResult).replaceAll('\\','/')),security:fact(path.relative(__dirname,summary.securityResult).replaceAll('\\','/'))},
 reviews:['source-review-evidence-adversarial-03.md','final-source-disposition-01.md'].map(fact),reviewDisposition:'NO_OPEN_SCOPED_BLOCKERS',sourcePaths});
console.log('Prepared explicit final observed F09 bindings; acceptance and commit remain separate checks.');
