'use strict';
// INERT separately declared observer for REAL installed prior0.6.3 only.
// It never imports product code, intercepts prompts or reads product SecretStorage.
const vscode = require('vscode'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');
const { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');
const OLD_SHA = 'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677';
const OMITTED = '[AI-forbidden content omitted by SoterAI]';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
async function until(fn, bound) {
  const start = Date.now();
  while (Date.now() - start < bound) { const value = await fn(); if (value) return value; await new Promise(done => setTimeout(done, 80)); }
  throw Error('Bounded actual old product/UI readiness expired');
}
function fact(file) {
  const before = fs.lstatSync(file);
  assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 16 * 1024 * 1024);
  const raw = fs.readFileSync(file), after = fs.lstatSync(file);
  assert.equal(raw.length, before.size); assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs);
  return { path: file, bytes: raw.length, sha256: sha(raw) };
}
function pin(row) {
  const actual = fact(row.path);
  assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256);
  return actual;
}
let observedStage = 'PRELUDE';
function safeDiagnostic(error) {
  const result = { stage: observedStage };
  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack.slice(0,8192) : '';
  const match = stack.match(/(?:observer\.cjs|installed-(?:upgrade-old-)?observer-proposed-0[1-9]\.cjs):([0-9]{1,6}):([0-9]{1,5})/);
  if (match) { result.sourceLine = Number(match[1]); result.sourceColumn = Number(match[2]); }
  return result;
}
async function awaitReviewedTrust(b) {
  observedStage = 'NATIVE_TRUST_HANDSHAKE';
  write(path.join(b.gate,b.phase+'-trust-before.json'),collectTrustSnapshot(vscode));
  const expected = b.trustChoice !== "No, I don't trust the authors";
  if (b.trustChoice) {
    const target = path.join(b.gate,b.phase+'-trust-choice.json');
    const actual = await until(()=>fs.existsSync(target)&&read(target),90000,'Real native trust keyboard receipt missing');
    assert.equal(actual.status,'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE');
    assert.equal(actual.choice,b.trustChoice); assert.equal(actual.workspaceName,path.basename(b.workspace));
    assert.equal(actual.signalsRequested,0);
  }
  await until(()=>vscode.workspace.isTrusted===expected,90000,'Native workspace trust state has not settled');
  write(path.join(b.gate,b.phase+'-trust-after.json'),collectTrustSnapshot(vscode));
}
exports.activate = context => {
  void run(context).catch(async error => {
    try {
      const b = read(process.env.SOTERAI_F32_BINDING);
      write(path.join(b.gate, 'upgrade-old-observer-failure.json'), {
        schemaVersion: 1, feature: 'F32', status: 'FAIL_NO_RETRY', phase: 'upgrade-old',
        errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error),
        trust: collectTrustSnapshot(vscode), signalsRequested: 0,
      });
      await vscode.commands.executeCommand('workbench.action.closeWindow');
    } catch { /* No force close, signal, assumed EOF or automatic retry. */ }
  });
};
async function run(context) {
  const b = read(process.env.SOTERAI_F32_BINDING);
  assert.equal(process.platform, 'win32');
  assert.equal(b.schemaVersion, 1); assert.equal(b.feature, 'F32');
  assert.equal(b.status, 'REVIEWED_ONE_NORMAL_ROUND'); assert.equal(b.phase, 'upgrade-old');
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(b.runRoot));
  for (const key of ['profile', 'extensions', 'workspace', 'observerRoot']) assert(inside(b.runRoot, b[key]));
  assert(inside(b.profile, b.gate));
  for (const key of ['retainedInputsPath', 'retainedGeneratedPath', 'restartExpectedPath']) assert(inside(b.runRoot, b[key]));
  assert(inside(b.workspace, b.deniedFile) && path.basename(b.deniedFile) === 'denied.txt');
  assert(inside(b.workspace, b.envFile) && path.basename(b.envFile) === '.env');
  assert(/^SOTERAI_F32_SYNTHETIC_[A-Z0-9_]{8,80}$/.test(b.syntheticCanary));
  assert.equal(context.extension.id, 'soterai-fixture.f32-installed-observer');
  assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
  assert(same(context.extensionUri.fsPath, b.observerRoot));
  assert.equal(vscode.env.remoteName, undefined); await awaitReviewedTrust(b); assert.equal(vscode.workspace.isTrusted, true);
  assert.equal(vscode.workspace.workspaceFolders?.length, 1);
  assert(same(vscode.workspace.workspaceFolders[0].uri.fsPath, b.workspace));
  const product = vscode.extensions.getExtension('soterai.soterai-ide-guard'), observations = [];
  const check = async (id, title, action) => { observedStage=id; await action(); observations.push({ id, title, status: 'PASS' }); };
  const native = (id, ...args) => vscode.commands.executeCommand(id, ...args);
  let installedManifest, generated;
  await check('U01', 'Real prior0.6.3 identity resolves to isolated CLI installation', () => {
    assert(product && inside(b.extensions, product.extensionPath));
    assert.equal(product.packageJSON.version, '0.6.3');
    assert.equal(product.id, 'soterai.soterai-ide-guard');
    assert.equal(b.vsix.sha256, OLD_SHA); assert.equal(b.vsix.bytes, 4446653);
    assert(inside(b.runRoot, b.vsix.path)); pin(b.vsix);
  });
  await check('U02', 'Old installed manifest permits only reviewed vendor installer metadata', () => {
    assert(inside(b.runRoot, b.product.manifest.path));
    installedManifest = admitInstalledManifest({
      original: b.product.manifest, installedPath: path.join(product.extensionPath, 'package.json'),
      installStartedWallMs: b.installStartedWallMs, installCompletedWallMs: b.installCompletedWallMs,
      targetPlatform: b.product.targetPlatform, payloadUncompressedBytes: b.product.payloadUncompressedBytes,
    });
  });
  await check('U03', 'Three actual prior payload runtimes remain byte exact', () => {
    assert.equal(b.product.runtimes.length, 3);
    for (const row of b.product.runtimes) {
      assert(/^dist\/[a-z0-9-]+\.js$/.test(row.relative));
      const actual = fact(path.join(product.extensionPath, row.relative));
      assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256);
    }
  });
  await check('U04', 'Default old activation honors preexisting safe USER settings', async () => {
    const config = vscode.workspace.getConfiguration('soterai');
    for (const key of ['broker.autoStart', 'autoVaultMigration.enabled', 'cloud.enabled']) {
      assert.equal(config.inspect(key)?.globalValue, false); assert.equal(config.get(key), false);
    }
    assert.equal(config.get('privacyMode'), 'local'); assert.equal(config.get('telemetry.redactedEvents'), 'off');
    for (const key of ['broker.openAIProviderUrl', 'broker.anthropicProviderUrl']) assert.equal(config.get(key), '');
    assert(Number.isSafeInteger(b.launchWallMs) && b.launchWallMs <= Date.now());
    await until(() => product.isActive, Math.max(1, 120000 - (Date.now() - b.launchWallMs)));
    const commands = await vscode.commands.getCommands(true);
    for (const id of ['soterai.blockFromAI', 'soterai.openRedactedPreview', 'soterai.migrateSecretsToVault']) assert(commands.includes(id));
    write(path.join(b.gate, 'upgrade-old-onboarding-timing.json'), {
      elapsedMs: Date.now() - b.launchWallMs, actualDefaultActivation: true,
      adminPrompts: 'OUTER_NATIVE_OBSERVATION_REQUIRED', productExtraInstalls: 'OUTER_CLI_INVENTORY_REQUIRED',
    });
    assert(Date.now() - b.launchWallMs < 120000);
  });
  await check('U05', 'Actual old public void-returning manual deny changes the real preview', async () => {
    await native('soterai.openRedactedPreview', vscode.Uri.file(b.deniedFile));
    assert.equal(vscode.window.activeTextEditor.document.getText(), fs.readFileSync(b.deniedFile, 'utf8'));
    // Verified prior bundle: blockFromAI awaits workspaceState.update but returns
    // no status. Its actual preview consequence, not void, is the proof.
    assert.equal(await native('soterai.blockFromAI', vscode.Uri.file(b.deniedFile)), undefined);
    await native('soterai.openRedactedPreview', vscode.Uri.file(b.deniedFile));
    assert.equal(vscode.window.activeTextEditor.document.uri.scheme, 'soterai-redacted');
    assert.equal(vscode.window.activeTextEditor.document.getText(), OMITTED);
  });
  await check('U06', 'Actual old native migration produces real old vault and encrypted backup', async () => {
    const envBefore = fs.readFileSync(b.envFile, 'utf8');
    assert.equal(envBefore, 'API_KEY=' + b.syntheticCanary + '\n');
    // Old command does not accept a URI. Select ONLY the declared synthetic file
    // using real public native editor APIs; no raw data enters fixture evidence.
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(b.envFile)));
    const nonce = crypto.randomBytes(16).toString('hex'), request = path.join(b.gate, 'upgrade-old-ui-1.json');
    write(request, {
      schemaVersion: 1, feature: 'F32', phase: 'upgrade-old', number: 1, nonce,
      workspaceName: path.basename(b.workspace), syntheticOnly: true, signalsRequested: 0,
      steps: [{ kind: 'modal',
        contains: 'Migrate 1 secret(s) from .env into the protected vault? An encrypted backup (outside the workspace) will be created.',
        button: 'Migrate & Backup' }],
    });
    const work = native('soterai.migrateSecretsToVault');
    const done = await until(() => fs.existsSync(request + '.done.json') && read(request + '.done.json'), 90000);
    assert.equal(done.nonce, nonce); assert.equal(done.status, 'OBSERVED_REAL_KEYBOARD'); await work;
    const envAfter = fs.readFileSync(b.envFile, 'utf8');
    assert.notEqual(envAfter, envBefore); assert(!envAfter.includes(b.syntheticCanary));
    const storage = path.join(b.profile, 'User', 'globalStorage', 'soterai.soterai-ide-guard');
    const backup = path.join(storage, 'backups', sha(Buffer.from(vscode.Uri.file(b.envFile).toString())).slice(0, 32) + '.enc');
    generated = [fact(path.join(storage, 'soterai-vault.enc')), fact(backup), fact(b.envFile)];
    for (const row of generated.slice(0, 2)) {
      assert(row.bytes > 0); assert(!fs.readFileSync(row.path).includes(Buffer.from(b.syntheticCanary)));
    }
  });
  let retained;
  await check('U07', 'Persisted old policy files and genuine old ciphertext are frozen before normal close', () => {
    const initial = read(b.retainedInputsPath);
    assert(initial.files.length >= 2 && initial.files.length <= 8);
    const relative = initial.files.map(row => path.relative(b.workspace, row.path).replace(/\\/g, '/'));
    assert(relative.includes('.aiignore') && relative.includes('.soterai/policy.json'));
    for (const row of initial.files) { assert(inside(b.workspace, row.path)); pin(row); }
    retained = [...initial.files, ...generated];
  });
  write(path.join(b.gate, 'upgrade-old-observer-results.json'), {
    schemaVersion: 1, feature: 'F32', phase: 'upgrade-old', status: 'PASS_SCOPED_OLD_INSTALLED_SEED',
    oldVersion: '0.6.3', oldVsixSha256: OLD_SHA,
    profile: b.profile, workspace: b.workspace, extensions: b.extensions,
    installedManifest, retained, observations, passed: 7, failed: 0, notRun: 0, signalsRequested: 0,
    instrumentation: 'SEPARATE_DEVELOPMENT_OBSERVER_PUBLIC_APIS_REAL_NATIVE_CONFIRMATION',
    limitations: ['No independent human evidence', 'Old ciphertext not decrypted or restored', 'Actual close and both EOF require outer receipt'],
  });
  await vscode.commands.executeCommand('workbench.action.closeWindow');
}
exports.deactivate = () => {};
