'use strict';
// Native VS Code API driver; the separate renderer uses the actual UI controls.
// No product-source imports, prompt mocks, or fabricated button responses.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const demand = value => { if (!value) throw Error('WORKFLOW_CHECK_FAILED'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function publish(file, value) {
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staged = file + '.staged';
  await fs.writeFile(staged, JSON.stringify(value), { flag: 'wx' });
  await fs.rename(staged, file);
}
async function until(test, budget = 15000) {
  const end = Date.now() + budget;
  while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('WORKFLOW_TIMEOUT');
}
const safe = text => !text.includes('BlueMango7!') && !text.includes('OrangeRiver9!');
exports.run = async function () {
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out));
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_REVIEWED_WORKFLOW', artifactSha256: prepared.artifactSha256,
    editorVersion: vscode.version, runNonce: prepared.runNonce, checks: [], uiAutomation: true, realProviderTested: false, vaultRecoveryTested: false,
    restrictedWorkspaceTested: false, independentHumanReview: false, releaseReady: false };
  let originalClipboard, ownedClipboard, step = 0, success = true;
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch { result.checks.push({ name, status: 'FAIL' }); success = false; return false; }
  }
  async function sentinel() {
    ownedClipboard = `SoterAI public workflow sentinel ${prepared.runNonce} stage ${step}`;
    await vscode.env.clipboard.writeText(ownedClipboard);
  }
  async function select(name) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(out, 'workspace', name)));
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(document.positionAt(0), document.positionAt(document.getText().length));
    return { document, editor };
  }
  async function choose(stage, choice, pending, mutate) {
    const preview = await until(() => { const editor = vscode.window.activeTextEditor; return editor?.document.isUntitled ? editor : undefined; });
    const text = preview.document.getText(); demand(safe(text) && text.length > 20);
    if (mutate) await mutate(preview);
    step++;
    await publish(path.join(out, `ui-request-${step}.json`), { schemaVersion: 1, runNonce: prepared.runNonce, ordinal: step, stage, choice });
    const reply = await Promise.race([pending, delay(15000).then(() => { throw Error('COMMAND_TIMEOUT'); })]);
    const commandStatus = ['COPIED', 'PREVIEWED', 'CANCELLED', 'UNAVAILABLE'].includes(reply?.status) ? reply.status : 'VOID';
    await publish(path.join(out, `ui-command-result-${step}.json`), { schemaVersion: 1, runNonce: prepared.runNonce, ordinal: step, stage, commandStatus });
    await until(async () => { try { const ack = JSON.parse(await fs.readFile(path.join(out, `ui-step-${step}.json`), 'utf8')); demand(ack.status === 'PASS' && ack.stage === stage && ack.ordinal === step && ack.runNonce === prepared.runNonce); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } });
    return { reply, text };
  }
  async function reviewed(name, command, stage, choice, expected, mutate) {
    await sentinel(); const source = await select(name);
    const pending = Promise.resolve(vscode.commands.executeCommand(command));
    const { reply, text } = await choose(stage, choice, pending, mutate ? preview => mutate(source, preview) : undefined);
    demand(reply?.status === expected);
    const clipboard = await vscode.env.clipboard.readText();
    if (expected === 'COPIED') { demand(clipboard === text && safe(clipboard)); ownedClipboard = clipboard; }
    else demand(clipboard === ownedClipboard);
    return text;
  }
  try {
    if (!await check('exact-installed-extension-activation', async () => {
      const extension = vscode.extensions.getExtension(prepared.identity); demand(extension);
      const relative = path.relative(path.join(out, 'profile/extensions'), extension.extensionPath);
      demand(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
      demand(extension.packageJSON.version === prepared.version && prepared.runtimes.length === 4);
      demand(extension.packageJSON.publisher + '.' + extension.packageJSON.name === prepared.identity && extension.packageJSON.main === './dist/extension.js');
      demand(new Set(prepared.runtimes.map(item => item.name)).size === 4);
      for (const runtime of prepared.runtimes) {
        demand(['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'].includes(runtime.name));
        const bytes = await fs.readFile(path.join(extension.extensionPath, 'dist', runtime.name));
        demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256);
      }
      await extension.activate(); demand(extension.isActive && vscode.workspace.isTrusted);
      result.installedExtensionVersion = extension.packageJSON.version;
      await until(async () => { try { const ready = JSON.parse(await fs.readFile(path.join(out, 'renderer-ready.json'), 'utf8')); return ready.status === 'READY' && ready.runNonce === prepared.runNonce; } catch { return false; } });
    })) return;
    originalClipboard = await vscode.env.clipboard.readText();
    if (!await check('debug-reviewed-copy', async () => {
      const text = await reviewed('debug.txt', 'soterai.prepareDebugContext', 'debug-copy', 'copy', 'COPIED');
      demand(text.includes('ECONNREFUSED') && text.includes('Retry failed after 3 attempts'));
    })) return;
    if (!await check('environment-reviewed-copy', async () => {
      const text = await reviewed('environment.txt', 'soterai.prepareEnvironmentContext', 'environment-copy', 'copy', 'COPIED');
      demand(text.includes('DB_PASSWORD') && text.includes('APP_PORT | number | 8080') && !text.includes('5173') && !text.includes('local.example.invalid'));
    })) return;
    if (!await check('keep-preview-without-copy', () => reviewed('debug.txt', 'soterai.prepareDebugContext', 'debug-keep', 'keep', 'PREVIEWED'))) return;
    if (!await check('cancel-without-copy', () => reviewed('debug.txt', 'soterai.prepareDebugContext', 'debug-cancel', 'cancel', 'CANCELLED'))) return;
    if (!await check('source-drift-refusal', () => reviewed('debug.txt', 'soterai.prepareDebugContext', 'source-drift', 'copy', 'UNAVAILABLE', async source => {
      const edit = new vscode.WorkspaceEdit(); edit.insert(source.document.uri, new vscode.Position(0, 0), '// changed synthetic source\n');
      demand(await vscode.workspace.applyEdit(edit));
    }))) return;
    if (!await check('preview-drift-refusal', () => reviewed('debug.txt', 'soterai.prepareDebugContext', 'preview-drift', 'copy', 'UNAVAILABLE', async (_source, preview) => {
      demand(await preview.edit(edit => edit.insert(new vscode.Position(0, 0), '// owner changed synthetic preview\n')));
    }))) return;
    if (!await check('settings-drift-refusal', async () => {
      const configuration = vscode.workspace.getConfiguration('soterai'), prior = configuration.inspect('lite.outputRedactor')?.globalValue;
      try { await reviewed('debug.txt', 'soterai.prepareDebugContext', 'settings-drift', 'copy', 'UNAVAILABLE', () => configuration.update('lite.outputRedactor', false, vscode.ConfigurationTarget.Global)); }
      finally { await configuration.update('lite.outputRedactor', prior, vscode.ConfigurationTarget.Global); }
    })) return;
    if (!await check('concurrent-review-refusal', () => reviewed('debug.txt', 'soterai.prepareDebugContext', 'concurrent-refusal', 'keep', 'PREVIEWED', async () => {
      demand((await vscode.commands.executeCommand('soterai.prepareDebugContext'))?.status === 'UNAVAILABLE');
    }))) return;
    let usedAction;
    if (!await check('live-quickfix-reviewed-copy', async () => {
      await sentinel(); const { document } = await select('app.txt');
      const found = await until(() => { const rows = vscode.languages.getDiagnostics(document.uri).filter(item => item.source === 'SoterAI' && /secret|password|credential/i.test(String(item.code))); return rows.length ? rows : undefined; });
      demand(safe(JSON.stringify(found)));
      const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', document.uri, found[0].range);
      usedAction = actions.find(item => /sanitized lines/.test(item.title)); demand(usedAction?.command?.command);
      demand(usedAction.command.arguments?.length === 1 && Object.keys(usedAction.command.arguments[0]).join(',') === 'id');
      const pending = Promise.resolve(vscode.commands.executeCommand(usedAction.command.command, ...usedAction.command.arguments));
      const { text } = await choose('quickfix-copy', 'copy', pending);
      const clipboard = await vscode.env.clipboard.readText(); demand(clipboard === text && safe(text) && text.includes('public fixture'));
      ownedClipboard = clipboard;
    })) return;
    await check('one-use-action-refusal', async () => {
      await sentinel(); await vscode.commands.executeCommand(usedAction.command.command, ...usedAction.command.arguments);
      demand(await vscode.env.clipboard.readText() === ownedClipboard);
    });
    if (success) result.status = 'PASS_NATIVE_REVIEWED_WORKFLOW';
  } finally {
    try { if (typeof originalClipboard === 'string' && await vscode.env.clipboard.readText() === ownedClipboard) await vscode.env.clipboard.writeText(originalClipboard); }
    catch { result.checks.push({ name: 'clipboard-restore', status: 'FAIL' }); result.status = 'FAIL_NATIVE_REVIEWED_WORKFLOW'; }
    result.clipboardOriginalRecorded = false;
    await fs.writeFile(path.join(out, 'host-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  demand(result.status === 'PASS_NATIVE_REVIEWED_WORKFLOW');
};
