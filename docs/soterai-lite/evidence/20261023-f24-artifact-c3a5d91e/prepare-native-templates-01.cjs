'use strict';
// Preparation only: reads pinned prior fixtures and writes NEW unbound templates.
// This helper never imports/evaluates generated code or invokes a child, compiler,
// build, Git, editor, network, signal, deletion or an existing evidence mutation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const prior = path.join(repo, 'docs/soterai-lite/evidence/20261023-f23-history-62d09fb1');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pinned = [
  ['host-current-binding-06.ps1', 1433, 'd8abea6084ba211fbb93e23e22bac53d41781abc323a96e49699a143217cb4e4'],
  ['artifact-binding-01.ps1', 3399, 'e79e04be28599cc739c174bbc234c6525f8864e367ef390ff04aae84673c26b0'],
  ['inspect-vsix-01.ps1', 25664, 'e4b8df67d4df4f17c0bb8abd36b4d0390c7006baf876581f8d1874d6de63722a'],
  ['run-history-native-02.ps1', 18032, '47225712c595d6f20daf090e9f1413eb993aa37c7740426fd3f8751bbc62f0c9'],
  ['run-mcp-native-03.ps1', 18028, 'ba70da3b43475e5e5ec2f0284f8f9090d27a1c221d125865a5374886d24a7834'],
  ['run-affected-editor-03.ps1', 18033, 'eef95e51be07066081486c068e8660e4764c969ec8654b6a3edf9280bcbcfebf'],
  ['run-affected-ci-03.ps1', 18021, 'd4114273f7a9de71616f8fe35d2083f085651e97b5c0b1eb47cc7cf3a64cb7c3'],
  ['run-affected-service-account-03.ps1', 18060, '99921c6ce6335ce19b0c09d501c62b4fa6d115a21bf73eaee06f4e2e990242be'],
  ['run-affected-registry-03.ps1', 18039, '7c8aed256a7d1622ab1c0be8b3cd63068604db907d5c92fbf666a19becf2cf3d'],
  ['run-affected-terraform-03.ps1', 18042, 'c21bc673774d4a35203331836f7e405d568259be31639273ba26c3bc33e9be50'],
  ['run-affected-container-03.ps1', 18042, 'b2880c3455f68279d0e7ed2cc4ca763c822637bee3d252acdc7668394758c0b2'],
  ['run-affected-source-03.ps1', 18044, 'bd620440430e92c25d993d9481882540abbeb5814960412653287524d2ae6e97'],
  ['run-affected-hygiene-03.ps1', 18045, '4c120c5e684e1d011b7f05facd74f452a1d557f80bfa6140777761798ccd75f9'],
  ['run-affected-vault-03.ps1', 18069, 'f908f735aa0ee9b8ffb7fa59aa753e11153080d49d14193575fcfa597c7587e9'],
  ['run-retained-native-03.ps1', 18083, 'fa5a5cda0f0ebcda9c7a4f0d44f303618f5e2d09264b03ab35bd15ea0087d36b'],
  ['run-affected-hosts-05.ps1', 9115, '4736dc4324df4d9227c21df5faf21264800b4c5ff3d1f6ff48ca7a979879783b'],
  ['run-functional-05.ps1', 8832, 'e32083e4eb1a285e5e27fc3a94b9778c0bbc5d019bec534c69a3e263175cbc7c'],
  ['run-security-05.ps1', 9818, 'd2e2b3914a6a1aed8918c6812103aa028376952c5d84f622b5ca29ebcee4572c'],
  ['run-current-affected-suite-04.ps1', 4182, '7afdb5b56da07197f068442eca5351e06ea63b1239588ad0ea29670d63dc5a0d'],
  ['build-native-hosts-03.cjs', 3185, '61c18a96420b3410a901f0c0e168ee81d4803767ca86b1d121ff9430a35d7988'],
];
const names = new Map([
  ['host-current-binding-06.ps1', 'host-current-binding-01.ps1'],
  ['artifact-binding-01.ps1', 'artifact-binding-01.ps1'], ['inspect-vsix-01.ps1', 'inspect-vsix-01.ps1'],
  ['run-history-native-02.ps1', 'run-affected-history-01.ps1'], ['run-mcp-native-03.ps1', 'run-mcp-native-01.ps1'],
  ...['editor', 'ci', 'service-account', 'registry', 'terraform', 'container', 'source', 'hygiene', 'vault']
    .map(family => [`run-affected-${family}-03.ps1`, `run-affected-${family}-01.ps1`]),
  ['run-retained-native-03.ps1', 'run-retained-native-01.ps1'], ['run-affected-hosts-05.ps1', 'run-affected-hosts-01.ps1'],
  ['run-functional-05.ps1', 'run-functional-01.ps1'], ['run-security-05.ps1', 'run-security-01.ps1'],
  ['run-current-affected-suite-04.ps1', 'run-current-affected-suite-01.ps1'], ['build-native-hosts-03.cjs', 'build-native-hosts-01.cjs'],
]);
const source = new Map();
for (const [name, bytes, expected] of pinned) {
  const raw = fs.readFileSync(path.join(prior, name));
  assert.equal(raw.length, bytes, `Prior template byte count changed: ${name}`);
  assert.equal(sha(raw), expected, `Prior template hash changed: ${name}`);
  source.set(name, raw);
}
const artifactHost = 'packages/vscode-extension/src/__tests__/host/liteArtifactScanner.host.ts';
const artifactHostBytes = fs.readFileSync(path.join(repo, artifactHost));
assert.equal(artifactHostBytes.length, 33147, 'Frozen artifact host byte count changed');
assert.equal(sha(artifactHostBytes), '35862d5e4d9227502a59196a5b582eec3ea7b157860962bb8bf3b7690cd8a61e', 'Frozen artifact host changed');

function replace(text, before, after, count = 1) {
  assert.equal(text.split(before).length - 1, count, `Template marker count differs: ${before}`);
  return text.replaceAll(before, after);
}
function common(text) {
  for (const [before, after] of names) text = text.replaceAll(before, after);
  return text.replaceAll('F23', 'F24').replaceAll('f23', 'f24')
    .replaceAll('source-inputs-03.json', '__F24_SOURCE_INPUTS_JSON__')
    .replaceAll('host-version-review-02.json', '__F24_HOST_VERSION_REVIEW_JSON__')
    .replaceAll('prebuilt-native-hosts-03', '__F24_NATIVE_HOST_OUTPUT_DIR__')
    .replaceAll('prebuilt-native-hosts-02', '__F24_NATIVE_HOST_OUTPUT_DIR__')
    .replaceAll('native-driver-provenance-03.json', '__F24_NATIVE_DRIVER_PROVENANCE_JSON__')
    .replaceAll('vsix-extracted-01/extension', '__F24_EXTRACTED_EXTENSION_RELATIVE__')
    .replaceAll("C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe", '__F24_EDITOR_EXECUTABLE__');
}
const psBlock = "if('__F24_TEMPLATE_BOUND__' -cne 'F24_CURRENT_FACTS_BOUND'){throw 'F24 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}";
function blocked(text, extension) {
  if (extension === '.cjs') return "if ('__F24_TEMPLATE_BOUND__' !== 'F24_CURRENT_FACTS_BOUND') throw Error('F24 template is PREPARED_NOT_BOUND; materialize a current owned copy before execution');\n" + text;
  const errorPreference = /\$ErrorActionPreference\s*=\s*'Stop'/;
  if (errorPreference.test(text)) return text.replace(errorPreference, matched => matched + '\n' + psBlock);
  return psBlock + '\n' + text;
}
function noSignals(text) {
  assert(!/Stop-Process|taskkill|(?:\.kill|\.Kill|process\.kill)\s*\(|TerminateProcess|WaitForExit\s*\(\s*-1\s*\)/.test(text), 'Generated fixture introduced termination or indefinite wait');
}
function inherited(before, after, name) {
  noSignals(after);
  // Existing safety gates and finite waits must survive every label/path edit.
  for (const witness of ["UseShellExecute", 'EnvironmentVariables.Clear()', 'CreateNoWindow', 'WindowStyle', 'RedirectStandardOutput',
    'RedirectStandardError', 'WaitForExit', 'stdoutEOF', 'stderrEOF', 'signalsRequested=0', 'INCOMPLETE', 'CreateNew', 'NoClobber',
    'Assert-F15bRuntimeBinding', 'ExpectedVsixSha256', 'ExpectedBundleSha256']) {
    if (before.includes(witness)) assert(after.includes(witness), `Inherited safety witness lost in ${name}: ${witness}`);
  }
  const counts = value => [...value.matchAll(/WaitForExit\(\d+\)|Elapsed\.TotalSeconds -lt \d+|ElapsedMilliseconds -lt \d+/g)].map(match => match[0]);
  assert.deepEqual(counts(after), counts(before), `Finite timing controls changed in ${name}`);
}
const outputs = new Map(), transformed = [];
function add(name, text, input) {
  assert(!outputs.has(name), `Duplicate new template ${name}`);
  noSignals(text); outputs.set(name, Buffer.from(text));
  transformed.push({ template: name, materializeAs: name.replace(/\.template(?=\.(?:ps1|cjs)$)/, ''), source: input ?? null,
    bytes: Buffer.byteLength(text), sha256: sha(text), placeholders: [...new Set(text.match(/__F24_[A-Z0-9_]+__/g) ?? [])].sort() });
}
for (const [old, raw] of source) {
  const original = raw.toString('utf8'); let text = common(original);
  if (old === 'host-current-binding-06.ps1') {
    text = replace(text, "'1.143.1'", "'__F24_EDITOR_VERSION__'");
    text = replace(text, 'function Assert-F24EditorHost {', `function Assert-F24EditorHost {
 $taskFullGate=Join-Path $PSScriptRoot '__F24_FULL_GATE_RESULT_JSON__'
 if((Get-FileHash -LiteralPath $taskFullGate -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__F24_FULL_GATE_RESULT_SHA256__'){throw 'Current full gate receipt bytes changed or remain unbound.'}
 $taskFullGateResult=Get-Content -LiteralPath $taskFullGate -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskFullGateResult.exitCode -ne 0){throw 'Current full gate did not pass; no native launch.'}
 $taskFullRaw=Join-Path $taskFrozenRepo '__F24_FULL_GATE_RAW_RELATIVE__'
 if((Get-FileHash -LiteralPath $taskFullRaw -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskFullGateResult.sha256.ToLowerInvariant()){throw 'Current full gate raw bytes do not match the checked exit receipt.'}`);
    // Resolve the repository before using it in the additional full-gate guard.
    text = text.replace('function Assert-F24EditorHost {\n', "function Assert-F24EditorHost {\n $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))\n");
  }
  if (old === 'inspect-vsix-01.ps1') {
    text = replace(text, "$taskFlag=$taskProperties.'soterai.lite.historyScanner'", "$taskFlag=$taskProperties.'soterai.lite.artifactScanner'");
    text = replace(text, 'Count -ne 79', 'Count -ne 80'); text = replace(text, 'requires 79 machine', 'requires 80 machine');
    text = replace(text, "Where-Object{$_ -ceq 'soterai.lite.historyScanner'}", "Where-Object{$_ -ceq 'soterai.lite.artifactScanner'}");
    text = replace(text, "runtimeFlag='soterai.lite.historyScanner'", "runtimeFlag='soterai.lite.artifactScanner'");
    const commands = "@('soterai.reviewGitHistory','soterai.historyScannerStatus',";
    text = replace(text, commands, "@('soterai.reviewArtifacts','soterai.artifactScannerStatus','soterai.reviewGitHistory','soterai.historyScannerStatus',", 3);
    const marker = " foreach($taskCommand in @('soterai.reviewArtifacts'";
    assert(text.includes(marker));
    const historyFlag = ` $taskHistoryFlag=$taskProperties.'soterai.lite.historyScanner'
 if($taskHistoryFlag.type -cne 'boolean' -or $taskHistoryFlag.default -ne $true -or $taskHistoryFlag.scope -cne 'machine' -or @($Manifest.capabilities.untrustedWorkspaces.restrictedConfigurations|Where-Object{$_ -ceq 'soterai.lite.historyScanner'}).Count -ne 1){throw 'Existing restricted machine history setting must remain present.'}
`;
    text = text.replace(marker, historyFlag + marker);
    assert.equal((text.match(/soterai\.reviewArtifacts/g) ?? []).length, 3);
    assert.equal((text.match(/soterai\.artifactScannerStatus/g) ?? []).length, 3);
    assert(text.includes('Count -ne 80') && text.includes("runtimeFlag='soterai.lite.artifactScanner'"));
  }
  if (old === 'build-native-hosts-03.cjs') {
    text = replace(text, "entryPoints:{'lite-history-host':", "entryPoints:{'lite-artifact-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteArtifactScanner.host.ts'),'lite-history-host':");
    assert(text.includes('parserBundleOptions') && text.includes('/lib/umd/') && text.includes('lib/esm/main.js'));
  }
  if (old === 'run-current-affected-suite-04.ps1') {
    text = replace(text, '$taskRows=@(', "$taskRows=@(\n @{name='affected-history-run-01';helper='run-affected-history-01.ps1';driver='lite-history-host.js'},");
    text = replace(text, 'affectedMCP25/Editor25', 'affectedHistory25/MCP25/Editor25');
    assert(text.includes('lite-history-host.js') && text.includes('lite-mcp-host.js') && text.includes('lite-broker-host.js'));
  }
  if (old === 'run-affected-hosts-05.ps1') {
    const marker = "    $taskSecurityRoot=Join-Path $taskRunRoot 'security'";
    text = replace(text, marker, `    foreach($taskPublicationId in @('H09','H10')){
        $taskPublicationObservation=@($taskFunctional.observations|Where-Object{$_.id -ceq $taskPublicationId})
        if($taskPublicationObservation.Count -ne 1 -or $taskPublicationObservation[0].status -cne 'PASS'){throw 'Actual functional publication H09/H10 checks are required.'}
    }
${marker}`);
  }
  inherited(original, text, old);
  const target = names.get(old); assert(target); const extension = path.extname(target);
  add(target.slice(0, -extension.length) + '.template' + extension, blocked(text, extension), old);
}
// The main artifact host owns all payload creation. The inherited bootstrap only
// allocates isolated profile/workspace paths and delegates the unchanged runtime.
let artifact = common(source.get('run-history-native-02.ps1').toString('utf8'));
artifact = replace(artifact, 'f24-history-native-', 'f24-artifact-native-');
const markerLine = "[IO.File]::WriteAllText((Join-Path $taskWorkspace '.synthetic-lite-f16-host'),'synthetic-only-v1')";
artifact = replace(artifact, markerLine, '# Artifact payload seeding is exclusively owned by liteArtifactScanner.host.ts.');
inherited(source.get('run-history-native-02.ps1').toString('utf8'), artifact, 'run-artifact-native-01.ps1');
add('run-artifact-native-01.template.ps1', blocked(artifact, '.ps1'), 'run-history-native-02.ps1');

const entry = `param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
$ErrorActionPreference='Stop'
${psBlock}
. (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
Assert-F24EditorHost
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskRunner=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$taskExtension=Join-Path $PSScriptRoot '__F24_EXTRACTED_EXTENSION_RELATIVE__'
. (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
$taskArtifactOutput=Join-Path $PSScriptRoot 'artifact-native-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-artifact-native-01.ps1'),'-CodePath',$CodePath,'-HostTestsPath',(Join-Path $PSScriptRoot '__F24_NATIVE_HOST_OUTPUT_DIR__/lite-artifact-host.js'),'-ExtensionRoot',$taskExtension,'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskArtifactOutput -WorkingDirectory $taskRepo
$taskArtifactReceipt=Get-Content -LiteralPath ($taskArtifactOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskArtifactReceipt.exitCode -ne 0){throw 'Artifact native gate failed/incomplete; affected suite was not started.'}
Assert-F24EditorHost
$taskAffectedOutput=Join-Path $PSScriptRoot 'current-affected-suite-run-01.txt'
& $taskRunner -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run-current-affected-suite-01.ps1'),'-VsixPath',$VsixPath,'-ExpectedVsixSha256',$ExpectedVsixSha256,'-ExpectedBundleSha256',$ExpectedBundleSha256) -OutputFile $taskAffectedOutput -WorkingDirectory $taskRepo
$taskAffectedReceipt=Get-Content -LiteralPath ($taskAffectedOutput+'.result.json') -Raw -Encoding UTF8|ConvertFrom-Json
if($taskAffectedReceipt.exitCode -ne 0){throw 'Current affected suite failed/incomplete; retain all attempts.'}
Assert-F24EditorHost
Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskExtension -ExpectedBundleSha256 $ExpectedBundleSha256
Write-Output 'F24 artifact25 and current affected history25/MCP+9/retained106/functional10/security17 completed their actual gated launch paths; acceptance and byte proofs remain separate.'
`;
add('run-native-gates-01.template.ps1', entry);

const instructions = `# F24 native templates — prepared, unbound, unexecuted

This helper only prepares new fixture text. It does not run a compiler, build,
package inspection, editor, child, Git command, network request or test.

The 22 generated templates retain exact prior safety gates and finite waits.
The new main artifact launcher delegates all payload seeding to its frozen host;
it adds no launcher artifact payload. Existing affected fixtures keep their own
original payloads and assertion counts. The current affected suite adds history25
before MCP25, editor25, CI25, service-account25, registry25, Terraform25,
container25, source21, hygiene21, vault10, retained106, functional10 and security17.
Actual functional result IDs H09/H10 must both be present once and PASS.

Before execution, root must prepare current full-gate exit/raw receipts, exhaustive
source/test/build inputs, installed-editor review and actual executable/version,
fresh native build/provenance, and a new F24 VSIX plus extracted runtime. Those
facts are deliberately UNBOUND here. Materialize NEW owned executable copies
(remove only the .template component) with every __F24_*__ token concretely bound
and __F24_TEMPLATE_BOUND__ replaced with F24_CURRENT_FACTS_BOUND after review.
Retain these templates and original snapshots unchanged. Parsing/current-byte
validation and explicit root verification precede any executable materialization.

No copied F23 package hash, full-suite success, source inventory, editor pin or
native result is promoted to F24. Existing installed-host assertions remain but
their current review/version/executable inputs are placeholders. The native
builder template retains the current compiler and pinned JSONC ESM checks and
adds one artifact entrypoint, for thirteen drivers; preparing text is not a build.
The inspector requires eighty machine settings, the new restricted artifact flag
and both artifact commands, alongside all previous commands/history flag.

Expected native coverage is artifact21+4 plus the prior twelve native families:
383 native checks in twenty-six phases, then functional10/security17. These are
declared expectations only. Each actual phase needs exit0, both EOFs, exact host,
driver and runtime identities; timeout remains INCOMPLETE with processes retained.
LOW scripted native decisions do not establish independent owner presence or an
OS boundary. All original acceptance, local-commit and exhaustive-byte barriers
remain required before F25; no interim numerical rating is authorized.
`;
outputs.set('native-template-instructions-01.md', Buffer.from(instructions));

// Validate everything before the first write, then refuse ANY prior output.
const snapshotRoot = path.join(__dirname, 'native-template-originals-01');
assert(!fs.existsSync(snapshotRoot), 'Original snapshot directory already exists');
for (const name of [...outputs.keys(), 'native-template-inputs-01.json']) assert(!fs.existsSync(path.join(__dirname, name)), `New immutable output exists: ${name}`);
const originals = pinned.map(([name, bytes, sha256]) => ({ name, bytes, sha256, snapshot: 'native-template-originals-01/' + name }));
const report = { status: 'PREPARED_TEMPLATES_NOT_EXECUTED_NOT_BOUND', originalFeature: 'F23', currentFeature: 'F24', originals,
  artifactHost: { path: artifactHost, bytes: artifactHostBytes.length, sha256: sha(artifactHostBytes), primaryChecks: 21, restartChecks: 4, ownsPayloadSeeding: true },
  templates: transformed, machineSettings: 80, nativeDriverEntrypoints: 13,
  expectedNativeChecks: 383, expectedNativePhases: 26, functionalChecks: 10, securityComparisonRows: 17, requiredFunctionalPublicationIds: ['H09', 'H10'],
  scope: 'Only new immutable unbound fixture templates and exact prior-byte snapshots. No product/full/package/host result bound, executed or promoted; no signals, deletion, launch, compiler, build, Git or network operation performed by this helper.' };
outputs.set('native-template-inputs-01.json', Buffer.from(JSON.stringify(report, null, 2) + '\n'));
fs.mkdirSync(snapshotRoot);
for (const [name, raw] of source) fs.writeFileSync(path.join(snapshotRoot, name), raw, { flag: 'wx' });
for (const [name, bytes] of outputs) fs.writeFileSync(path.join(__dirname, name), bytes, { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, templates: transformed.length, originalSnapshots: originals.length,
  artifactNativeChecks: 25, nativeDriverEntrypoints: 13, execution: 'NOT_RUN' }));
