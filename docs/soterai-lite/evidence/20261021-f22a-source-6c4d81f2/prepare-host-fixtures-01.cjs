const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const prior = path.resolve(__dirname, '../20261020-f21-hygiene-4f8a1c92'), sha = b => crypto.createHash('sha256').update(b).digest('hex'), records = [];
const outputs = [
 ['run-hygiene-native-02.ps1','run-source-native-01.ps1'], ['run-hygiene-native-02.ps1','run-affected-hygiene-01.ps1'],
 ['run-affected-vault-02.ps1','run-affected-vault-01.ps1'], ['run-retained-native-02.ps1','run-retained-native-01.ps1'],
 ['inspect-vsix-01.ps1','inspect-vsix-01.ps1'], ['artifact-binding-03.ps1','artifact-binding-03.ps1'],
 ['run-affected-hosts-03.ps1','run-affected-hosts-03.ps1'], ['run-functional-03.ps1','run-functional-03.ps1'], ['run-security-03.ps1','run-security-03.ps1']
];
for (const [source, target] of outputs) {
    const before = fs.readFileSync(path.join(prior, source)); let text = before.toString('utf8').replaceAll('f21-', 'f22a-').replaceAll('F21', 'F22a');
    if (target === 'run-source-native-01.ps1') text = text.replaceAll('f22a-hygiene-native-', 'f22a-source-native-');
    if (target === 'run-affected-hygiene-01.ps1') text = text.replaceAll('f22a-hygiene-native-', 'f22a-affected-hygiene-');
    if (target === 'inspect-vsix-01.ps1') {
        text = text.replaceAll('$taskMachine.Count -ne 70', '$taskMachine.Count -ne 71').replaceAll('70 machine settings', '71 machine settings').replaceAll("soterai.lite.hygieneAssistant", "soterai.lite.configScanner.source");
        text = text.replaceAll("'soterai.hygieneStatus')", "'soterai.hygieneStatus','soterai.reviewWorkspaceSourceSecrets','soterai.reviewSourceSecrets','soterai.reviewSourceSecretVault','soterai.restoreSourceSecretVault','soterai.sourceSecretScannerStatus')");
        assert(text.includes('$taskMachine.Count -ne 71')); assert(text.includes('soterai.sourceSecretScannerStatus'));
    }
    if (target === 'artifact-binding-03.ps1' || target === 'inspect-vsix-01.ps1') { assert(text.includes('f22a-')); assert(!text.includes('f21-')); }
    const bytes = Buffer.from(text); fs.writeFileSync(path.join(__dirname, target), bytes, { flag: 'wx' }); records.push({ source: path.relative(path.resolve(__dirname, '../../../..'), path.join(prior, source)).replaceAll('\\','/'), originalSha256: sha(before), path: target, bytes: bytes.length, sha256: sha(bytes) });
}
const builder = fs.readFileSync(path.join(prior, 'build-native-hosts-01.cjs'), 'utf8');
const updated = builder.replace("'lite-vault-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteVault.host.ts')", "'lite-vault-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteVault.host.ts'),'lite-source-host':path.join(repo,'packages/vscode-extension/src/__tests__/host/liteSourceScanner.host.ts')"); assert.notEqual(updated, builder);
fs.writeFileSync(path.join(__dirname, 'build-native-hosts-01.cjs'), updated, { flag: 'wx' }); records.push({ path: 'build-native-hosts-01.cjs', bytes: Buffer.byteLength(updated), sha256: sha(updated), originalSha256: sha(builder) });
fs.writeFileSync(path.join(__dirname, 'host-fixture-inputs-01.json'), JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', records, currentNative: 'source18+restart3; affected hygiene18+restart3/vault6+restart4/retained103+restart3/functional10/security17 unchanged', safety: 'Exact VSIX/three-runtime/Code bindings, isolated D profiles, bounded owned close/EOF, no signals/download/login retained from originals.' }, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: 'PREPARED_NOT_EXECUTED', helpers: records.length }));
