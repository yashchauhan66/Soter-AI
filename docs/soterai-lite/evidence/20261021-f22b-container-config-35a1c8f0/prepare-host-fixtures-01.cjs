const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const prior = path.resolve(__dirname, '../20261021-f22a-source-6c4d81f2'), sha = b => crypto.createHash('sha256').update(b).digest('hex'), records = [];
const outputs = [['run-source-native-01.ps1','run-container-native-01.ps1'], ['run-source-native-01.ps1','run-affected-source-01.ps1'], ['run-affected-hygiene-01.ps1','run-affected-hygiene-01.ps1'], ['run-affected-vault-01.ps1','run-affected-vault-01.ps1'], ['run-retained-native-01.ps1','run-retained-native-01.ps1'], ['inspect-vsix-02.ps1','inspect-vsix-01.ps1'], ['artifact-binding-03.ps1','artifact-binding-03.ps1'], ['run-affected-hosts-03.ps1','run-affected-hosts-03.ps1'], ['run-functional-03.ps1','run-functional-03.ps1'], ['run-security-03.ps1','run-security-03.ps1']];
for (const [source, target] of outputs) {
 const original = fs.readFileSync(path.join(prior, source)); let text = original.toString('utf8').replaceAll('f22a-', 'f22b-').replaceAll('F22a', 'F22b');
 if (target === 'run-container-native-01.ps1') {
  text = text.replaceAll('f22b-source-native-', 'f22b-container-native-').replace("$taskCount=if($taskPhase -eq 'primary'){18}else{3}", "$taskCount=if($taskPhase -eq 'primary'){21}else{4}").replace('nativeChecks=21;', 'nativeChecks=25;').replace('registered native hygiene commands', 'registered native container commands').replace('Native owned broker lifecycle evidence:', 'Native owned container evidence:'); assert(text.includes('nativeChecks=25;')); assert(text.includes("{21}else{4}"));
 }
 if (target === 'run-affected-source-01.ps1') text = text.replaceAll('f22b-source-native-', 'f22b-affected-source-');
 if (target === 'inspect-vsix-01.ps1') {
  text = text.replaceAll('$taskMachine.Count -ne 71', '$taskMachine.Count -ne 72').replaceAll('71 machine settings', '72 machine settings').replaceAll('soterai.lite.configScanner.source', 'soterai.lite.configScanner.dockerKubernetes');
  text = text.replaceAll("'soterai.sourceSecretScannerStatus')", "'soterai.sourceSecretScannerStatus','soterai.reviewWorkspaceContainerSecrets','soterai.reviewContainerSecrets','soterai.reviewContainerSecretVault','soterai.restoreContainerSecretVault','soterai.containerSecretScannerStatus')");
  const marker = 'Assert-F22bManifest $taskBuildManifest'; assert.equal(text.split(marker).length, 2);
  text = text.replace(marker, marker + `
if(@($taskVerifiedInputs|Where-Object{$_.path -ceq 'node_modules/yaml/dist/index.js'}).Count -ne 1){throw 'Exact bundled YAML parser source missing.'}
if(@($taskVerifiedInputs|Where-Object{$_.path -ceq 'packages/vscode-extension/src/config-scanners/ContainerSecretPlan.ts'}).Count -ne 1){throw 'Exact container planner source missing.'}
$taskYamlManifest=Read-F22bJson (Join-Path $taskRepoRoot 'node_modules/yaml/package.json')
if($taskYamlManifest.version -cne '2.9.0' -or $taskYamlManifest.license -cne 'ISC'){throw 'Installed YAML dependency pin differs.'}
$taskYamlLicense=[IO.File]::ReadAllText((Join-Path $taskRepoRoot 'node_modules/yaml/LICENSE')).Replace("\r\n","\n").TrimEnd()
$taskPackagedLicense=[Text.UTF8Encoding]::new($false,$true).GetString($taskContents['extension/LICENSE.md']).Replace("\r\n","\n")
if(-not $taskPackagedLicense.Contains('yaml 2.9.0') -or -not $taskPackagedLicense.Contains($taskYamlLicense)){throw 'Exact YAML ISC permission notice missing.'}
`);
  assert(text.includes('$taskMachine.Count -ne 72')); assert(!text.includes('machineSettings=70'));
 }
 const bytes = Buffer.from(text); fs.writeFileSync(path.join(__dirname, target), bytes, { flag: 'wx' }); records.push({ source: path.relative(path.resolve(__dirname, '../../../..'), path.join(prior, source)).replaceAll('\\','/'), originalSha256: sha(original), path: target, bytes: bytes.length, sha256: sha(bytes) });
}
const before = fs.readFileSync(path.join(prior, 'build-native-hosts-01.cjs'), 'utf8'), builder = before.replace("'lite-source-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteSourceScanner.host.ts')", "'lite-source-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteSourceScanner.host.ts'),'lite-container-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteContainerScanner.host.ts')"); assert.notEqual(builder, before); fs.writeFileSync(path.join(__dirname, 'build-native-hosts-01.cjs'), builder, { flag: 'wx' }); records.push({ path: 'build-native-hosts-01.cjs', bytes: Buffer.byteLength(builder), sha256: sha(builder), originalSha256: sha(before) });
const validationBefore = fs.readFileSync(path.join(prior, 'validate-host-fixtures-01.ps1'), 'utf8'), validation = validationBefore.replace('$taskRows.Count -ne 9', '$taskRows.Count -ne 10').replace("@('lite-source-host.js','lite-hygiene-host.js','lite-vault-host.js','lite-broker-host.js')", "@('lite-container-host.js','lite-source-host.js','lite-hygiene-host.js','lite-vault-host.js','lite-broker-host.js')"); assert.notEqual(validation, validationBefore); fs.writeFileSync(path.join(__dirname, 'validate-host-fixtures-01.ps1'), validation, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'host-fixture-inputs-01.json'), JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', records, currentNative: 'container21primary+4restart; affectedsource18+3/hygiene18+3/vault6+4/retained103+3/functional10/security17 unchanged', safety: 'Exact VSIX/3runtimes/Code bindings, fresh isolated D profiles, owned bounded close/EOF and no signals inherited. Native decisions scripted, LOW independence; no build/deployment/real credential or independent evidence.' }, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', helpers: records.length, nativeContainer: 25 }));
