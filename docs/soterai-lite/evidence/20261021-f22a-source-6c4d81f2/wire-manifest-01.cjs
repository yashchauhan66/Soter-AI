const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const receiptFile = path.join(__dirname, 'manifest-wiring-01.json');
if (fs.existsSync(receiptFile)) throw Error('Evidence overwrite refused');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const flag = 'soterai.lite.configScanner.source';
const commands = [
    ['reviewWorkspaceSourceSecrets', 'Review Workspace Source Secrets'],
    ['reviewSourceSecrets', 'Review Selected Source Secrets'],
    ['reviewSourceSecretVault', 'Review Source Vault Migration'],
    ['restoreSourceSecretVault', 'Restore Reviewed Source Values (Disclosure)'],
    ['sourceSecretScannerStatus', 'Source Secret Scanner Status']
];
const changes = [];
for (const file of ['packages/vscode-extension/package.json', 'packages/soterai-lite/package.json']) {
    const absolute = path.join(repo, file), before = fs.readFileSync(absolute), original = before.toString('utf8'), p = JSON.parse(original);
    if (p.contributes.configuration.properties[flag] || p.devDependencies['@babel/parser']) throw Error('Unexpected pre-existing wiring');
    p.devDependencies = { '@babel/parser': '7.29.7', ...p.devDependencies };
    p.contributes.configuration.properties[flag] = { type: 'boolean', default: true, scope: 'machine', description: 'Enable owner-reviewed static string scanning in saved JS/JSX/TS/TSX/MJS/CJS source, with canonical encrypted vault migration and exact disclosure restore. Dynamic or unsupported source withholds analysis; configure application secret loading manually.' };
    p.capabilities.untrustedWorkspaces.restrictedConfigurations.push(flag);
    for (const [name, title] of commands) {
        const command = 'soterai.' + name;
        if (p.contributes.commands.some(c => c.command === command)) throw Error('Duplicate command');
        p.contributes.commands.push({ command, title, category: 'SoterAI' });
        p.contributes.menus.commandPalette.push({ command, when: 'soterai.advancedCommands' });
    }
    const newline = original.includes('\r\n') ? '\r\n' : '\n', indent = file.includes('vscode-extension') ? 4 : 2;
    const after = Buffer.from((JSON.stringify(p, null, indent) + '\n').replace(/\n/g, newline));
    fs.writeFileSync(absolute, after); changes.push({ path: file, before: hash(before), after: hash(after), bytes: after.length });
}
const lockFile = path.join(repo, 'package-lock.json'), lockBefore = fs.readFileSync(lockFile), lockText = lockBefore.toString('utf8'), lock = JSON.parse(lockText);
const marker = '"packages/soterai-lite": {';
const start = lockText.indexOf(marker); if (start < 0 || lockText.indexOf(marker, start + 1) >= 0 || lock.packages['node_modules/@babel/parser'].version !== '7.29.7' || lock.packages['packages/soterai-lite'].devDependencies['@babel/parser']) throw Error('Lock precondition');
const depStart = lockText.indexOf('"devDependencies": {', start), insertion = depStart + '"devDependencies": {'.length;
const newline = lockText.includes('\r\n') ? '\r\n' : '\n';
const lockAfter = Buffer.from(lockText.slice(0, insertion) + newline + '        "@babel/parser": "7.29.7",' + lockText.slice(insertion));
const actualLock = JSON.parse(lockAfter); lock.packages['packages/soterai-lite'].devDependencies['@babel/parser'] = '7.29.7';
if (JSON.stringify(lock) !== JSON.stringify(actualLock)) throw Error('Unrelated lock change refused');
fs.writeFileSync(lockFile, lockAfter); changes.push({ path: 'package-lock.json', before: hash(lockBefore), after: hash(lockAfter), bytes: lockAfter.length });
const receipt = { status: 'WIRED_NOT_NATIVE_VERIFIED', flag, commands: commands.map(([n]) => 'soterai.' + n), changes, parser: { version: '7.29.7', installedOnly: true, downloads: 0 } };
fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(receipt));
