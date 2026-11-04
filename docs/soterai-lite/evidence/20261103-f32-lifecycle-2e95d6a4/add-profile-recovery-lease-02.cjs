const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const prepared = [];
for (const family of ['PowerShell', 'Cmd', 'GitBash']) {
  const file = path.join(repo, 'packages/vscode-extension/src/terminal/Checked' + family + 'Profile.ts');
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const replace = (before, after) => { assert.equal(text.split(before).length, 2, before); text = text.replace(before, after); };
  replace('constructor(context: vscode.ExtensionContext, enabled: () => boolean)',
    'constructor(context: vscode.ExtensionContext, enabled: () => boolean, private readonly restoreEnabled: () => boolean = enabled)');
  replace('#available(): boolean { try { return this.#enabled() === true; } catch { return false; } }',
    '#available(restore = false): boolean { try { return (restore ? this.restoreEnabled : this.#enabled)() === true; } catch { return false; } }');
  assert(text.includes('async #change(root: vscode.Uri, restore: boolean)'));
  assert(text.split('this.#available()').length > 5);
  text = text.replaceAll('this.#available()', 'this.#available(restore)');
  prepared.push({ file, text });
}
for (const [fileName, className] of [['commands.ts','CheckedPowerShellProfile'], ['cmdCommands.ts','CheckedCmdProfile'], ['gitBashCommands.ts','CheckedGitBashProfile']]) {
  const file = path.join(repo, 'packages/vscode-extension/src/terminal', fileName);
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const replace = (before, after) => { assert.equal(text.split(before).length, 2, before); text = text.replace(before, after); };
  replace('const OWNERSHIP =', 'import { lifecycleRecoveryEnabled } from "../lifecycle/LifecycleFlags";\n\nconst OWNERSHIP =');
  replace('    const profile = new ' + className + '(context, available);',
    '    const restoreAvailable = (): boolean => {\n        try { return available() || !disposed && !stopped && process.platform === "win32" && !vscode.env.remoteName\n            && vscode.workspace.isTrusted && lifecycleRecoveryEnabled(); } catch { return false; }\n    };\n    const profile = new ' + className + '(context, available, restoreAvailable);');
  replace('const choose = async (requested?: unknown): Promise<vscode.Uri | undefined> => {\n        if (!available()) return undefined;',
    'const choose = async (requested?: unknown, restoring = false): Promise<vscode.Uri | undefined> => {\n        const allowed = restoring ? restoreAvailable : available;\n        if (!allowed()) return undefined;');
  replace('return available() ? currentRoot(folder?.uri) : undefined;', 'return allowed() ? currentRoot(folder?.uri) : undefined;');
  const command = fileName === 'commands.ts' ? 'PowerShell' : familyName(fileName);
  replace('reg("soterai.restoreChecked' + command + '", async requested => { const root = await choose(requested);',
    'reg("soterai.restoreChecked' + command + '", async requested => { const root = await choose(requested, true);');
  prepared.push({ file, text });
}
function familyName(fileName) { return fileName === 'cmdCommands.ts' ? 'Cmd' : 'GitBash'; }
for (const row of prepared) fs.writeFileSync(row.file, row.text);
console.log('Prepared and wrote six exact profile/registration deltas; configure gates unchanged, restore-only gate is restricted-machine lifecycle recovery plus native project ownership.');
