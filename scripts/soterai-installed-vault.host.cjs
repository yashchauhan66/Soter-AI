'use strict';
// Actual installed-product commands and VS Code APIs. The renderer answers
// native editor dialogs through their real UI controls; no product mocks.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const demand = value => { if (!value) throw Error('VAULT_CHECK_FAILED'); };
const sha = value => createHash('sha256').update(value).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const original = 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n';
const canaries = ['BlueMango7!', 'OrangeRiver9!'];
const noCanaries = value => canaries.every(canary => !value.includes(canary));
const expectedRuntimes = ['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'];
async function until(test, budget = 20000) {
  const end = Date.now() + budget;
  while (Date.now() < end) { const value = await test(); if (value) return value; await delay(100); }
  throw Error('VAULT_TIMEOUT');
}
function within(root, target) {
  const relative = path.relative(root, target);
  return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}
const sameLocalPath = (left, right) => typeof left === 'string' && typeof right === 'string'
  && (process.platform === 'win32' ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() : path.resolve(left) === path.resolve(right));
async function ordinaryRead(root, file, maximum = 2 * 1024 * 1024) {
  root = path.resolve(root); file = path.resolve(file);
  demand(within(root, file));
  const rootReal = await fs.realpath(root), fileReal = await fs.realpath(file);
  demand(within(rootReal, fileReal));
  let cursor = file, reachedRoot = false;
  for (let steps = 0; steps < 256; steps++) {
    if (sameLocalPath(cursor, root)) { reachedRoot = true; break; }
    if (!within(root, cursor)) throw Error('VAULT_PARENT_SCOPE');
    const stat = await fs.lstat(cursor); demand(!stat.isSymbolicLink());
    const parent = path.dirname(cursor);
    if (sameLocalPath(parent, cursor)) throw Error('VAULT_PARENT_TERMINATION');
    cursor = parent;
  }
  if (!reachedRoot) throw Error('VAULT_PARENT_WALK_LIMIT');
  const before = await fs.lstat(file);
  demand(before.isFile() && before.nlink === 1 && before.size <= maximum);
  const bytes = await fs.readFile(file), after = await fs.lstat(file);
  demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && before.ino === after.ino
    && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && bytes.length === before.size);
  return bytes;
}
async function absent(file) {
  try { await fs.lstat(file); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}
async function publishJSON(out, name, value) {
  demand(/^[A-Za-z0-9.-]+\.json$/.test(name));
  const target = path.join(out, name), temporary = path.join(out, 'publish-' + randomUUID() + '.tmp');
  demand(await absent(target));
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  // Readers see a complete closed ordinary file after one rename. Evidence is
  // create-only; old targets are checked again immediately before publication.
  demand(await absent(target));
  await fs.rename(temporary, target);
}
function cipherPayload(bytes) {
  const text = bytes.toString('utf8');
  demand(/^[A-Za-z0-9+/]+={0,2}$/.test(text) && noCanaries(text));
  const decoded = Buffer.from(text, 'base64');
  demand(decoded.length > 28 && decoded.toString('base64') === text && noCanaries(decoded.toString('utf8')));
  return sha(bytes);
}
exports.run = async function () {
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out));
  const prepared = JSON.parse(await ordinaryRead(out, path.join(out, 'prepared.json'), 16384));
  demand(prepared.schemaVersion === 1 && ['vault', 'vault-app', 'vault-app-seed'].includes(prepared.suite) && /^[a-f0-9]{32}$/.test(prepared.runNonce));
  demand(prepared.identity === 'soterai.soterai-ide-guard' && /^[a-f0-9]{64}$/.test(prepared.artifactSha256));
  const seedSuite = prepared.suite === 'vault-app-seed', appSuite = prepared.suite !== 'vault';
  const passStatus = seedSuite ? 'PASS_NATIVE_VAULT_APP_SEED' : appSuite ? 'PASS_NATIVE_VAULT_APP_WORKFLOW' : 'PASS_NATIVE_VAULT_WORKFLOW';
  const workspace = path.join(out, 'workspace'), source = path.join(workspace, '.env'), example = path.join(workspace, '.env.example');
  const storage = path.join(out, 'profile/user-data/User/globalStorage', prepared.identity);
  const sourceUri = vscode.Uri.file(source);
  const result = { schemaVersion: 1, status: appSuite ? 'FAIL_NATIVE_VAULT_APP_WORKFLOW' : 'FAIL_NATIVE_VAULT_WORKFLOW', artifactSha256: prepared.artifactSha256,
    editorVersion: vscode.version, editorSessionId: vscode.env.sessionId, extensionHostPid: process.pid,
    extensionHostParentPid: process.ppid, extensionHostStartedAtEstimate: Date.now() - process.uptime() * 1000,
    runNonce: prepared.runNonce, suite: prepared.suite, checks: [], uiAutomation: true,
    sourceFixturePath: 'workspace/.env', encryptedStoragePath: 'profile/user-data/User/globalStorage/' + prepared.identity,
    sameSessionRestorationTested: false, interruptedRecoveryTested: false, upgradeRecoveryTested: false,
    appRuntimeTested: false, osSecretCustodyCertified: false, realProviderTested: false, independentHumanReview: false,
    seedOnly: seedSuite, gracefulRestartTested: false, clipboardModifiedByTest: false, commandStages: [], releaseReady: false };
  let ordinal = 0, success = true, masked, recordsAfterMigration, appDescriptor, appProgramDigest, outputOwnedPid;
  const selectedPlaceholders = [], disposables = [];
  let lastBoundary = 'PREPARATION';
  const failureCodes = new Set(['VAULT_CHECK_FAILED', 'VAULT_TIMEOUT', 'VAULT_COMMAND_TIMEOUT', 'ACTIVATION_TIMEOUT',
    'VAULT_PARENT_SCOPE', 'VAULT_PARENT_TERMINATION', 'VAULT_PARENT_WALK_LIMIT']);
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch (error) {
      result.checks.push({ name, status: 'FAIL', code: failureCodes.has(error?.message) ? error.message : 'UNEXPECTED_FAILURE', boundary: lastBoundary });
      success = false; return false;
    }
  }
  async function records() {
    if (await absent(storage)) return [];
    demand(within(await fs.realpath(out), await fs.realpath(storage)) && !within(await fs.realpath(workspace), await fs.realpath(storage)));
    const names = await fs.readdir(storage); demand(names.length < 256);
    const selected = names.filter(name => name === 'soterai-vault.enc' || /^vault-|^write-.*\.enc$/.test(name)).sort();
    const snapshot = [];
    for (const name of selected) {
      demand(/^[A-Za-z0-9.-]{1,160}$/.test(name));
      const bytes = await ordinaryRead(out, path.join(storage, name));
      demand(noCanaries(bytes.toString('utf8')));
      snapshot.push({ name, bytes: bytes.length, sha256: sha(bytes) });
    }
    return snapshot;
  }
  async function choose(stage, choice, command, args = [sourceUri], budget = 25000) {
    ordinal++;
    const commandStage = { stage, ordinal, state: 'COMMAND_PENDING' };
    result.commandStages.push(commandStage);
    const outputHandshake = stage === 'vault-app-output';
    const request = { schemaVersion: 1, runNonce: prepared.runNonce, ordinal, stage, choice,
      ...(outputHandshake ? { awaitRendererReady: true, ...(seedSuite ? { expectedOwnedPid: outputOwnedPid } : {}) } : {}) };
    if (outputHandshake) {
      commandStage.state = 'WAITING_FOR_RENDERER_READY';
      lastBoundary = 'OUTPUT_RENDERER_READY';
      await publishJSON(out, `ui-request-${ordinal}.json`, request);
      await until(async () => {
        try {
          const ready = JSON.parse(await ordinaryRead(out, path.join(out, `ui-ready-${ordinal}.json`), 8192));
          demand(ready.schemaVersion === 1 && ready.runNonce === prepared.runNonce && ready.ordinal === ordinal && ready.stage === stage
            && ready.status === 'READY' && ready.taskTerminalPainted === true && ready.pageFocused === true);
          result.appOutputUiReady = true; return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
      commandStage.state = 'COMMAND_PENDING';
    }
    lastBoundary = 'PRODUCT_COMMAND';
    const pending = Promise.resolve(vscode.commands.executeCommand(command, ...args)).then(value => {
      commandStage.state = 'COMMAND_RETURNED';
      commandStage.resultKind = value === undefined ? 'UNDEFINED' : value === null ? 'NULL' : typeof value;
      return value;
    }, () => { commandStage.state = 'COMMAND_REJECTED'; throw Error('VAULT_CHECK_FAILED'); });
    if (!outputHandshake) await publishJSON(out, `ui-request-${ordinal}.json`, request);
    const reply = await Promise.race([pending, delay(budget).then(() => {
      if (commandStage.state === 'COMMAND_PENDING') commandStage.state = 'COMMAND_TIMEOUT';
      throw Error('VAULT_COMMAND_TIMEOUT');
    })]);
    lastBoundary = 'RENDERER_ACK';
    let acknowledgement;
    await until(async () => {
      try {
        const ack = JSON.parse(await ordinaryRead(out, path.join(out, `ui-step-${ordinal}.json`), 8192));
        demand(ack.schemaVersion === 1 && ack.status === 'PASS' && ack.stage === stage && ack.ordinal === ordinal
          && ack.runNonce === prepared.runNonce && ack.realUiInteraction === true);
        acknowledgement = ack;
        return true;
      } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    });
    commandStage.state = 'UI_ACK_AND_COMMAND_COMPLETE';
    lastBoundary = 'DISK_ORACLE';
    return { reply, acknowledgement };
  }
  try {
    if (!await check('exact-installed-extension-activation', async () => {
      const extension = vscode.extensions.getExtension(prepared.identity); demand(extension);
      lastBoundary = 'INSTALLED_IDENTITY';
      demand(within(path.join(out, 'profile/extensions'), extension.extensionPath));
      demand(extension.packageJSON.version === prepared.version && extension.packageJSON.name === 'soterai-ide-guard'
        && extension.packageJSON.publisher === 'soterai' && extension.packageJSON.main === './dist/extension.js');
      demand(Array.isArray(prepared.runtimes) && prepared.runtimes.length === expectedRuntimes.length
        && new Set(prepared.runtimes.map(runtime => runtime.name)).size === expectedRuntimes.length);
      for (const runtime of prepared.runtimes) {
        demand(expectedRuntimes.includes(runtime.name));
        const bytes = await ordinaryRead(out, path.join(extension.extensionPath, 'dist', runtime.name), 4 * 1024 * 1024);
        demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256);
      }
      lastBoundary = 'ACTIVATION';
      await Promise.race([extension.activate(), delay(20000).then(() => { throw Error('ACTIVATION_TIMEOUT'); })]);
      demand(extension.isActive && vscode.workspace.isTrusted);
      const configuration = vscode.workspace.getConfiguration('soterai');
      result.prerequisites = {
        workspaceTrusted: vscode.workspace.isTrusted,
        remoteWorkspace: !!vscode.env.remoteName,
        vaultModeEnabled: configuration.get('lite.vaultMode') === true,
        restrictionSaveEnabled: configuration.get('lite.restrictionSave') === true,
        startupAutoMigrationEnabled: configuration.get('autoVaultMigration.enabled') === true,
        customDialogStyle: vscode.workspace.getConfiguration('window').get('dialogStyle') === 'custom',
      };
      lastBoundary = 'INITIAL_FIXTURE';
      demand(vscode.workspace.getWorkspaceFolder(sourceUri)?.uri.fsPath.toLowerCase() === workspace.toLowerCase());
      demand((await ordinaryRead(out, source, 65536)).toString('utf8') === original && await absent(example) && !(await records()).length);
      result.installedExtensionVersion = extension.packageJSON.version;
      lastBoundary = 'RENDERER_READY';
      await until(async () => {
        try {
          const ready = JSON.parse(await ordinaryRead(out, path.join(out, 'renderer-ready.json'), 8192));
          demand(ready.schemaVersion === 1 && ready.status === 'READY' && ready.runNonce === prepared.runNonce && ready.suite === prepared.suite);
          return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
    })) return;
    if (!await check('vault-migration-cancel-without-write', async () => {
      await choose('vault-migrate-cancel', 'cancel', 'soterai.migrateSecretsToVault');
      demand((await ordinaryRead(out, source, 65536)).toString('utf8') === original && await absent(example) && !(await records()).length);
    })) return;
    if (!await check('vault-reviewed-migration', async () => {
      await choose('vault-migrate-approve', 'migrate', 'soterai.migrateSecretsToVault');
      masked = (await ordinaryRead(out, source, 65536)).toString('utf8'); demand(masked !== original && noCanaries(masked));
      const rows = masked.trimEnd().split(/\r?\n/), placeholders = [];
      demand(rows.length === 2);
      for (let index = 0; index < rows.length; index++) {
        const name = index === 0 ? 'DB_PASSWORD' : 'API_PASSWORD';
        const match = new RegExp('^' + name + '=(?:"(\\[SOTERAI_PROTECTED_[A-F0-9]{32}_[01]\\])"|(\\[SOTERAI_PROTECTED_[A-F0-9]{32}_[01]\\]))$').exec(rows[index]);
        demand(match); placeholders.push(match[1] || match[2]);
        selectedPlaceholders.push({ name, placeholder: match[1] || match[2] });
      }
      demand(new Set(placeholders).size === 2);
      result.placeholderCount = placeholders.length;
      result.maskedSourceSha256 = sha(Buffer.from(masked, 'utf8'));
    })) return;
    if (!await check('vault-encrypted-records-and-safe-example', async () => {
      const exampleText = (await ordinaryRead(out, example, 65536)).toString('utf8');
      demand(exampleText === 'DB_PASSWORD=\nAPI_PASSWORD=\n' && noCanaries(exampleText));
      recordsAfterMigration = await records();
      demand(recordsAfterMigration.length === 3 && recordsAfterMigration.some(item => item.name === 'soterai-vault.enc'));
      const generation = recordsAfterMigration.find(item => /^vault-generation-[a-f0-9-]{36}\.enc$/.test(item.name));
      const pointer = recordsAfterMigration.find(item => /^vault-source-[a-f0-9]{32}\.json$/.test(item.name));
      demand(generation && pointer && await absent(path.join(storage, 'vault-pending.json')) && await absent(path.join(storage, 'vault-mutation.lock')));
      cipherPayload(await ordinaryRead(out, path.join(storage, 'soterai-vault.enc')));
      cipherPayload(await ordinaryRead(out, path.join(storage, generation.name)));
      const binding = JSON.parse(await ordinaryRead(out, path.join(storage, pointer.name), 16384));
      demand(binding.schemaVersion === 1 && typeof binding.id === 'string' && generation.name === 'vault-generation-' + binding.id + '.enc'
        && binding.source === sourceUri.toString() && binding.root === vscode.Uri.file(workspace).toString() && binding.digest === generation.sha256);
      result.encryptedRecords = recordsAfterMigration;
      result.safeExampleVerified = true;
      result.safeExampleSha256 = sha(Buffer.from(exampleText, 'utf8'));
    })) return;
    if (appSuite) {
      if (!await check('vault-app-reviewed-configuration', async () => {
        lastBoundary = 'APP_FIXTURE';
        const app = path.join(workspace, 'app-check.cjs'), program = await ordinaryRead(out, app, 65536);
        demand(noCanaries(program.toString('utf8')) && program.toString('utf8').includes('VAULT_APP_OK='));
        appProgramDigest = sha(program);
        if (prepared.appFixtureSha256 !== undefined) demand(prepared.appFixtureSha256 === appProgramDigest);
        const prior = await vscode.commands.executeCommand('soterai.vaultAppStatus');
        demand(Array.isArray(prior?.descriptors) && prior.descriptors.length === 0 && Array.isArray(prior.jobs) && prior.jobs.length === 0);
        lastBoundary = 'APP_CONFIGURE_UI';
        const { reply, acknowledgement } = await choose('vault-app-configure', 'configure', 'soterai.configureVaultApp', [], 60000);
        demand(reply?.saved === true && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reply.id));
        demand(acknowledgement.programFileSelected === true && acknowledgement.sourceFileSelected === true
          && acknowledgement.selectedVariableCount === 2 && acknowledgement.publicArgumentsAccepted === true);
        const status = await vscode.commands.executeCommand('soterai.vaultAppStatus');
        demand(Array.isArray(status?.descriptors) && status.descriptors.length === 1 && noCanaries(JSON.stringify(status)));
        appDescriptor = status.descriptors.find(descriptor => descriptor.id === reply.id); demand(appDescriptor);
        demand(appDescriptor.schemaVersion === 1 && sameLocalPath(appDescriptor.program, app) && sameLocalPath(appDescriptor.root, workspace)
          && sameLocalPath(appDescriptor.cwd, workspace) && sameLocalPath(appDescriptor.source, source) && appDescriptor.programDigest === appProgramDigest
          && Array.isArray(appDescriptor.args) && appDescriptor.args.length === 0 && Array.isArray(appDescriptor.selections)
          && appDescriptor.selections.length === 2 && selectedPlaceholders.every(selection => appDescriptor.selections.some(item =>
            item.name === selection.name && item.placeholder === selection.placeholder)));
        result.appDescriptorId = appDescriptor.id;
        result.appProgramDigest = appProgramDigest;
      })) return;
      if (!await check('vault-app-selected-runtime', async () => {
        const before = await vscode.commands.executeCommand('soterai.vaultAppStatus');
        demand(Array.isArray(before?.jobs)); const priorIds = new Set(before.jobs.map(job => job.id));
        let taskEnded = false, taskExitCode;
        const matchesTask = task => task?.definition?.type === 'soterai-vault' && task.definition.descriptorId === appDescriptor.id;
        disposables.push(vscode.tasks.onDidEndTask(event => { if (matchesTask(event.execution.task)) taskEnded = true; }));
        disposables.push(vscode.tasks.onDidEndTaskProcess(event => { if (matchesTask(event.execution.task)) taskExitCode = event.exitCode; }));
        lastBoundary = 'APP_RUN_UI';
        const { reply } = await choose('vault-app-run', 'run', 'soterai.runVaultApp', [appDescriptor.id]);
        demand(reply?.status === 'TASK_REQUESTED' && reply.descriptorId === appDescriptor.id);
        lastBoundary = 'OWNED_JOB_EXIT';
        const exited = await until(async () => {
          const status = await vscode.commands.executeCommand('soterai.vaultAppStatus'); demand(Array.isArray(status?.jobs));
          const fresh = status.jobs.filter(job => !priorIds.has(job.id)); demand(fresh.length <= 1);
          if (fresh[0]?.state !== 'EXITED') return false;
          demand(fresh[0].exitCode === 0 && Number.isInteger(fresh[0].pid) && fresh[0].pid > 0); return fresh[0];
        }, 30000);
        result.appOwnedJob = { id: exited.id, state: exited.state, pid: exited.pid, exitCode: exited.exitCode };
        outputOwnedPid = exited.pid;
        result.appOwnedJobExitVerified = true;
        result.appOutputVerified = false;
        await publishJSON(out, 'app-owned-job.json', { schemaVersion: 1, runNonce: prepared.runNonce,
          artifactSha256: prepared.artifactSha256, descriptorId: appDescriptor.id, ownedJob: result.appOwnedJob });
        lastBoundary = 'TASK_COMPLETION';
        await until(() => taskEnded, 15000); demand(taskExitCode === undefined || taskExitCode === 0);
        result.appTaskCompleted = true;
        await publishJSON(out, 'app-task-completion.json', { schemaVersion: 1, runNonce: prepared.runNonce,
          artifactSha256: prepared.artifactSha256, descriptorId: appDescriptor.id, taskCompleted: true,
          taskProcessExitReported: taskExitCode !== undefined, ...(taskExitCode !== undefined ? { taskProcessExitCode: taskExitCode } : {}) });
        const terminals = vscode.window.terminals.filter(terminal => terminal.name.includes('app-check.cjs') && terminal.name.includes(appDescriptor.id.slice(0, 8)));
        demand(terminals.length === 1); terminals[0].show(false);
        lastBoundary = 'ACTIVE_TASK_TERMINAL';
        await until(() => vscode.window.activeTerminal === terminals[0]);
        lastBoundary = 'APP_TERMINAL_OUTPUT';
        const { acknowledgement } = await choose('vault-app-output', 'verify-output', 'workbench.action.terminal.focusAccessibleBuffer', []);
        demand(acknowledgement.fixedOutputSuccessMatched === true && acknowledgement.fixedOutputFailureMatched === false
          && acknowledgement.outputSource === 'native-terminal-accessible-view');
        if (seedSuite) demand(acknowledgement.currentOwnedPidMatched === true && acknowledgement.expectedOwnedPid === exited.pid);
        result.appOutputVerified = true;
        await publishJSON(out, 'app-visible-output.json', { schemaVersion: 1, runNonce: prepared.runNonce,
          artifactSha256: prepared.artifactSha256, fixedOutputSuccessMatched: true, fixedOutputFailureMatched: false,
          outputSource: 'native-terminal-accessible-view' });
        for (const [name, oracle] of [
          ['source-masked', async () => (await ordinaryRead(out, source, 65536)).toString('utf8') === masked],
          ['app-digest', async () => sha(await ordinaryRead(out, appDescriptor.program, 65536)) === appProgramDigest],
          ['vault-records', async () => JSON.stringify(await records()) === JSON.stringify(recordsAfterMigration)],
        ]) {
          lastBoundary = 'POST_OUTPUT_' + name.toUpperCase().replaceAll('-', '_');
          await publishJSON(out, 'post-output-' + name + '-started.json', { schemaVersion: 1, runNonce: prepared.runNonce, oracle: name, state: 'STARTED' });
          demand(await oracle());
          await publishJSON(out, 'post-output-' + name + '-result.json', { schemaVersion: 1, runNonce: prepared.runNonce, oracle: name, status: 'PASS' });
        }
        result.appRuntimeTested = true;
      })) return;
    }
    if (seedSuite) {
      demand((await ordinaryRead(out, source, 65536)).toString('utf8') === masked);
      if (success) result.status = passStatus;
      return;
    }
    if (!await check('vault-restore-cancel-without-write', async () => {
      await choose('vault-restore-cancel', 'cancel', 'soterai.restoreSecretPlaceholders');
      demand((await ordinaryRead(out, source, 65536)).toString('utf8') === masked
        && JSON.stringify(await records()) === JSON.stringify(recordsAfterMigration)
        && (await ordinaryRead(out, example, 65536)).toString('utf8') === 'DB_PASSWORD=\nAPI_PASSWORD=\n');
    })) return;
    if (!await check('vault-reviewed-raw-restoration', async () => {
      await choose('vault-restore-approve', 'restore', 'soterai.restoreSecretPlaceholders');
      demand((await ordinaryRead(out, source, 65536)).toString('utf8') === original
        && JSON.stringify(await records()) === JSON.stringify(recordsAfterMigration)
        && (await ordinaryRead(out, example, 65536)).toString('utf8') === 'DB_PASSWORD=\nAPI_PASSWORD=\n');
      result.sameSessionRestorationTested = true;
    })) return;
    if (success) result.status = passStatus;
  } finally {
    for (const disposable of disposables) disposable.dispose();
    // The host never writes/rolls back the source. On failure, retain the
    // product's current fixture and encrypted records for review/recovery.
    try {
      const finalText = (await ordinaryRead(out, source, 65536)).toString('utf8');
      result.sourceFinalState = finalText === original ? 'ORIGINAL_SYNTHETIC' : masked && finalText === masked ? 'MASKED' : 'OTHER';
    } catch { result.sourceFinalState = 'UNAVAILABLE'; }
    await publishJSON(out, 'host-result.json', result);
  }
  demand(result.status === passStatus);
};
