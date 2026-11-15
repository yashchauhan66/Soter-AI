'use strict';
// Loaded by VS Code's actual extension test runner, outside the shipped product.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const demand = value => { if (!value) throw Error('CHECK_FAILED'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, budget = 12000) { const end = Date.now() + budget; while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); } throw Error('CHECK_TIMEOUT'); }
exports.run = async function () {
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out));
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_FOUNDATION', artifactSha256: prepared.artifactSha256,
    editorVersion: vscode.version, runNonce: prepared.runNonce, checks: [], uiAutomation: false, realProviderTested: false, independentHumanReview: false, releaseReady: false };
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch { result.checks.push({ name, status: 'FAIL' }); return false; }
  }
  let extension, document, oldClipboard, ownClipboard;
  const fixture = vscode.Uri.file(path.join(out, 'workspace/app.txt'));
  try {
    if (!await check('exact-installed-extension-activation', async () => {
      extension = vscode.extensions.getExtension(prepared.identity); demand(extension);
      const relative = path.relative(path.join(out, 'profile/extensions'), extension.extensionPath);
      demand(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
      demand(extension.packageJSON.version === prepared.version);
      demand(extension.packageJSON.publisher + '.' + extension.packageJSON.name === prepared.identity && extension.packageJSON.main === './dist/extension.js');
      demand(Array.isArray(prepared.runtimes) && prepared.runtimes.length === 4);
      demand(new Set(prepared.runtimes.map(item => item.name)).size === 4);
      for (const runtime of prepared.runtimes) {
        demand(['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'].includes(runtime.name));
        const bytes = await fs.readFile(path.join(extension.extensionPath, 'dist', runtime.name));
        demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256);
      }
      await Promise.race([extension.activate(), delay(20000).then(() => { throw Error('ACTIVATION_TIMEOUT'); })]);
      demand(extension.isActive);
      result.installedExtensionVersion = extension.packageJSON.version;
    })) return;
    await check('declared-production-commands', async () => {
      const commands = new Set(await vscode.commands.getCommands());
      for (const id of ['soterai.openProjectJourney', 'soterai.prepareDebugContext', 'soterai.prepareEnvironmentContext', 'soterai.migrateSecretsToVault', 'soterai.restoreChangesBeforeRemoval']) demand(commands.has(id));
    });
    let diagnostics, actions;
    if (!await check('native-live-findings-and-actions', async () => {
      document = await vscode.workspace.openTextDocument(fixture); await vscode.window.showTextDocument(document);
      diagnostics = await until(() => { const found = vscode.languages.getDiagnostics(fixture).filter(item => item.source === 'SoterAI' && /secret|password|credential/i.test(String(item.code))); return found.length ? found : undefined; });
      demand(diagnostics.length > 0);
      demand(!JSON.stringify(diagnostics).includes('BlueMango7!') && !JSON.stringify(diagnostics).includes('OrangeRiver9!'));
      actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', fixture, diagnostics[0].range);
      demand(Array.isArray(actions) && actions.some(action => /sanitized lines/.test(action.title)));
    })) return;
    await check('native-stale-action-refusal', async () => {
      const action = actions.find(item => /sanitized lines/.test(item.title)); demand(action?.command?.command);
      const args = action.command.arguments; demand(Array.isArray(args) && args.length === 1 && Object.keys(args[0]).join(',') === 'id');
      oldClipboard = await vscode.env.clipboard.readText();
      ownClipboard = 'SoterAI public acceptance clipboard'; await vscode.env.clipboard.writeText(ownClipboard);
      const editor = await vscode.window.showTextDocument(document);
      demand(await editor.edit(edit => edit.insert(new vscode.Position(0, 0), '// changed synthetic source\n')));
      await vscode.commands.executeCommand(action.command.command, ...args);
      demand(await vscode.env.clipboard.readText() === ownClipboard);
    });
    if (result.checks.every(item => item.status === 'PASS')) result.status = 'PASS_NATIVE_FOUNDATION';
  } finally {
    try {
      if (typeof oldClipboard === 'string' && await vscode.env.clipboard.readText() === ownClipboard) await vscode.env.clipboard.writeText(oldClipboard);
    } catch { result.checks.push({ name: 'clipboard-restore', status: 'FAIL' }); result.status = 'FAIL_NATIVE_FOUNDATION'; }
    result.clipboardOriginalRecorded = false;
    await fs.writeFile(path.join(out, 'host-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  demand(result.status === 'PASS_NATIVE_FOUNDATION');
};
