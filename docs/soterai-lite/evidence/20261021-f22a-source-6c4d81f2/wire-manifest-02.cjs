const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..'), receiptFile = path.join(__dirname, 'manifest-wiring-02.json');
if (fs.existsSync(receiptFile)) throw Error('Evidence overwrite refused');
const hash = b => crypto.createHash('sha256').update(b).digest('hex'), flag = 'soterai.lite.configScanner.source';
const commands = [['reviewWorkspaceSourceSecrets', 'Review Workspace Source Secrets'], ['reviewSourceSecrets', 'Review Selected Source Secrets'], ['reviewSourceSecretVault', 'Review Source Vault Migration'], ['restoreSourceSecretVault', 'Restore Reviewed Source Values (Disclosure)'], ['sourceSecretScannerStatus', 'Source Secret Scanner Status']];
const changes = [];
for (const file of ['packages/vscode-extension/package.json', 'packages/soterai-lite/package.json']) {
    const before = execFileSync('git', ['show', '499ca1142f5b9b9f5cb21948530868c4440053e0:' + file], { cwd: repo, maxBuffer: 4 * 1024 * 1024 }), expected = JSON.parse(before), after = fs.readFileSync(path.join(repo, file));
    expected.devDependencies['@babel/parser'] = '7.29.7';
    expected.contributes.configuration.properties[flag] = { type: 'boolean', default: true, scope: 'machine', description: 'Enable owner-reviewed static string scanning in saved JS/JSX/TS/TSX/MJS/CJS source, with canonical encrypted vault migration and exact disclosure restore. Dynamic or unsupported source withholds analysis; configure application secret loading manually.' };
    expected.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);
    for (const [name, title] of commands) { expected.contributes.commands.push({ command: 'soterai.' + name, title, category: 'SoterAI' }); expected.contributes.menus.commandPalette.push({ command: 'soterai.' + name, when: 'soterai.advancedCommands' }); }
    assert.deepStrictEqual(JSON.parse(after), expected); changes.push({ path: file, before: hash(before), after: hash(after), bytes: after.length, exactAllowedSemanticChange: true });
}
const file = path.join(repo, 'package-lock.json'), before = fs.readFileSync(file), text = before.toString('utf8'), expected = JSON.parse(text), marker = '"packages/soterai-lite": {';
assert.equal(expected.packages['node_modules/@babel/parser'].version, '7.29.7'); assert.equal(expected.packages['packages/soterai-lite'].devDependencies['@babel/parser'], undefined);
const start = text.indexOf(marker); assert(start >= 0); assert.equal(text.indexOf(marker, start + 1), -1);
const depStart = text.indexOf('"devDependencies": {', start), insertion = depStart + '"devDependencies": {'.length; assert(depStart > start);
const newline = text.includes('\r\n') ? '\r\n' : '\n', after = Buffer.from(text.slice(0, insertion) + newline + '        "@babel/parser": "7.29.7",' + text.slice(insertion));
expected.packages['packages/soterai-lite'].devDependencies['@babel/parser'] = '7.29.7'; assert.deepStrictEqual(JSON.parse(after), expected);
fs.writeFileSync(file, after); changes.push({ path: 'package-lock.json', before: hash(before), after: hash(after), bytes: after.length, exactAllowedSemanticChange: true });
const receipt = { status: 'WIRED_NOT_NATIVE_VERIFIED', flag, commands: commands.map(([n]) => 'soterai.' + n), changes, previousFailure: 'helper01 compared JSON property insertion order after both manifest writes, before any lock write. Deep strict equality now validates only the allowed semantic changes.', parser: { version: '7.29.7', installedOnly: true, downloads: 0 } };
fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(receipt));
