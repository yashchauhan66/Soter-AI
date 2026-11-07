'use strict';
// Preparation only. Never launches Code, Git, child processes or tests.
// Usage: node prepare-native14.cjs <exact-vsix> <exact-extraction/extension> <source-input-inventory.json>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../..');
const prior = path.join(repo, 'docs/soterai-lite/evidence/20261102-f26a-native09-preparation');
const f32 = path.join(repo, 'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const fact = file => { const raw = fs.readFileSync(file); return { path: path.resolve(file), bytes: raw.length, sha256: sha(raw) }; };
const pin = row => { const current = fact(row.path); assert.equal(current.bytes, row.bytes, row.path); assert.equal(current.sha256, row.sha256, row.path); };
const inside = file => { const relative = path.relative(repo, file); assert(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)); };
const ps = text => "'" + text.replaceAll("'", "''") + "'";
function replaceOne(body, before, after) { assert.equal(body.split(before).length, 2, 'One exact substitution required: ' + before.slice(0, 80)); return body.replace(before, after); }
function save(name, value) { const file = path.join(__dirname, name); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return fact(file); }
assert.equal(process.argv.length, 5, 'Supply exact VSIX, extraction and verified current source inventory.');
const vsix = path.resolve(process.argv[2]), extraction = path.resolve(process.argv[3]), inventoryFile = path.resolve(process.argv[4]);
for (const file of [vsix, extraction, inventoryFile]) inside(file);
const vendorFile = path.join(f32, 'public-vendor-observation-04.json');
const vendor = read(vendorFile);
assert.equal(vendor.currentHost.version, '1.145.1');
assert.equal(vendor.currentHost.commit, '6bab64e2d12b04d04c0d99c27ff166023efd1dda');
assert.equal(vendor.twoStableObservations, true);
for (const row of vendor.vendorFacts) pin(row);
const signaturesFile = path.join(f32, 'current-signature-observation-04.json'), signatures = read(signaturesFile);
assert.equal(signatures.vendorReceiptSha256, fact(vendorFile).sha256);
for (const row of signatures.rows) { assert.equal(row.status, 'Valid'); pin({ ...fact(row.path), sha256: row.sha256 }); }
const inventory = read(inventoryFile);
assert(Array.isArray(inventory.files) && inventory.files.length > 1000, 'Complete current source inventory required.');
const sourceFiles = inventory.files.map(row => ({ ...row, path: path.resolve(repo, row.path) }));
for (const row of sourceFiles) { inside(row.path); pin(row); }
const semanticFile = path.join(prior, 'original-native34-freeze-01.json'), semantic = read(semanticFile);
assert.equal(semantic.primary.length, 30); assert.equal(semantic.restart.length, 4);
assert.equal(semantic.sha256, 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741');
pin({ path: path.resolve(repo, semantic.file), bytes: semantic.bytes, sha256: semantic.sha256 });
const driverFile = path.join(prior, 'supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js');
const driver = fact(driverFile);
assert.equal(driver.sha256, '8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced');
const manifestFile = path.join(extraction, 'package.json'), manifest = read(manifestFile);
assert.equal(manifest.publisher, 'soterai'); assert.equal(manifest.name, 'soterai-ide-guard'); assert.equal(manifest.main, './dist/extension.js');
assert.equal(manifest.soteraiLiteRelease?.schemaVersion, 1);
assert.equal(manifest.soteraiLiteRelease?.channel, 'pre-release');
assert(Array.isArray(manifest.soteraiLiteRelease?.unsupportedFeatures));
assert(!manifest.soteraiLiteRelease.unsupportedFeatures.includes('preCommit'), 'Candidate must legitimately admit actual pre-commit commands; test-context bypass is forbidden.');
const runtimeFiles = ['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'].map(name => ({ name, ...fact(path.join(extraction, 'dist', name)) }));
const bundle = runtimeFiles[0], worker = runtimeFiles[3], code = vendor.currentHost.executable;
const git = fact('C:/Program Files/Git/cmd/git.exe');
assert.equal(git.sha256, 'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');
const jsonRoot = path.join(vendor.currentHost.appRoot, 'extensions/json-language-features');
const jsonPins = ['package.json', 'client/dist/node/jsonClientMain.js', 'server/package.json', 'server/dist/node/jsonServerMain.js'].map(relative => ({ relative, ...fact(path.join(jsonRoot, relative)) }));
const jsonManifest = read(path.join(jsonRoot, 'package.json'));
assert.equal(jsonManifest.publisher, 'vscode'); assert.equal(jsonManifest.name, 'json-language-features'); assert.equal(jsonManifest.main, './client/dist/node/jsonClientMain');
let offline = fs.readFileSync(path.join(prior, 'native09-offline-owner-01.cjs'), 'utf8');
offline = replaceOne(offline, "const CODE_SHA = '9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb';", 'const CODE_SHA = ' + JSON.stringify(code.sha256) + ';');
offline = replaceOne(offline, "const WORKER = '36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb';", 'const WORKER = ' + JSON.stringify(worker.sha256) + ';');
const offlineFact = save('native14-offline-owner.cjs', offline);
const originalLauncherFile = path.join(prior, 'run-precommit-native12-current-01.ps1');
const originalLauncher = fs.readFileSync(originalLauncherFile, 'utf8').replaceAll('\r\n', '\n');
let prefix = originalLauncher.slice(0, originalLauncher.indexOf('# UNBOUND text-only'));
for (const [before, after] of [
 ["$taskExpectedVsix='5dac9288fb259ad538ab751258f250d85a933bfb5bc8641dc32e54c01f6f047f'", '$taskExpectedVsix=' + ps(fact(vsix).sha256)],
 ["$taskExpected='3524f4f234004d81924854c756330a5d1273e0251c524d1a31fa63c3b3c784b2'", '$taskExpected=' + ps(bundle.sha256)],
 ["$taskWorkerExpected='36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb'", '$taskWorkerExpected=' + ps(worker.sha256)],
 ["$taskCodeExpected='9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb'", '$taskCodeExpected=' + ps(code.sha256)],
 ["$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))", '$taskRepo=' + ps(repo)],
 ["$taskOfflineHelper=Join-Path $PSScriptRoot 'native09-offline-owner-01.cjs'", "$taskOfflineHelper=Join-Path $PSScriptRoot 'native14-offline-owner.cjs'"]
]) prefix = replaceOne(prefix, before, after);
const admission = {
 schemaVersion: 1, status: 'PREPARED_EXACT_F26A_NATIVE34_CURRENT_HOST_NOT_RUN', observedAt: new Date().toISOString(),
 userAuthorization: '6 November request completes F26a and explicitly approves isolated local Code/tests; historical skips superseded.',
 nativeChecks: { primary: 30, restart: 4 }, vsix: fact(vsix), extraction, manifest: fact(manifestFile), runtimeFiles,
 code, git, driver, semantic: fact(semanticFile), sourceInventory: fact(inventoryFile), sourceFiles,
 vendorReceipt: fact(vendorFile), signatures: fact(signaturesFile), vendorFiles: vendor.vendorFacts,
 jsonBuiltin: { version: jsonManifest.version, appRoot: vendor.currentHost.appRoot, files: jsonPins },
 predecessor: fact(originalLauncherFile), offlinePredecessor: fact(path.join(prior, 'native09-offline-owner-01.cjs')), offline: offlineFact,
 retainedFailures: ['native11 primary30 passed; restart HR02 failed exact D:/d: receipt comparison', 'native12 renderer restarted extension host; bootstrap reactivation failed EEXIST; trigger not established'],
 limitations: ['Developer bootstrap with exact four packaged runtimes', 'Scripted native API decisions, LOW independence', 'No human usability or other-platform acceptance']
};
const admissionFact = save('native14-admission.json', admission);
prefix += `
# Current task authorization replaces the historical per-attempt skip/approval gate.
# This file is inert until invoked; source/vendor/runtime hash checks precede native writes.
$taskAdmissionFile=Join-Path $PSScriptRoot 'native14-admission.json'
Assert-F26AFile $taskAdmissionFile ${ps(admissionFact.sha256)} ${admissionFact.bytes}
$taskAdmission=Get-Content -LiteralPath $taskAdmissionFile -Raw -Encoding UTF8|ConvertFrom-Json
if($ExpectedVsixSha256 -cne $taskExpectedVsix -or $ExpectedBundleSha256 -cne $taskExpected){throw 'Exact prepared artifact hashes required.'}
if($taskVsix -ine $taskAdmission.vsix.path -or $taskSource -ine $taskAdmission.extraction -or $taskHost -ine $taskAdmission.driver.path -or [IO.Path]::GetFullPath($CodePath) -ine $taskAdmission.code.path){throw 'Exact prepared paths required.'}
foreach($taskInput in @($taskSource,$taskHost,$taskVsix)){Assert-F26AOrdinary $taskInput}
$taskSemanticFreeze=Get-Content -LiteralPath $taskAdmission.semantic.path -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskSemanticFreeze.primary).Count -ne 30 -or @($taskSemanticFreeze.restart).Count -ne 4){throw 'Original30+4 required.'}
function Assert-F26AEditorHost {
 Assert-F26AFile $taskAdmissionFile ${ps(admissionFact.sha256)} ${admissionFact.bytes}
 foreach($taskRow in @($taskAdmission.vendorReceipt,$taskAdmission.signatures,$taskAdmission.code,$taskAdmission.git)+$taskAdmission.vendorFiles+$taskAdmission.jsonBuiltin.files){Assert-F26AFile $taskRow.path $taskRow.sha256 $taskRow.bytes}
}
function Assert-F15bRuntimeBinding {
 param([string]$VsixPath,[string]$ExpectedVsixSha256,[string]$ExtensionRoot,[string]$ExpectedBundleSha256)
 Assert-F26AFile $VsixPath $taskAdmission.vsix.sha256 $taskAdmission.vsix.bytes
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $taskArchive=[IO.Compression.ZipFile]::OpenRead($VsixPath)
 try{foreach($taskEntryName in @('package.json','dist/extension.js','dist/local-ai-broker.js','dist/soterai-mcp-server.js','dist/pre-commit-client.js')){
  $taskEntries=@($taskArchive.Entries|Where-Object{$_.FullName -ceq ('extension/'+$taskEntryName)})
  if($taskEntries.Count -ne 1 -or $taskEntries[0].Length -gt 8388608){throw 'Unique bounded package entry required.'}
  $taskReader=$taskEntries[0].Open();$taskAlgorithm=[Security.Cryptography.SHA256]::Create()
  try{$taskEntryHash=([BitConverter]::ToString($taskAlgorithm.ComputeHash($taskReader))).Replace('-','').ToLowerInvariant()}finally{$taskReader.Dispose();$taskAlgorithm.Dispose()}
  Assert-F26AFile (Join-Path $ExtensionRoot $taskEntryName) $taskEntryHash $taskEntries[0].Length
  if($taskEntryName -ceq 'dist/extension.js' -and $taskEntryHash -cne $ExpectedBundleSha256){throw 'Exact bundle required.'}
 }}finally{$taskArchive.Dispose()}
 Assert-F26AFile $VsixPath $taskAdmission.vsix.sha256 $taskAdmission.vsix.bytes
}
function Assert-F26ANative04Binding {
 foreach($taskRow in @($taskAdmission.sourceInventory,$taskAdmission.driver,$taskAdmission.semantic,$taskAdmission.offline)+$taskAdmission.sourceFiles){Assert-F26AFile $taskRow.path $taskRow.sha256 $taskRow.bytes}
 Assert-F26AFile (Join-Path $taskRepo $taskSemanticFreeze.file) $taskSemanticFreeze.sha256 $taskSemanticFreeze.bytes
}
Assert-F26AEditorHost
Assert-F26ANative04Binding
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
$taskOfflineExpected=Get-F26ASha $taskOfflineHelper;$taskLauncherExpected=Get-F26ASha $PSCommandPath
`;
let body = originalLauncher.slice(originalLauncher.indexOf("$taskName='f26a-precommit-native-'"));
const oldBindingStart = body.indexOf('function Assert-F26ANative04Binding {');
const oldBindingEnd = body.indexOf('function Assert-F26ANativeRuntimes {', oldBindingStart);
assert(oldBindingStart > 0 && oldBindingEnd > oldBindingStart);
body = body.slice(0, oldBindingStart) + body.slice(oldBindingEnd);
body = body.replaceAll("$Observed.hostVersion -cne '1.144.0'", "$Observed.hostVersion -cne '1.145.1'");
const jsonStart = body.indexOf('const jsonBuiltinPins = [');
const jsonEnd = body.indexOf('async function joinPinnedJsonBuiltin()', jsonStart);
assert(jsonStart > 0 && jsonEnd > jsonStart);
body = body.slice(0, jsonStart) + 'const jsonBuiltinPins = ' + JSON.stringify(jsonPins.map(({relative,bytes,sha256})=>({relative,bytes,sha256})), null, 2) + ';\nconst jsonBuiltinAppRoot = ' + JSON.stringify(vendor.currentHost.appRoot) + ';\n' + body.slice(jsonEnd);
body = body.replaceAll("extension.packageJSON?.version !== '10.0.0'", 'extension.packageJSON?.version !== ' + JSON.stringify(jsonManifest.version));
// Add bounded metadata-only progress diagnosis. No changed test assertion, delay, decision or deadline.
body = replaceOne(body, "setTimeout(async () => { try { await startup('driver-run-start'); await driver.run(context); await startup('driver-run-end'); }\n        catch (error) { await startup('driver-error'); await failure('run', error); } finally { await close(); } }, 1500);",
 "setTimeout(async () => { const pulse = setInterval(() => { const state = diagnostic(); void fs.appendFile(evidence + '.progress.jsonl', JSON.stringify({ phase, at: new Date().toISOString(), state }) + '\\n').catch(() => {}); }, 5000); try { await startup('driver-run-start'); await driver.run(context); await startup('driver-run-end'); }\n        catch (error) { await startup('driver-error'); await failure('run', error); } finally { clearInterval(pulse); await close(); } }, 1500);");
body = body.replaceAll("@('.driver-error.json','.startup.jsonl')", "@('.driver-error.json','.startup.jsonl','.progress.jsonl')");
const runner = save('run-precommit-native14.ps1', prefix + body);
save('native14-preparation.json', { status: 'PREPARED_NOT_RUN', observedAt: new Date().toISOString(), admission: admissionFact, runner, originalChecksPreserved: 34, originalDriver: driver, offline: offlineFact, nativeLaunches: 0 });
console.log(JSON.stringify({ status: 'PREPARED_NOT_RUN', runner, admission: admissionFact, nativeChecks: 34, nativeLaunches: 0 }));
