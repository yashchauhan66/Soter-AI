'use strict';
// A new actual editor session reuses only its explicitly bound synthetic seed
// cohort. Product APIs perform all decryption and reviewed source changes.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const demand = value => { if (!value) throw Error('RESTART_CHECK_FAILED'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const original = 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n';
const safeExample = 'DB_PASSWORD=\nAPI_PASSWORD=\n';
const noCanaries = value => !value.includes('BlueMango7!') && !value.includes('OrangeRiver9!');
const runtimes = ['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'];
function within(root, file) {
  const relative = path.relative(root, file);
  return !!relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}
const samePath = (left, right) => typeof left === 'string' && typeof right === 'string'
  && (process.platform === 'win32' ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() : path.resolve(left) === path.resolve(right));
async function until(test, budget = 20000) {
  const end = Date.now() + budget;
  while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('RESTART_TIMEOUT');
}
async function absent(file) {
  try { await fs.lstat(file); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}
async function read(scope, file, maximum = 2 * 1024 * 1024) {
  scope = path.resolve(scope); file = path.resolve(file); demand(within(scope, file));
  demand(within(await fs.realpath(scope), await fs.realpath(file)));
  let cursor = file, reached = false;
  for (let steps = 0; steps < 256; steps++) {
    if (samePath(cursor, scope)) { reached = true; break; }
    demand(within(scope, cursor)); demand(!(await fs.lstat(cursor)).isSymbolicLink());
    const parent = path.dirname(cursor); demand(!samePath(parent, cursor)); cursor = parent;
  }
  demand(reached);
  const before = await fs.lstat(file); demand(before.isFile() && before.nlink === 1 && before.size <= maximum);
  const bytes = await fs.readFile(file), after = await fs.lstat(file);
  demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && before.ino === after.ino && before.size === after.size
    && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && bytes.length === before.size);
  return bytes;
}
async function publish(out, name, value) {
  demand(/^[A-Za-z0-9.-]+\.json$/.test(name));
  const target = path.join(out, name), temporary = path.join(out, 'publish-' + randomUUID() + '.tmp');
  demand(await absent(target)); await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  demand(await absent(target)); await fs.rename(temporary, target);
}
exports.run = async function () {
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out));
  const prepared = JSON.parse(await read(out, path.join(out, 'prepared.json'), 16384));
  demand(prepared.schemaVersion === 1 && prepared.suite === 'vault-restart' && /^[a-f0-9]{32}$/.test(prepared.runNonce)
    && typeof prepared.cohortRoot === 'string' && path.isAbsolute(prepared.cohortRoot) && /^[a-f0-9]{64}$/.test(prepared.seedHostReportSha256)
    && /^[a-f0-9]{64}$/.test(prepared.seedLaunchReportSha256));
  const cohort = path.resolve(prepared.cohortRoot);
  demand(within(path.dirname(out), cohort) && !samePath(out, cohort));
  const workspace = path.join(cohort, 'workspace'), source = path.join(workspace, '.env'), example = path.join(workspace, '.env.example');
  const storage = path.join(cohort, 'profile/user-data/User/globalStorage', prepared.identity), sourceUri = vscode.Uri.file(source);
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_VAULT_RESTART', suite: 'vault-restart', artifactSha256: prepared.artifactSha256,
    editorVersion: vscode.version, editorSessionId: vscode.env.sessionId, extensionHostPid: process.pid, runNonce: prepared.runNonce,
    cohortEvidenceDirectory: path.basename(cohort), checks: [], commandStages: [], uiAutomation: true,
    gracefulRestartTested: false, encryptedKeyPersistenceVerified: false, interruptedRecoveryTested: false,
    powerLossRecoveryTested: false, upgradeRecoveryTested: false, appRuntimeTested: false, appOutputVerified: false,
    realProviderTested: false, independentHumanReview: false, osSecretCustodyCertified: false, clipboardModifiedByTest: false, releaseReady: false };
  let seed, descriptor, masked, ordinal = 0, success = true, boundary = 'SEED_PROVENANCE';
  const disposables = [];
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch (error) {
      result.checks.push({ name, status: 'FAIL', boundary,
        code: ['RESTART_CHECK_FAILED', 'RESTART_TIMEOUT', 'RESTART_COMMAND_TIMEOUT'].includes(error?.message) ? error.message : 'UNEXPECTED_FAILURE' });
      success = false; return false;
    }
  }
  async function recordSnapshot() {
    const names = (await fs.readdir(storage)).filter(name => name === 'soterai-vault.enc' || /^vault-|^write-.*\.enc$/.test(name)).sort();
    demand(names.length === 3);
    const records = [];
    for (const name of names) {
      demand(/^[A-Za-z0-9.-]{1,160}$/.test(name)); const bytes = await read(cohort, path.join(storage, name));
      demand(noCanaries(bytes.toString('utf8'))); records.push({ name, bytes: bytes.length, sha256: sha(bytes) });
    }
    return records;
  }
  async function unchangedMasked() {
    demand(sha(await read(cohort, source, 65536)) === seed.maskedSourceSha256
      && (await read(cohort, example, 65536)).toString('utf8') === safeExample
      && JSON.stringify(await recordSnapshot()) === JSON.stringify(seed.encryptedRecords));
  }
  async function command(stage, choice, id, args) {
    ordinal++;
    const progress = { stage, ordinal, state: 'COMMAND_PENDING' }; result.commandStages.push(progress);
    const output = stage === 'vault-app-output', request = { schemaVersion: 1, runNonce: prepared.runNonce, ordinal, stage, choice,
      ...(output ? { awaitRendererReady: true, expectedOwnedPid: result.appOwnedJob.pid } : {}) };
    if (output) {
      progress.state = 'WAITING_FOR_RENDERER_READY'; boundary = 'OUTPUT_RENDERER_READY';
      await publish(out, `ui-request-${ordinal}.json`, request);
      await until(async () => {
        try {
          const ready = JSON.parse(await read(out, path.join(out, `ui-ready-${ordinal}.json`), 8192));
          demand(ready.schemaVersion === 1 && ready.runNonce === prepared.runNonce && ready.ordinal === ordinal && ready.stage === stage
            && ready.status === 'READY' && ready.taskTerminalPainted === true && ready.pageFocused === true); return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
    }
    boundary = 'PRODUCT_COMMAND'; progress.state = 'COMMAND_PENDING';
    const pending = Promise.resolve(vscode.commands.executeCommand(id, ...args)).then(value => {
      progress.state = 'COMMAND_RETURNED'; return value;
    }, () => { progress.state = 'COMMAND_REJECTED'; throw Error('RESTART_CHECK_FAILED'); });
    if (!output) await publish(out, `ui-request-${ordinal}.json`, request);
    const reply = await Promise.race([pending, delay(25000).then(() => { throw Error('RESTART_COMMAND_TIMEOUT'); })]);
    boundary = 'RENDERER_ACK';
    const ack = await until(async () => {
      try {
        const value = JSON.parse(await read(out, path.join(out, `ui-step-${ordinal}.json`), 8192));
        demand(value.schemaVersion === 1 && value.runNonce === prepared.runNonce && value.ordinal === ordinal && value.stage === stage
          && value.status === 'PASS' && value.realUiInteraction === true); return value;
      } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    });
    progress.state = 'UI_ACK_AND_COMMAND_COMPLETE'; return { reply, ack };
  }
  try {
    if (!await check('exact-installed-extension-activation', async () => {
      const seedBytes = await read(cohort, path.join(cohort, 'host-result.json'), 65536);
      demand(sha(seedBytes) === prepared.seedHostReportSha256); seed = JSON.parse(seedBytes);
      const seedLaunchBytes = await read(cohort, path.join(cohort, 'native-launch.json'), 65536);
      demand(sha(seedLaunchBytes) === prepared.seedLaunchReportSha256);
      const seedLaunch = JSON.parse(seedLaunchBytes);
      demand(seedLaunch.artifactSha256 === prepared.artifactSha256 && seedLaunch.native?.ok === true && seedLaunch.native.code === 'OK'
        && seedLaunch.hostReport?.status === 'PASS_NATIVE_VAULT_APP_SEED');
      const seedPreparation = JSON.parse(await read(cohort, path.join(cohort, 'prepared.json'), 16384));
      const requiredSeed = ['exact-installed-extension-activation', 'vault-migration-cancel-without-write', 'vault-reviewed-migration',
        'vault-encrypted-records-and-safe-example', 'vault-app-reviewed-configuration', 'vault-app-selected-runtime'];
      demand(seed.schemaVersion === 1 && seed.status === 'PASS_NATIVE_VAULT_APP_SEED' && seed.sourceFinalState === 'MASKED'
        && seed.artifactSha256 === prepared.artifactSha256 && seedPreparation.artifactSha256 === prepared.artifactSha256
        && seedPreparation.identity === prepared.identity && seedPreparation.version === prepared.version
        && JSON.stringify(seedPreparation.runtimes) === JSON.stringify(prepared.runtimes)
        && requiredSeed.every(name => seed.checks.some(item => item.name === name && item.status === 'PASS'))
        && seed.checks.every(item => item.status === 'PASS'));
      demand(Number.isInteger(seed.extensionHostPid) && seed.extensionHostPid > 0 && seed.extensionHostPid !== process.pid
        && seed.runNonce !== prepared.runNonce && Number.isInteger(seedLaunch.native.pid) && seedLaunch.native.pid > 0
        && seedLaunch.native.processClosed === true && Number.isFinite(seedLaunch.native.closedAt));
      for (const pid of new Set([seed.extensionHostPid, seedLaunch.native.pid])) {
        let exited = false;
        try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') exited = true; else throw error; }
        demand(exited);
      }
      result.priorExtensionHostExited = true; result.priorOwningAppExited = true;
      result.editorSessionIdChanged = seed.editorSessionId !== vscode.env.sessionId;
      const extension = vscode.extensions.getExtension(prepared.identity); demand(extension);
      demand(within(path.join(cohort, 'profile/extensions'), extension.extensionPath)
        && extension.packageJSON.version === prepared.version && extension.packageJSON.main === './dist/extension.js'
        && extension.packageJSON.publisher + '.' + extension.packageJSON.name === prepared.identity);
      demand(Array.isArray(prepared.runtimes) && prepared.runtimes.length === 4 && new Set(prepared.runtimes.map(item => item.name)).size === 4);
      for (const runtime of prepared.runtimes) {
        demand(runtimes.includes(runtime.name)); const bytes = await read(cohort, path.join(extension.extensionPath, 'dist', runtime.name), 4 * 1024 * 1024);
        demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256);
      }
      boundary = 'ACTIVATION'; await Promise.race([extension.activate(), delay(20000).then(() => { throw Error('RESTART_TIMEOUT'); })]);
      demand(extension.isActive && vscode.workspace.isTrusted && samePath(vscode.workspace.getWorkspaceFolder(sourceUri)?.uri.fsPath, workspace));
      result.installedExtensionVersion = extension.packageJSON.version; result.newEditorSessionVerified = true;
      boundary = 'RENDERER_READY';
      await until(async () => {
        try {
          const ready = JSON.parse(await read(out, path.join(out, 'renderer-ready.json'), 8192));
          demand(ready.schemaVersion === 1 && ready.suite === 'vault-restart' && ready.runNonce === prepared.runNonce && ready.status === 'READY'); return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
    })) return;
    if (!await check('persisted-masked-source-and-ciphertext', async () => {
      boundary = 'PERSISTED_BYTES';
      demand(/^[a-f0-9]{64}$/.test(seed.maskedSourceSha256) && /^[a-f0-9]{64}$/.test(seed.safeExampleSha256));
      await unchangedMasked(); masked = (await read(cohort, source, 65536)).toString('utf8'); demand(noCanaries(masked) && masked !== original);
      demand(sha(await read(cohort, example, 65536)) === seed.safeExampleSha256);
      result.persistedCipherHashesVerified = true;
    })) return;
    if (!await check('persisted-reviewed-app-configuration', async () => {
      boundary = 'PERSISTED_DESCRIPTOR'; const status = await vscode.commands.executeCommand('soterai.vaultAppStatus');
      demand(Array.isArray(status?.descriptors) && status.descriptors.length === 1 && noCanaries(JSON.stringify(status)));
      descriptor = status.descriptors.find(item => item.id === seed.appDescriptorId); demand(descriptor);
      demand(samePath(descriptor.root, workspace) && samePath(descriptor.cwd, workspace) && samePath(descriptor.source, source)
        && samePath(descriptor.program, path.join(workspace, 'app-check.cjs')) && descriptor.programDigest === seed.appProgramDigest
        && sha(await read(cohort, descriptor.program, 65536)) === seed.appProgramDigest
        && Array.isArray(descriptor.args) && descriptor.args.length === 0 && Array.isArray(descriptor.selections) && descriptor.selections.length === 2);
      for (const name of ['DB_PASSWORD', 'API_PASSWORD']) {
        const selection = descriptor.selections.find(item => item.name === name);
        demand(selection && /^\[SOTERAI_PROTECTED_[A-F0-9]{32}_[01]\]$/.test(selection.placeholder)
          && masked.split(/\r?\n/).some(line => line.startsWith(name + '=') && line.includes(selection.placeholder)));
      }
      result.appDescriptorPersisted = true;
    })) return;
    if (!await check('restarted-vault-app-selected-runtime', async () => {
      const before = await vscode.commands.executeCommand('soterai.vaultAppStatus'); demand(Array.isArray(before?.jobs));
      const oldIds = new Set(before.jobs.map(item => item.id)); let taskEnded = false, taskExitCode;
      const taskMatches = task => task?.definition?.type === 'soterai-vault' && task.definition.descriptorId === descriptor.id;
      disposables.push(vscode.tasks.onDidEndTask(event => { if (taskMatches(event.execution.task)) taskEnded = true; }));
      disposables.push(vscode.tasks.onDidEndTaskProcess(event => { if (taskMatches(event.execution.task)) taskExitCode = event.exitCode; }));
      const { reply } = await command('vault-app-run', 'run', 'soterai.runVaultApp', [descriptor.id]);
      demand(reply?.status === 'TASK_REQUESTED' && reply.descriptorId === descriptor.id); boundary = 'NEW_OWNED_JOB_EXIT';
      const exited = await until(async () => {
        const status = await vscode.commands.executeCommand('soterai.vaultAppStatus'); demand(Array.isArray(status?.jobs));
        const fresh = status.jobs.filter(item => !oldIds.has(item.id)); demand(fresh.length <= 1);
        if (fresh[0]?.state !== 'EXITED') return false;
        demand(fresh[0].id !== seed.appOwnedJob.id && fresh[0].exitCode === 0 && Number.isInteger(fresh[0].pid)
          && fresh[0].pid > 0 && fresh[0].pid !== seed.appOwnedJob.pid); return fresh[0];
      }, 30000);
      result.appOwnedJob = { id: exited.id, state: exited.state, pid: exited.pid, exitCode: exited.exitCode }; result.appOwnedJobExitVerified = true;
      await publish(out, 'app-owned-job.json', { schemaVersion: 1, runNonce: prepared.runNonce, artifactSha256: prepared.artifactSha256, ownedJob: result.appOwnedJob });
      boundary = 'TASK_COMPLETION'; await until(() => taskEnded, 15000); demand(taskExitCode === undefined || taskExitCode === 0); result.appTaskCompleted = true;
      const terminals = vscode.window.terminals.filter(item => item.name.includes('app-check.cjs') && item.name.includes(descriptor.id.slice(0, 8)));
      demand(terminals.length === 1); terminals[0].show(false); await until(() => vscode.window.activeTerminal === terminals[0]);
      const { ack } = await command('vault-app-output', 'verify-output', 'workbench.action.terminal.focusAccessibleBuffer', []);
      demand(ack.fixedOutputSuccessMatched === true && ack.fixedOutputFailureMatched === false && ack.outputSource === 'native-terminal-accessible-view');
      demand(ack.currentOwnedPidMatched === true && ack.expectedOwnedPid === exited.pid);
      result.appOutputVerified = true;
      await publish(out, 'app-visible-output.json', { schemaVersion: 1, runNonce: prepared.runNonce, artifactSha256: prepared.artifactSha256,
        fixedOutputSuccessMatched: true, fixedOutputFailureMatched: false, outputSource: 'native-terminal-accessible-view' });
      boundary = 'POST_APP_BYTES'; await unchangedMasked(); result.appRuntimeTested = true;
    })) return;
    if (!await check('restart-restore-cancel-without-write', async () => {
      await command('vault-restore-cancel', 'cancel', 'soterai.restoreSecretPlaceholders', [sourceUri]); boundary = 'CANCEL_BYTES'; await unchangedMasked();
    })) return;
    if (!await check('restart-reviewed-raw-restoration', async () => {
      await command('vault-restore-approve', 'restore', 'soterai.restoreSecretPlaceholders', [sourceUri]); boundary = 'RESTORED_BYTES';
      demand((await read(cohort, source, 65536)).toString('utf8') === original
        && (await read(cohort, example, 65536)).toString('utf8') === safeExample
        && JSON.stringify(await recordSnapshot()) === JSON.stringify(seed.encryptedRecords));
      result.encryptedKeyPersistenceVerified = true;
    })) return;
    if (success) { result.gracefulRestartTested = true; result.status = 'PASS_NATIVE_VAULT_RESTART'; }
  } finally {
    for (const disposable of disposables) disposable.dispose();
    try {
      const value = (await read(cohort, source, 65536)).toString('utf8');
      result.sourceFinalState = value === original ? 'ORIGINAL_SYNTHETIC' : masked && value === masked ? 'MASKED' : 'OTHER';
    } catch { result.sourceFinalState = 'UNAVAILABLE'; }
    // No test rollback occurs. Actual UI-approved product operations own writes.
    await publish(out, 'host-result.json', result);
  }
  demand(result.status === 'PASS_NATIVE_VAULT_RESTART');
};
