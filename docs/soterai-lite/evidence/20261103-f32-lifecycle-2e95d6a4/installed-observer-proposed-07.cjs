'use strict';
// INERT PROPOSED TEST INSTRUMENTATION. Not imported by the product.
// Launch only as a separately identified observer extension after local CLI install.
const vscode = require('vscode');
const { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');
const brokerObservation = require('./installed-broker-observation-proposed-03.cjs');
const OMITTED = '[AI-forbidden content omitted by SoterAI]';
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
// F32_COMPLETION_HANDSHAKE_BEGIN
async function awaitRendererCompletion(b, completionNonce, observerResult, timeout = 90000) {
  const receiptPath = path.join(b.gate, b.phase + '-renderer-results.json');
  const receipt = await until(() => {
    if (!fs.existsSync(receiptPath)) return undefined;
    const stat = fs.lstatSync(receiptPath);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 2 * 1024 * 1024);
    // Another owned process may be between exclusive open and its first write.
    try { return read(receiptPath); } catch (error) { if (error instanceof SyntaxError) return undefined; throw error; }
  }, timeout, 'Owned renderer completion acknowledgment missing');
  assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.feature, 'F32');
  assert.equal(receipt.phase, b.phase); assert.equal(receipt.status, 'OBSERVED_REAL_KEYBOARD');
  assert.equal(receipt.signalsRequested, 0); assert.equal(receipt.productPromptInterception, false);
  assert.equal(receipt.productApiReplacement, false); assert.equal(receipt.completionNonce, completionNonce);
  assert.deepEqual(receipt.observerResult, observerResult);
}
// F32_COMPLETION_HANDSHAKE_END
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
  write(path.join(b.gate,b.phase+'-trust-before.json'),{observedAt:new Date().toISOString(),...collectTrustSnapshot(vscode)});
  const expected = b.trustChoice !== "No, I don't trust the authors";
  if (b.trustChoice) {
    const target = path.join(b.gate,b.phase+'-trust-choice.json');
    const intentPath = path.join(b.gate, b.phase + '-trust-keyboard-intent.json');
    const trustStart = Date.now(); let recordedGrant = false;
    const actual = await until(() => {
      const hasReceipt = fs.existsSync(target), hasIntent = fs.existsSync(intentPath);
      if (vscode.workspace.isTrusted && !recordedGrant) {
        recordedGrant = true;
        write(path.join(b.gate, b.phase + '-trust-grant-observation.json'), {
          observedAt: new Date().toISOString(), elapsedMs: Date.now() - trustStart,
          phase: b.phase, isTrusted: true, keyboardIntentPresent: hasIntent, keyboardReceiptPresent: hasReceipt,
          signalsRequested: 0,
        });
      }
      if (vscode.workspace.isTrusted && !hasReceipt && !hasIntent) throw Error('Fresh workspace trusted before witnessed keyboard intent');
      if (hasIntent) {
        const intent = read(intentPath);
        assert.equal(intent.status, 'OBSERVED_TRUST_BUTTON_FOCUS_BEFORE_KEYBOARD');
        assert.equal(intent.phase, b.phase); assert.equal(intent.choice, b.trustChoice);
        assert.equal(intent.workspaceName, path.basename(b.workspace)); assert.equal(intent.signalsRequested, 0);
      }
      // An intent records no acceptance. Only the existing post-keyboard receipt
      // below, with the actual public trust state, can complete this handshake.
      return hasReceipt && read(target);
    }, 90000, 'Real native trust keyboard receipt missing');
    assert.equal(actual.status,'OBSERVED_NATIVE_TRUST_KEYBOARD_CHOICE');
    assert.equal(actual.choice,b.trustChoice); assert.equal(actual.workspaceName,path.basename(b.workspace));
    assert.equal(actual.signalsRequested,0);
  }
  await until(()=>vscode.workspace.isTrusted===expected,90000,'Native workspace trust state has not settled');
  write(path.join(b.gate,b.phase+'-trust-after.json'),collectTrustSnapshot(vscode));
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
        errorName: error instanceof Error ? error.name : 'UnknownFailure', ...safeDiagnostic(error),
        trust: collectTrustSnapshot(vscode),
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
  assert(['primary', 'restart', 'upgrade-current', 'upgrade-restart', 'untrusted', 'disabled', 'uninstalled'].includes(b.phase));
  for (const key of ['runRoot', 'profile', 'extensions', 'workspace', 'gate', 'observerRoot']) {
    assert(typeof b[key] === 'string' && /^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}(?:\\|$)/.test(b[key]));
  }
  assert(inside(b.runRoot, b.profile) && inside(b.runRoot, b.extensions) && inside(b.runRoot, b.workspace));
  assert(inside(b.profile, b.gate) && inside(b.runRoot, b.observerRoot));
  for (const key of ['retainedInputsPath', 'retainedGeneratedPath', 'restartExpectedPath']) assert(inside(b.runRoot, b[key]));
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
    observedStage=id; await body(); rows.push({ id, title, status: 'PASS' });
  };
  const native = (id, ...args) => vscode.commands.executeCommand(id, ...args);
  let requestNumber = 0, lastUiReceipt;
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
    const result = await work; lastUiReceipt = done; return result;
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
  const retain = read(b.retainedInputsPath);
  const preserved = () => {
    for (const row of retain.files) { assert(inside(b.runRoot, row.path)); pin(row); }
    const generated = b.retainedGeneratedPath;
    if (fs.existsSync(generated)) for (const row of read(generated).files) { assert(inside(b.runRoot, row.path)); pin(row); }
  };
  const getProduct = () => vscode.extensions.getExtension('soterai.soterai-ide-guard');
  const product = getProduct();
  if (b.phase !== 'disabled' && b.phase !== 'uninstalled') await awaitReviewedTrust(b);
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
      assert(inside(b.runRoot, b.product.manifest.path));
      const checked = admitInstalledManifest({
        original: b.product.manifest, installedPath: path.join(product.extensionPath, 'package.json'),
        installStartedWallMs: b.installStartedWallMs, installCompletedWallMs: b.installCompletedWallMs,
        targetPlatform: b.product.targetPlatform, payloadUncompressedBytes: b.product.payloadUncompressedBytes,
      });
      write(path.join(b.gate, b.phase + '-manifest-admission.json'), checked);
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
        await check('O01', 'Actual minimal walkthrough and native self-check results appear under 120 seconds', async () => {
          await ui([{ kind: 'minimalOnboarding' }], async () => undefined);
          const observed = lastUiReceipt?.onboarding;
          assert(observed && observed.elapsedMs < 120000 && observed.elapsedMs >= 0);
          assert.equal(observed.walkthroughVisible, true); assert.equal(observed.verifyInvokedBy, 'REAL_NATIVE_TREE_ENTER');
          assert.equal(observed.syntheticChecks, 'CURRENT_3_OF_3_MATCHING_10_OF_10_OUTPUT_GATEWAY_NOT_TESTED');
          assert(Number.isSafeInteger(observed.keyboardActions) && observed.keyboardActions > 0);
          write(path.join(b.gate, 'primary-minimal-onboarding.json'), observed);
        });
        const original = { profile: currentProfile(), associations: associations() };
        await check('I05', 'Real deny save withholds synthetic content in the actual product preview', async () => {
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert.equal(vscode.window.activeTextEditor.document.uri.scheme, 'soterai-redacted');
          assert.equal(vscode.window.activeTextEditor.document.getText(), fs.readFileSync(b.deniedFile, 'utf8'),
            'Synthetic baseline must be readable before manual deny; fail-closed omission is not deny proof');
          assert.equal((await native(FIXED.restrict, vscode.Uri.file(b.deniedFile))).status, 'SAVED');
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          const document = vscode.window.activeTextEditor?.document;
          assert(document && document.uri.scheme === 'soterai-redacted');
          assert.equal(document.getText(), OMITTED);
        });
        await check('I06', 'Native migration creates product encrypted recovery and placeholders', async () => {
          await ui([modal('Move these values into the encrypted vault and replace them with placeholders?', 'Migrate securely')],
            () => native(FIXED.migrate, vscode.Uri.file(b.envFile)));
          const value = fs.readFileSync(b.envFile, 'utf8');
          assert(!value.includes(b.syntheticCanary));
          assert(/^API_KEY=\[SOTERAI_PROTECTED_[A-F0-9]{32}_0\]\r?\n?$/.test(value));
          const storage = path.join(b.profile, 'User', 'globalStorage', 'soterai.soterai-ide-guard');
          const names = fs.readdirSync(storage).filter(name => /^vault-generation-[a-f0-9-]{36}\.enc$/i.test(name));
          assert(names.length >= 1 && names.length <= 16);
          const files = names.map(name => fact(path.join(storage, name)));
          const sourcePointer = 'vault-source-' + sha(Buffer.from(vscode.Uri.file(b.envFile).toString())).slice(0, 32) + '.json';
          files.push(fact(path.join(storage, 'soterai-vault.enc')), fact(path.join(storage, sourcePointer)),
            fact(b.envFile), fact(path.join(b.workspace, '.env.example')));
          assert(!fs.existsSync(path.join(storage, 'vault-pending.json')), 'Successful migration must not retain a pending mutation pointer');
          for (const row of retain.files) pin(row);
          write(b.retainedGeneratedPath, { schemaVersion: 1, files });
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
        const configured = { profile: currentProfile(), associations: associations() };
        await check('I11', 'Aggregate approval keeps the existing profile review cancelable', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog()], () => native(FIXED.restore));
          assert.equal(result.status, 'CANCELLED');
          assert.equal(currentProfile(), 'SoterAI PowerShell 5.1 (checked commands)');
          assert.equal(result.broker, 'NOT_REQUESTED');
        });
        // No COMPLETE aggregate in this host: it permanently withdraws checked
        // controllers. Keep both real receipts for the natural restart instead.
        await check('I13', 'Policy and ciphertext remain byte exact after canceled restoration', () => {
          preserved(); for (const row of read(b.retainedGeneratedPath).files) pin(row);
        });
        await check('I14', 'Saved deny remains active after the lifecycle review', async () => {
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert.equal(vscode.window.activeTextEditor.document.getText(), OMITTED);
        });
        await check('I15', 'Restricted machine flag off withdraws aggregate without a native prompt', async () => {
          await vscode.workspace.getConfiguration('soterai').update('lite.lifecycleRecovery', false, vscode.ConfigurationTarget.Global);
          assert.equal((await native(FIXED.restore)).status, 'INCOMPLETE');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, configured);
        });
        await check('I16', 'Flag withdrawal preserves ciphertext, policy and placeholders', () => {
          preserved(); for (const row of read(b.retainedGeneratedPath).files) pin(row);
        });
        await check('I17', 'Reenable preserves both existing owned receipts for normal restart', async () => {
          await vscode.workspace.getConfiguration('soterai').update('lite.lifecycleRecovery', true, vscode.ConfigurationTarget.Global);
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, configured);
          write(b.restartExpectedPath, { original, configured });
        });
      } else if (b.phase === 'restart') {
        const expected = read(b.restartExpectedPath);
        let actualBroker, brokerNonce, brokerScript;
        await check('I18', 'Restart recovers the same owned project setting', () => {
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, expected.configured);
        });
        await check('I19', 'Restart keeps per-action native restore cancelable before withdrawing controllers', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog()], () => native(FIXED.restore));
          assert.equal(result.status, 'CANCELLED'); assert.equal(result.broker, 'NOT_REQUESTED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, expected.configured);
        });
        await check('B01', 'Actual installed owner starts a fresh private loopback broker and external custody admits only that descendant', async () => {
          assert(Number.isSafeInteger(b.configuredBrokerPort) && b.configuredBrokerPort >= 1024 &&
            b.configuredBrokerPort <= 65535 && b.configuredBrokerPort !== 47321);
          assert.equal(vscode.workspace.getConfiguration('soterai').inspect('broker.port')?.globalValue, b.configuredBrokerPort);
          for (const key of ['broker.openAIProviderUrl', 'broker.anthropicProviderUrl',
            'broker.codexResponsesProviderUrl', 'broker.geminiProviderUrl']) {
            assert.equal(vscode.workspace.getConfiguration('soterai').get(key), '');
          }
          assert.equal(vscode.workspace.getConfiguration('soterai').get('broker.autoStart'), false);
          const startRequestedWallMs = Date.now();
          actualBroker = brokerObservation.healthy(await native('soterai.startLocalAIBroker'));
          const fresh = brokerObservation.healthy(await native('soterai.showBrokerStatus'));
          assert.equal(fresh.port, actualBroker.port);
          brokerScript = fact(path.join(product.extensionPath, 'dist', 'local-ai-broker.js'));
          const declared = b.product.runtimes.filter(row => row.relative === 'dist/local-ai-broker.js');
          assert.equal(declared.length, 1); assert.equal(brokerScript.bytes, declared[0].bytes); assert.equal(brokerScript.sha256, declared[0].sha256);
          brokerNonce = crypto.randomBytes(16).toString('hex');
          const request = path.join(b.gate, 'restart-owned-broker-started.json');
          write(request, { schemaVersion: 1, feature: 'F32', phase: 'restart',
            status: 'PUBLIC_HEALTHY_EXTERNAL_CUSTODY_PENDING', nonce: brokerNonce,
            startRequestedWallMs, observedAt: new Date().toISOString(),
            observerPid: process.pid, configuredPort: b.configuredBrokerPort,
            state: actualBroker.state, running: actualBroker.running, port: actualBroker.port,
            version: actualBroker.brokerVersion,
            actual: actualBroker, script: brokerScript, signalsRequested: 0,
            portRule: 'PINNED_OWNER_PRIVATE_IPC_USES_OS_ASSIGNED_PORT_ZERO_NOT_LEGACY_CONFIGURED_PORT' });
          const done = await until(() => fs.existsSync(request + '.custody-done.json') &&
            read(request + '.custody-done.json'), 45000, 'Exact owned broker descendant custody missing');
          assert.equal(done.status, 'OWNED_BROKER_DESCENDANT_CUSTODY_VERIFIED');
          assert.equal(done.nonce, brokerNonce); assert.equal(done.port, actualBroker.port);
          assert.equal(done.observerPid, process.pid); assert.equal(done.scriptSha256, brokerScript.sha256);
          assert(Number.isSafeInteger(done.brokerPid) && done.brokerPid > 0 && done.brokerPid !== process.pid);
          assert.equal(done.signalsRequested, 0);
          assert(inside(b.runRoot, done.receipt.path)); pin(done.receipt);
          // Do not record start result, URL object, memory/session IDs, tokens,
          // environment or private IPC. Only fixed selected metadata is retained.
          write(path.join(b.gate, 'restart-owned-broker-admission.json'), {
            schemaVersion: 1, feature: 'F32', actual: actualBroker,
            brokerPid: done.brokerPid, scriptSha256: brokerScript.sha256,
            custodyReceipt: done.receipt, signalsRequested: 0,
          });
        });
        await check('I12', 'Restarted reviewed aggregate restores both settings then withdraws owned runtime', async () => {
          const result = await ui([summary('Review restoration'), folder, profileDialog('Restore previous terminal profile'),
            folder, associationDialog('Restore project associations')], () => native(FIXED.restore));
          assert.equal(result.status, 'COMPLETE'); assert.equal(result.broker, 'STOPPED');
          assert.deepEqual({ profile: currentProfile(), associations: associations() }, expected.original);
          assert.equal(result.actions.length, 14);
          assert(result.actions.every(row => ['RESTORED', 'NOT_APPLICABLE'].includes(row.status)));
        });
        await check('B02', 'Reviewed aggregate stops the actual broker; pinned owner closure and external absence remain conservative', async () => {
          const status = brokerObservation.stopped(await native('soterai.showBrokerStatus'));
          assert(actualBroker && brokerNonce && brokerScript);
          const request = path.join(b.gate, 'restart-owned-broker-stopped.json');
          write(request, { schemaVersion: 1, feature: 'F32', phase: 'restart',
            status: 'PUBLIC_STOPPED_EXTERNAL_ABSENCE_PENDING', nonce: brokerNonce,
            observedAt: new Date().toISOString(), state: status.state, running: status.running,
            previousPort: actualBroker.port, observerPid: process.pid, scriptSha256: brokerScript.sha256,
            script: brokerScript,
            actual: status, signalsRequested: 0,
            closureAuthority: 'PINNED_INSTALLED_OWNER_SETS_STOPPED_ONLY_AFTER_CHILD_CLOSE_STDOUT_END_STDERR_END',
            independentRawChildPipeCapture: 'NOT_AVAILABLE_NO_PRODUCT_INTERCEPTION' });
          const done = await until(() => fs.existsSync(request + '.absence-done.json') &&
            read(request + '.absence-done.json'), 45000, 'Stopped broker external absence remains unconfirmed');
          assert.equal(done.status, 'OWNED_BROKER_ABSENCE_VERIFIED');
          assert.equal(done.nonce, brokerNonce); assert.equal(done.previousPort, actualBroker.port);
          assert.equal(done.scriptSha256, brokerScript.sha256); assert.equal(done.signalsRequested, 0);
          assert(inside(b.runRoot, done.receipt.path)); pin(done.receipt);
          write(path.join(b.gate, 'restart-owned-broker-withdrawal.json'), {
            schemaVersion: 1, feature: 'F32', actual: status, absenceReceipt: done.receipt,
            closureAuthority: 'PRODUCT_PRIVATE_CLOSE_AND_BOTH_EOF_GUARD_PLUS_EXTERNAL_OWNER_ABSENCE',
            independence: 'LOW_SAME_LINEAGE_NO_INDEPENDENT_RAW_CHILD_PIPE_RECEIPT', signalsRequested: 0,
          });
        });
        await check('I20', 'Restart restoration retains original policy and generated ciphertext', () => {
          preserved(); for (const row of read(b.retainedGeneratedPath).files) pin(row);
        });
        await check('I21', 'Restarted saved deny remains active in the actual redacted preview', async () => {
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert.equal(vscode.window.activeTextEditor.document.getText(), OMITTED);
        });
        await check('I22', 'Repeated reviewed removal remains conservative and reports no new restoration', async () => {
          const result = await ui([summary('Review restoration')], () => native(FIXED.restore));
          assert.equal(result.status, 'COMPLETE'); assert.equal(result.broker, 'STOPPED');
          assert(result.actions.every(row => row.status === 'NOT_APPLICABLE'));
        });
      } else if (b.phase === 'upgrade-current' || b.phase === 'upgrade-restart') {
        const legacy = b.upgrade;
        assert(legacy && inside(b.runRoot, legacy.seedResult.path) && inside(b.runRoot, legacy.oldCodeClose.path));
        const seed = JSON.parse(fs.readFileSync(pin(legacy.seedResult).path, 'utf8'));
        const closed = JSON.parse(fs.readFileSync(pin(legacy.oldCodeClose).path, 'utf8'));
        const suffix = b.phase === 'upgrade-current' ? ['U08', 'U09', 'U10'] : ['U11', 'U12', 'U13'];
        await check(suffix[0], 'Actual prior installed 0.6.3 naturally closed before current upgrade or normal restart', () => {
          assert.equal(seed.feature, 'F32'); assert.equal(seed.phase, 'upgrade-old');
          assert.equal(seed.status, 'PASS_SCOPED_OLD_INSTALLED_SEED');
          assert.equal(seed.oldVersion, '0.6.3');
          assert.equal(seed.oldVsixSha256, 'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677');
          assert.equal(seed.observations.length, 7); assert(seed.observations.every(row => row.status === 'PASS'));
          assert(same(seed.profile, b.profile) && same(seed.workspace, b.workspace) && same(seed.extensions, b.extensions));
          assert.notEqual(product.packageJSON.version, seed.oldVersion);
          assert.equal(closed.actualClose, true); assert.equal(closed.exitCode, 0); assert.equal(closed.signal, null);
          assert.equal(closed.stdoutEOF, true); assert.equal(closed.stderrEOF, true);
          assert.equal(closed.deadlineExceeded, false); assert.equal(closed.streamError, false); assert.equal(closed.signalsRequested, 0);
          for (const row of [legacy.oldInstallClose, legacy.currentInstallClose]) {
            assert(inside(b.runRoot, row.path));
            const receipt = JSON.parse(fs.readFileSync(pin(row).path, 'utf8'));
            assert.equal(receipt.actualClose, true); assert.equal(receipt.exitCode, 0); assert.equal(receipt.signal, null);
            assert.equal(receipt.stdoutEOF, true); assert.equal(receipt.stderrEOF, true);
            assert.equal(receipt.deadlineExceeded, false); assert.equal(receipt.streamError, false); assert.equal(receipt.signalsRequested, 0);
          }
          if (b.phase === 'upgrade-restart') {
            assert(inside(b.runRoot, legacy.upgradedCodeClose.path));
            const receipt = JSON.parse(fs.readFileSync(pin(legacy.upgradedCodeClose).path, 'utf8'));
            assert.equal(receipt.actualClose, true); assert.equal(receipt.exitCode, 0); assert.equal(receipt.signal, null);
            assert.equal(receipt.stdoutEOF, true); assert.equal(receipt.stderrEOF, true);
            assert.equal(receipt.deadlineExceeded, false); assert.equal(receipt.streamError, false); assert.equal(receipt.signalsRequested, 0);
          }
        });
        await check(suffix[1], 'Current installed product preserves old deny, including after normal restart, without recreating it', async () => {
          // No blockFromAI/restrictProjectFile call in the upgraded host.
          assert(inside(b.workspace, b.upgradePublicFile) && path.basename(b.upgradePublicFile) === 'upgrade-public.txt');
          await native(FIXED.preview, vscode.Uri.file(b.upgradePublicFile));
          assert.equal(vscode.window.activeTextEditor.document.uri.scheme, 'soterai-redacted');
          assert.equal(vscode.window.activeTextEditor.document.getText(), fs.readFileSync(b.upgradePublicFile, 'utf8'),
            'A policy-unavailable whole-root omission must not be credited as preserved manual deny');
          await native(FIXED.preview, vscode.Uri.file(b.deniedFile));
          assert.equal(vscode.window.activeTextEditor.document.uri.scheme, 'soterai-redacted');
          assert.equal(vscode.window.activeTextEditor.document.getText(), OMITTED);
        });
        await check(suffix[2], 'Genuine old policy files, vault and encrypted backup survive current startup unchanged', async () => {
          assert(seed.retained.length >= 5 && seed.retained.length <= 12);
          for (const row of seed.retained) { assert(inside(b.runRoot, row.path)); pin(row); }
          assert.equal(vscode.workspace.getConfiguration('soterai').get('broker.autoStart'), false);
          assert.equal(vscode.workspace.getConfiguration('soterai').get('autoVaultMigration.enabled'), false);
          if (b.phase === 'upgrade-restart') {
            const before = { profile: currentProfile(), associations: associations() };
            const cancelled = await ui([summary()], () => native(FIXED.restore));
            assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.broker, 'NOT_REQUESTED');
            assert.deepEqual({ profile: currentProfile(), associations: associations() }, before);
            const reviewed = await ui([summary('Review restoration')], () => native(FIXED.restore));
            assert(['COMPLETE', 'INCOMPLETE'].includes(reviewed.status));
            assert.equal(reviewed.actions.length, 14);
            // No automatic route was configured in the old vault/policy seed.
            // Unknown legacy metadata must stay pending; do not fabricate a
            // successful legacy plaintext restoration to force COMPLETE.
            assert(reviewed.actions.every(row => ['NOT_APPLICABLE', 'PENDING', 'MANUAL_RECOVERY'].includes(row.status)));
            if (reviewed.status === 'COMPLETE') {
              assert.equal(reviewed.broker, 'STOPPED');
              assert(reviewed.actions.every(row => row.status === 'NOT_APPLICABLE'));
            } else assert(reviewed.actions.some(row => ['PENDING', 'MANUAL_RECOVERY'].includes(row.status)));
            for (const row of seed.retained) pin(row);
            assert.deepEqual({ profile: currentProfile(), associations: associations() }, before);
            write(path.join(b.gate, 'upgrade-restart-reviewed-removal.json'), {
              status: reviewed.status, broker: reviewed.broker,
              actions: reviewed.actions, limitation: 'Old unbound ciphertext is retained, never raw-restored',
            });
          }
        });
      }
    }
  }
  const completionNonce = crypto.randomBytes(16).toString('hex');
  const observerResultFile = path.join(b.gate, b.phase + '-observer-results.json');
  write(observerResultFile, {
    completionNonce,
    schemaVersion: 1, feature: 'F32', phase: b.phase, status: 'PASS_SCOPED_OBSERVER_API',
    observations: rows, passed: rows.length, failed: 0, notRun: 0, signalsRequested: 0,
    instrumentation: 'SEPARATE_DEVELOPMENT_OBSERVER_PUBLIC_VSCODE_APIS_ONLY',
    limitations: ['No independent human evidence', 'Only explicit U08-U10 phase can claim old-version upgrade observations',
      'Owner close and both EOF require outer receipt', 'Old unbound vault ciphertext retained, not decrypted or restored'],
  });
  await awaitRendererCompletion(b, completionNonce, fact(observerResultFile));
  await vscode.commands.executeCommand('workbench.action.closeWindow');
}
exports.deactivate = () => {};
