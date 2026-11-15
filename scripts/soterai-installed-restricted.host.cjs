'use strict';
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const demand = value => { if (!value) throw Error('RESTRICTED_CHECK_FAILED'); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
exports.run = async function () {
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out));
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_RESTRICTED_WORKSPACE', artifactSha256: prepared.artifactSha256, runNonce: prepared.runNonce,
    editorVersion: vscode.version, checks: [], uiAutomation: false, restrictedWorkspaceTested: true, realProviderTested: false, independentHumanReview: false, releaseReady: false };
  let originalClipboard, ownClipboard, document, diagnostics;
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch { result.checks.push({ name, status: 'FAIL' }); return false; }
  }
  try {
    if (!await check('exact-installed-extension-activation', async () => {
      const extension = vscode.extensions.getExtension(prepared.identity); demand(extension);
      const relative = path.relative(path.join(out, 'profile/extensions'), extension.extensionPath);
      demand(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
      demand(extension.packageJSON.version === prepared.version && extension.packageJSON.main === './dist/extension.js');
      demand(extension.packageJSON.publisher + '.' + extension.packageJSON.name === prepared.identity);
      demand(prepared.runtimes.length === 4 && new Set(prepared.runtimes.map(row => row.name)).size === 4);
      for (const runtime of prepared.runtimes) {
        demand(['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'].includes(runtime.name));
        const bytes = await fs.readFile(path.join(extension.extensionPath, 'dist', runtime.name)); demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256);
      }
      await extension.activate(); demand(extension.isActive && vscode.workspace.isTrusted === false);
      result.installedExtensionVersion = extension.packageJSON.version;
      result.observedWorkspaceTrusted = vscode.workspace.isTrusted;
      originalClipboard = await vscode.env.clipboard.readText(); ownClipboard = 'SoterAI restricted synthetic sentinel ' + prepared.runNonce;
      await vscode.env.clipboard.writeText(ownClipboard);
      document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(out, 'workspace/app.txt')));
      const editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(document.getText().length));
    })) return;
    await check('restricted-local-findings', async () => {
      const end = Date.now() + 15000;
      while (Date.now() < end) {
        diagnostics = vscode.languages.getDiagnostics(document.uri).filter(item => item.source === 'SoterAI' && /secret|password|credential/i.test(String(item.code)));
        if (diagnostics.length) break; await delay(100);
      }
      demand(diagnostics.length > 0);
      demand(!JSON.stringify(diagnostics).includes('BlueMango7!') && !JSON.stringify(diagnostics).includes('OrangeRiver9!'));
    });
    await check('restricted-reviewed-context-refusal', async () => {
      for (const command of ['soterai.prepareDebugContext', 'soterai.prepareEnvironmentContext', 'soterai.buildSafePromptForAI']) {
        const reply = await vscode.commands.executeCommand(command);
        demand(['SELECTION_REQUIRED', 'UNAVAILABLE'].includes(reply?.status));
        demand(await vscode.env.clipboard.readText() === ownClipboard);
      }
    });
    await check('restricted-vault-migration-refusal', async () => {
      const uri = vscode.Uri.file(path.join(out, 'workspace/.env')), before = await fs.readFile(uri.fsPath);
      await vscode.commands.executeCommand('soterai.migrateSecretsToVault', uri);
      demand((await fs.readFile(uri.fsPath)).equals(before));
      try { await fs.lstat(path.join(out, 'workspace/.env.example')); throw Error('UNEXPECTED_EXAMPLE'); } catch (error) { demand(error.code === 'ENOENT'); }
    });
    await check('restricted-finding-action-refusal', async () => {
      demand(diagnostics?.length);
      const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', document.uri, diagnostics[0].range);
      for (const action of actions ?? []) {
        if (action.command?.command === 'soterai.applyFindingFix') await vscode.commands.executeCommand(action.command.command, ...(action.command.arguments ?? []));
      }
      demand(await vscode.env.clipboard.readText() === ownClipboard);
      demand(document.getText().includes('BlueMango7!') && document.getText().includes('OrangeRiver9!'));
    });
    await check('restricted-adapter-setup-refusal', async () => {
      const response = await vscode.commands.executeCommand('soterai.configurePinnedCline');
      demand(response?.status === 'UNAVAILABLE');
      demand(await vscode.env.clipboard.readText() === ownClipboard);
    });
    if (result.checks.every(row => row.status === 'PASS')) result.status = 'PASS_NATIVE_RESTRICTED_WORKSPACE';
  } finally {
    try { if (typeof originalClipboard === 'string' && await vscode.env.clipboard.readText() === ownClipboard) await vscode.env.clipboard.writeText(originalClipboard); }
    catch { result.checks.push({ name: 'clipboard-restore', status: 'FAIL' }); result.status = 'FAIL_NATIVE_RESTRICTED_WORKSPACE'; }
    result.clipboardOriginalRecorded = false;
    await fs.writeFile(path.join(out, 'host-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  demand(result.status === 'PASS_NATIVE_RESTRICTED_WORKSPACE');
};
