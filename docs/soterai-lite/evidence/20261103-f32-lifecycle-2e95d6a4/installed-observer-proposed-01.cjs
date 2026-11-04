'use strict';
// INERT PROPOSED TEST INSTRUMENTATION. Not imported by the product.
// Launch only as a separately identified observer extension after local CLI install.
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, value) => {
  const rel = path.relative(path.resolve(root), path.resolve(value));
  return rel !== '' && !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep);
};
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout, label) {
  const started = Date.now();
  while (Date.now() - started < timeout) { const found = await fn(); if (found) return found; await wait(80); }
  throw Error(label);
}
function fact(file) {
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 16 * 1024 * 1024);
  return { path: file, bytes: stat.size, sha256: sha(fs.readFileSync(file)) };
}
function pin(row) {
  const actual = fact(row.path);
  assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256);
  return actual;
}
const FIXED = {
  restore: 'soterai.restoreChangesBeforeRemoval',
  configureProfile: 'soterai.configureCheckedPowerShell',
  configureAssociation: 'soterai.configureSecureEditorAssociation',
  restrict: 'soterai.restrictProjectFile',
  preview: 'soterai.openRedactedPreview',
  migrate: 'soterai.migrateSecretsToVault',
};
exports.activate = context => {
  // Do not delay other extensions' default activation by awaiting the fixture here.
  void run(context).catch(async error => {
    try {
      const b = read(process.env.SOTERAI_F32_BINDING);
      write(path.join(b.gate, b.phase + '-observer-failure.json'), {
        schemaVersion: 1, feature: 'F32', status: 'FAIL_NO_RETRY', phase: b.phase,
        errorName: error instanceof Error ? error.name : 'UnknownFailure',
        // No error.message/stack/native result/file contents in evidence.
        signalsRequested: 0,
      });
      await vscode.commands.executeCommand('workbench.action.closeWindow');
    } catch { /* A failed evidence/normal Close remains unconfirmed. Never signal. */ }
  });
};
async function run(context) {
  assert(process.platform === 'win32');
  const b = read(process.env.SOTERAI_F32_BINDING);
  assert.equal(b.schemaVersion, 1); assert.equal(b.feature, 'F32');
  assert.equal(b.status, 'REVIEWED_ONE_NORMAL_ROUND');
  assert(['primary', 'restart', 'untrusted', 'disabled', 'uninstalled'].includes(b.phase));
  for (const key of ['runRoot', 'profile', 'extensions', 'workspace', 'gate', 'observerRoot']) {
    assert(typeof b[key] === 'string' && /^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}(?:\\|$)/.test(b[key]));
  }
  assert(inside(b.runRoot, b.profile) && inside(b.runRoot, b.extensions) && inside(b.runRoot, b.workspace));
  assert(inside(b.profile, b.gate) && inside(b.runRoot, b.observerRoot));
  assert(inside(b.workspace, b.deniedFile) && path.basename(b.deniedFile) === 'denied.txt');
  assert(inside(b.workspace, b.envFile) && path.basename(b.envFile) === '.env');
  assert(typeof b.syntheticCanary === 'string' && /^SOTERAI_F32_SYNTHETIC_[A-Z0-9_]{8,80}$/.test(b.syntheticCanary));
  assert(same(context.extensionUri.fsPath, b.observerRoot));
  assert.equal(context.extension.id, 'soterai-fixture.f32-installed-observer');
  assert.equal(context.extensionMode, vscode.ExtensionMode.Development);
  assert.equal(vscode.env.remoteName, undefined);
  const folders = vscode.workspace.workspaceFolders;
  assert.equal(folders?.length, 1); assert(same(folders[0].uri.fsPath, b.workspace));
  const rows = [], recorded = new Set();
  const check = async (id, title, body) => {
    assert(!recorded.has(id)); recorded.add(id);
    await body(); rows.push({ id, title, status: 'PASS' });
  };
  const native = (id, ...args) => vscode.commands.executeCommand(id, ...args);
  let requestNumber = 0;
  async function ui(steps, action) {
    const number = ++requestNumber, nonce = crypto.randomBytes(16).toString('hex');
    const request = path.join(b.gate, b.phase + '-ui-' + number + '.json');
    const response = request + '.done.json';
    write(request, { schemaVersion: 1, feature: 'F32', phase: b.phase, number, nonce, steps,
      workspaceName: path.basename(b.workspace), syntheticOnly: true, signalsRequested: 0 });
    // The real command owns prompts and results. No API, result or confirmation is replaced.
    const work = Promise.resolve().then(action);
    const done = await until(() => fs.existsSync(response) && read(response), 90000, 'Native UI response missing');
    assert.equal(done.nonce, nonce); assert.equal(done.status, 'OBSERVED_REAL_KEYBOARD');
    return await work;
  }
  const modal = (contains, button) => ({ kind: 'modal', contains, ...(button ? { button } : { cancel: true }) });
  const folder = { kind: 'optionalWorkspacePicker' };
  const currentProfile = () => vscode.workspace.getConfiguration('terminal.integrated', folders[0].uri)
    .inspect('defaultProfile.windows')?.workspaceValue;
  const associations = () => structuredClone(vscode.workspace.getConfiguration('workbench', folders[0].uri)
    .inspect('editorAssociations')?.workspaceValue ?? {});
  const summary = button => modal('Review SoterAI changes before removal', button);
  const profileDialog = button => modal('Apply this terminal profile change to the selected project?', button);
  const associationDialog = button => modal('Apply these reviewed editor associations only to the selected project?', button);
  const retain = read(path.join(b.runRoot, 'retained-inputs.json'));
  const preserved = () => {
    for (const row of retain.files) { assert(inside(b.runRoot, row.path)); pin(row); }
    const generated = path.join(b.runRoot, 'retained-generated.json');
    if (fs.existsSync(generated)) for (const row of read(generated).files) { assert(inside(b.runRoot, row.path)); pin(row); }
  };
  const getProduct = () => vscode.extensions.getExtension('soterai.soterai-ide-guard');
  const product = getProduct();
  if (b.phase === 'uninstalled') {
    await check('I27', 'CLI uninstall removed the installed extension registration', async () => {
      assert.equal(product, undefined); assert(!vscode.extensions.all.some(x => x.id === 'soterai.soterai-ide-guard'));
    });
    await check('I28', 'Uninstall preserved the frozen synthetic policy and encrypted recovery', preserved);
  } else if (b.phase === 'disabled') {
    await check('I25', 'Disabled installed product has no active instance or commands', async () => {
      assert(!product || !product.isActive);
      assert(!(await vscode.commands.getCommands(true)).includes(FIXED.restore));
    });
    await check('I26', 'Disable preserved the frozen synthetic policy and encrypted recovery', preserved);
  } else {
    await check('I01', 'Product identity resolves only to the exact CLI installation', async () => {
      assert(product); assert.equal(product.id, 'soterai.soterai-ide-guard');
      assert(inside(b.extensions, product.extensionPath)); assert(!inside(b.observerRoot, product.extensionPath));
      assert.equal(product.packageJSON.version, b.product.version);
      assert.equal(product.packageJSON.main, './dist/extension.js');
    });
    await check('I02', 'Installed manifest equals the unmodified local VSIX payload', async () => {
      const actual = fact(path.join(product.extensionPath, 'package.json'));
      assert.equal(actual.bytes, b.product.manifest.bytes); assert.equal(actual.sha256, b.product.manifest.sha256);
    });
    await check('I03', 'Every declared runtime comes from unchanged installed payload bytes', async () => {
      assert.equal(b.product.runtimes.length, 4);
      for (const row of b.product.runtimes) {
        assert(/^dist\/[a-z0-9-]+\.js$/.test(row.relative));
        const actual = fact(path.join(product.extensionPath, row.relative));
        assert.equal(actual.bytes, row.bytes); assert.equal(actual.sha256, row.sha256);
      }
    });
    if (b.phase === 'untrusted') {
      await check('I23', 'Restricted mode refuses removal without changing settings', async () => {
        assert.equal(vscode.workspace.isTrusted, false);
        const before = JSON.stringify({ profile: currentProfile(), associations: associations() });
        const outcome = await native(FIXED.restore);
        assert.equal(outcome.status, 'INCOMPLETE');
        assert.equal(JSON.stringify({ profile: currentProfile(), associations: associations() }), before);
      });
      await check('I24', 'Restricted mode leaves frozen policy and encrypted recovery unchanged', preserved);
    } else {
      assert.equal(vscode.workspace.isTrusted, true);
      await check('I04', 'Default startup activation and commands become ready under 120 seconds', async () => {
        assert(Number.isSafeInteger(b.launchWallMs) && b.launchWallMs > 0 && b.launchWallMs <= Date.now());
        // Never call product.activate(); measure its actual default activation.
        await until(() => product.isActive, Math.max(1, 120000 - (Date.now() - b.launchWallMs)), 'Default activation over 120 seconds');
        const commands = await vscode.commands.getCommands(true);
        assert(Object.values(FIXED).every(id => commands.includes(id)));
        const elapsedMs = Date.now() - b.launchWallMs;
        assert(elapsedMs < 120000);
        write(path.join(b.gate, b.phase + '-onboarding-timing.json'), {
          elapsedMs, timedFrom: 'OWNED_CODE_SPAWN_WALL_CLOCK',
          adminPrompts: 'OUTER_NATIVE_OBSERVATION_REQUIRED',
          productExtraInstalls: 'OUTER_CLI_INVENTORY_REQUIRED',
          observerInstrumentation: 'SEPARATE_DECLARED_DEVELOPMENT_OBSERVER',
          excludes: ['CLI installation', 'fixture preparation', 'optional workflow durations'],
        });
      });
      if (b.phase === 'primary') {
        const original = { profile: currentProfile(), associations: associations() };
        await check('I05', 'Real deny save withholds synthetic content in the actual product preview', async () => {
          assert.equal((await native(FIXED.restrict, vscode.Uri.file(b.deniedFile))).status, 'SAVED');
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          const document = vscode.window.activeTextEditor?.document;
          assert(document && document.uri.scheme !== 'file');
          assert(!document.getText().includes(b.syntheticCanary));
          assert(document.getText().length > 0);
        });
        await check('I06', 'Native migration creates product encrypted recovery and placeholders', async () => {
          await ui([modal('Move these values into the encrypted vault and replace them with placeholders?', 'Migrate securely')],
            () => native(FIXED.migrate, vscode.Uri.file(b.envFile)));
          const value = fs.readFileSync(b.envFile, 'utf8');
          assert(!value.includes(b.syntheticCanary)); assert(value.includes('SOTERAI_'));
          const storage = path.join(b.profile, 'User', 'globalStorage', 'soterai.soterai-ide-guard');
          const names = fs.readdirSync(storage).filter(name => /^vault-generation-[a-f0-9-]{36}\.enc$/i.test(name));
          assert(names.length >= 1 && names.length <= 16);
          const files = names.map(name => fact(path.join(storage, name)));
          files.push(fact(path.join(storage, 'soterai-vault.enc')), fact(b.envFile));
          for (const row of retain.files) pin(row);
          write(path.join(b.runRoot, 'retained-generated.json'), { schemaVersion: 1, files });
        });
        await check('I07', 'No-argument summary cancellation performs no restoration', async () => {
          const result = await ui([summary()], () => native(FIXED.restore));
          assert.equal(result.status, 'CANCELLED'); assert.equal(result.broker, 'NOT_REQUESTED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, original);
        });
        await check('I08', 'Forged caller arguments cannot bypass the real native summary', async () => {
          const result = await ui([summary()], () => native(FIXED.restore, { approved: true, root: 'file:///C:/not-authority', actions: [] }));
          assert.equal(result.status, 'CANCELLED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, original);
        });
        await check('I09', 'Checked profile is installed only after its real native review', async () => {
          const result = await ui([folder, profileDialog('Use checked PowerShell profile')], () => native(FIXED.configureProfile));
          assert.equal(result.status, 'SAVED'); assert.equal(currentProfile(), 'SoterAI PowerShell 5.1 (checked commands)');
        });
        await check('I10', 'Secure editor mapping is installed only after its real native review', async () => {
          const result = await ui([folder, associationDialog('Use masked environment editor')], () => native(FIXED.configureAssociation));
          assert.equal(result.status, 'SAVED');
          const mapping = associations();
          assert.equal(mapping['**/.env'], 'soterai.secureEditor');
          assert.equal(mapping['**/.env.*'], 'soterai.secureEditor');
        });
        await check('I11', 'Aggregate approval keeps the existing profile review cancelable', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog()], () => native(FIXED.restore));
          assert.equal(result.status, 'CANCELLED');
          assert.equal(currentProfile(), 'SoterAI PowerShell 5.1 (checked commands)');
          assert.equal(result.broker, 'NOT_REQUESTED');
        });
        await check('I12', 'Reviewed aggregate restores both owned settings and confirms broker stop', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog('Restore previous terminal profile'),
            folder, associationDialog('Restore project associations')], () => native(FIXED.restore));
          assert.equal(result.status, 'COMPLETE'); assert.equal(result.broker, 'STOPPED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, original);
          assert.equal(result.actions.length, 14);
          assert(result.actions.every(row => ['RESTORED', 'NOT_APPLICABLE'].includes(row.status)));
        });
        await check('I13', 'Policy and product-generated ciphertext remain byte exact after restore', () => {
          preserved(); for (const row of read(path.join(b.runRoot, 'retained-generated.json')).files) pin(row);
        });
        await check('I14', 'Saved deny remains active after the lifecycle review', async () => {
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert(!vscode.window.activeTextEditor.document.getText().includes(b.syntheticCanary));
        });
        await check('I15', 'Restricted machine flag off withdraws aggregate without a native prompt', async () => {
          await vscode.workspace.getConfiguration('soterai').update('lite.lifecycleRecovery', false, vscode.ConfigurationTarget.Global);
          assert.equal((await native(FIXED.restore)).status, 'INCOMPLETE');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, original);
        });
        await check('I16', 'Flag withdrawal preserves ciphertext, policy and placeholders', () => {
          preserved(); for (const row of read(path.join(b.runRoot, 'retained-generated.json')).files) pin(row);
        });
        await check('I17', 'Reenable allows a reviewed owned profile to survive a normal restart', async () => {
          await vscode.workspace.getConfiguration('soterai').update('lite.lifecycleRecovery', true, vscode.ConfigurationTarget.Global);
          const result = await ui([folder, profileDialog('Use checked PowerShell profile')], () => native(FIXED.configureProfile));
          assert.equal(result.status, 'SAVED');
          write(path.join(b.runRoot, 'restart-expected.json'), { original, ownedProfile: currentProfile() });
        });
      } else if (b.phase === 'restart') {
        const expected = read(path.join(b.runRoot, 'restart-expected.json'));
        await check('I18', 'Restart recovers the same owned project setting', () => {
          assert.equal(currentProfile(), expected.ownedProfile);
        });
        await check('I19', 'Restarted product restores the retained receipt through native review', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog('Restore previous terminal profile')], () => native(FIXED.restore));
          assert.equal(result.status, 'COMPLETE'); assert.equal(result.broker, 'STOPPED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, expected.original);
        });
        await check('I20', 'Restart restoration retains original policy and generated ciphertext', () => {
          preserved(); for (const row of read(path.join(b.runRoot, 'retained-generated.json')).files) pin(row);
        });
        await check('I21', 'Restarted saved deny remains active in the actual redacted preview', async () => {
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert(!vscode.window.activeTextEditor.document.getText().includes(b.syntheticCanary));
        });
        await check('I22', 'Repeated reviewed removal remains conservative and reports no new restoration', async () => {
          const result = await ui([summary('Review restoration')], () => native(FIXED.restore));
          assert.equal(result.status, 'COMPLETE'); assert.equal(result.broker, 'STOPPED');
          assert(result.actions.every(row => row.status === 'NOT_APPLICABLE'));
        });
      }
    }
  }
  write(path.join(b.gate, b.phase + '-observer-results.json'), {
    schemaVersion: 1, feature: 'F32', phase: b.phase, status: 'PASS_SCOPED_OBSERVER_API',
    observations: rows, passed: rows.length, failed: 0, notRun: 0, signalsRequested: 0,
    instrumentation: 'SEPARATE_DEVELOPMENT_OBSERVER_PUBLIC_VSCODE_APIS_ONLY',
    limitations: ['No independent human evidence', 'No old-version upgrade claim', 'Owner close and both EOF require outer receipt'],
  });
  await vscode.commands.executeCommand('workbench.action.closeWindow');
}
exports.deactivate = () => {};
