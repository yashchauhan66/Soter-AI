// Evidence authoring only: materialize a diagnostic successor, never launch it.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const home = __dirname, repo = path.resolve(home, '../../../..'), own = name => path.join(home, name);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const sourceFile = own('run-precommit-native-03.ps1'), sourceRaw = fs.readFileSync(sourceFile);
assert.equal(sha(sourceRaw), '755f80ee00b023f4b24da4d5a0079a2202d038698aa8fc923fbbca420520a0de');
const bootstrapFile = own('precommit-startup-bootstrap-04.cjs'), bootstrapRaw = fs.readFileSync(bootstrapFile), bootstrap = bootstrapRaw.toString('utf8');
new vm.Script(bootstrap, { filename: bootstrapFile }); // Parse only, never execute.
const bindingFile = own('native-current-binding-03.json'); assert.equal(fact(bindingFile).sha256, 'df37214d1c6af39677175f4cd8245d6cfa314488aed520110e73fa2f582bb612');
const freezeFile = own('native-host-freeze-02.json'); assert.equal(fact(freezeFile).sha256, '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a');
const original = sourceRaw.toString('utf8'), match = /\$taskBootstrap=@'\r?\n[\s\S]*?\r?\n'@\r?\n/g;
assert.equal([...original.matchAll(match)].length, 1);
let output = original.replace(match, () => "$taskBootstrap=@'\r\n" + bootstrap.replace(/\r?\n/g, '\r\n').replace(/\r\n$/, '') + "\r\n'@\r\n");
const anchor = "  if(Test-Path -LiteralPath $taskResult){Copy-F26ANew $taskResult (Join-Path $taskRun ($taskPhase+'-results.json'))}";
assert.equal(output.split(anchor).length, 2);
const collect = String.raw`
  # Diagnostic copies are restricted to this phase's public setup observer files.
  $taskSetupPrefix=[regex]::Escape($taskPhase+'-results.json')
  $taskSetupFiles=@(Get-ChildItem -LiteralPath $taskExecution -File|Where-Object{$_.Name -match ('^'+$taskSetupPrefix+'[.]setup-(child-[0-9]{2}(-stdout|-stderr)[.]bin|child-[0-9]{2}[.]json|observer-summary[.]json)$')})
  if($taskSetupFiles.Count -gt 16){throw 'Public setup diagnostic file count exceeded.'}
  foreach($taskSetupFile in $taskSetupFiles){
   $taskSetupCap=if($taskSetupFile.Name -match '-stdout[.]bin$'){4096}elseif($taskSetupFile.Name -match '-stderr[.]bin$'){8192}elseif($taskSetupFile.Name -match 'observer-summary[.]json$'){262144}else{65536}
   if($taskSetupFile.Length -gt $taskSetupCap){throw 'Public setup diagnostic bound exceeded.'}
   Copy-F26ANew $taskSetupFile.FullName (Join-Path $taskRun $taskSetupFile.Name)
  }
`;
output = output.replace(anchor, anchor + collect.replace(/\r?\n/g, '\r\n'));
for (const retained of ["$taskDriverExpected='899f01c8e699e613ac5d3fc2f8066e8997938e79ecc665dfe34af3e5c4e9090b'", 'prebuilt-native-hosts-03/lite-precommit-guard-host.js',
 'native-host-freeze-02.json', 'host-current-binding-02.ps1', 'precommit-offline-owner-03.cjs', 'expectedChecks=@{primary=30;restart=4}',
 'Elapsed.TotalSeconds -lt 300', 'RETAIN_PROCESS_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_LATER_PHASE', "'git.enabled'=$false", "'--disable-extension=vscode.git'"])
 assert(output.includes(retained), 'Inherited native contract disappeared: ' + retained);
for (const required of ['startupOnly = true', 'startupOnly = false', 'Reflect.apply(realSpawn, this, values)', "['stdout', 4096]", "['stderr', 8192]", 'await Promise.all(setupObservers)',
 'globalEnvironmentBeforeSha256', 'globalEnvironmentAfterSha256', 'changedEnvironmentKeyNames', 'beforeActivateEnvironmentSha256', 'ERROR_NAME_AND_STACK_FRAMES_ONLY_NO_ASSERTION_VALUES_OR_ENVIRONMENT_DUMP'])
 assert(bootstrap.includes(required));
const outputFile = own('run-precommit-native-04.ps1'), beforeFile = own('precommit-launcher04-inherited-run03.txt'), receiptFile = own('precommit-launcher04-custody.json');
for (const file of [outputFile, beforeFile, receiptFile]) assert(!fs.existsSync(file), 'Immutable output already exists: ' + file);
fs.writeFileSync(beforeFile, sourceRaw, { flag: 'wx' }); fs.writeFileSync(outputFile, output, { flag: 'wx' });
const receipt = { status: 'MATERIALIZED_PUBLIC_SETUP_DIAGNOSTIC_NOT_EXECUTED', time: new Date().toISOString(),
 launcher: fact(outputFile), bootstrapSource: fact(bootstrapFile), ancestor: fact(sourceFile), ancestorSnapshot: fact(beforeFile), binding: fact(bindingFile), semanticFreeze: fact(freezeFile),
 unchanged: { assertions: '30 primary +4 restart, same frozen driver03/source989/VSIX', driverSha256: '899f01c8e699e613ac5d3fc2f8066e8997938e79ecc665dfe34af3e5c4e9090b',
  vsixSha256: 'bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91', editorTimeoutSeconds: 300, sourceOrProductChanges: 0 },
 diagnostic: { installedBeforeDriverRequire: true, delegate: 'Exact real spawn receiver/arguments/env and returned child unchanged',
  publicAllowlist: ['version', 'init', 'config --local user.name', 'config --local user.email', 'config --local core.autocrlf'], maximumSetupJobs: 5,
  rawBytesPerJob: { stdout: 4096, stderr: 8192 }, captureAfterBeforeActivate: false, closeRequires: 'All observed children actualclose+bothEOF and bounded raw/row flush, no signals/cancel/pipe abort',
  environment: 'Baseline/per-job before/after SHA plus at most256 changed key NAMES; never environment values',
  failureStack: 'Only public beforeActivate failure: error name and at most32 stack frames/8192characters, no assertion values; ordinary case errors remain name-only' },
 validation: 'Embedded bootstrap parsed by vm.Script only. Root must PowerShell-parse the resulting launcher before execution. No helper/native/test/build/compiler/Git/source execution.',
 cause: 'Native03 public setup AssertionError remains unestablished; diagnostic instrumentation does not guess a product fix or regrade prior failure.', independence: 'LOW' };
fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(receipt));
