'use strict';
// Unchanged installed SoterAI/Cline, actual editor commands and public Cline API.
// Each scenario requires a fresh profile. No vendor bootstrap or product mocks.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { homedir } = require('node:os');
const { createHash } = require('node:crypto');
const artifact = '98f3e336ee3a76e992276409648de98d1db4c6e362fb7669e624dd892adf0d9c';
const pin = Object.freeze({ identity: 'saoudrizwan.claude-dev', version: '4.1.26',
  manifestSha256: '4c9213753c57e7d651b09be215853e4555238718b4974413b7e63993a42b219e',
  runtimeSha256: 'ae4cec19fd74dc97681dcfcfe5a6644cae4a5f5f19396f1424dcd9eada659559' });
const publicControl = 'SOTERAI_CLINE_NATIVE_PUBLIC_CONTROL_20261113';
const model = 'soterai-native-loopback';
const originalKey = 'TEST_ONLY_CLINE_ORIGINAL_PROVIDER';
const upstreamKey = 'TEST_ONLY_CLINE_UPSTREAM_PROVIDER';
const expectedRuntimes = ['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'];
const sha = value => createHash('sha256').update(value).digest('hex');
exports.syntheticReply = tools => {
  const terminal = Array.isArray(tools) && tools.some(tool => tool?.type === 'function' && tool.function?.name === 'submit_and_exit');
  return terminal ? { kind: 'completion-tool', finishReason: 'tool_calls',
    delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'soterai-public-completion', type: 'function', function: { name: 'submit_and_exit', arguments: JSON.stringify({ summary: publicControl, verified: true }) } }] } }
    : { kind: 'assistant-text', finishReason: 'stop', delta: { role: 'assistant', content: publicControl } };
};
const demand = value => { if (!value) throw Error('CLINE_CHECK_FAILED'); };
const delay = ms => new Promise(done => setTimeout(done, ms));
const inside = (root, target) => { const relative = path.relative(root, target); return relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep); };
async function until(work, budget = 25000) {
  const deadline = Date.now() + budget;
  while (Date.now() < deadline) { const result = await work(); if (result) return result; await delay(100); }
  throw Error('CLINE_TIMEOUT');
}
async function ordinaryRead(root, file, maximum = 262144, appendOnlyLog = false) {
  demand(inside(root, file));
  const canonicalRoot = await fs.realpath(root), canonicalFile = await fs.realpath(file);
  demand(inside(canonicalRoot, canonicalFile));
  for (let cursor = file; cursor !== root; cursor = path.dirname(cursor)) demand(!(await fs.lstat(cursor)).isSymbolicLink());
  const before = await fs.lstat(file); demand(before.isFile() && before.nlink === 1 && before.size <= maximum);
  const bytes = await fs.readFile(file), after = await fs.lstat(file);
  demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && before.ino === after.ino && bytes.length <= maximum
    && (appendOnlyLog
      ? before.size <= bytes.length && bytes.length <= after.size
      : before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && bytes.length === before.size));
  return bytes;
}
async function publish(file, value) {
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staged = file + '.staged', bytes = Buffer.from(JSON.stringify(value) + '\n');
  await fs.writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
  const before = await fs.lstat(staged); demand(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size === bytes.length);
  try { await fs.lstat(file); throw Error('EVIDENCE_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(staged, file);
  const after = await fs.lstat(file); demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && after.ino === before.ino && after.size === bytes.length);
}
async function optionalHash(out, file) {
  try { const bytes = await ordinaryRead(out, file); return { bytes: bytes.length, sha256: sha(bytes) }; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Root runner uses this pure preparation manifest before launching the editor.
exports.fixture = scenario => {
  demand(['legacy-refusal', 'setup-loopback', 'agentrouter', 'cline-free', 'setup-canaries', 'setup-attachment'].includes(scenario));
  const model = scenario === 'cline-free' ? 'cline-free/solar-mini4' : scenario === 'agentrouter' ? 'gpt-5.6-sol' : 'soterai-native-loopback';
  const info = { maxTokens: 4096, contextWindow: 128000, supportsImages: false, supportsPromptCache: false, inputPrice: 0, outputPrice: 0 };
  const state = { planModeApiProvider: 'openai', actModeApiProvider: 'openai', planModeOpenAiModelId: model, actModeOpenAiModelId: model,
    planModeOpenAiModelInfo: info, actModeOpenAiModelInfo: info, mode: 'act', telemetrySetting: 'disabled', optOutOfRemoteConfig: true,
    openTelemetryEnabled: false, mcpMarketplaceEnabled: false, enableCheckpointsSetting: false, subagentsEnabled: false,
    worktreesEnabled: false, cloudSessionsEnabled: false, welcomeViewCompleted: true, isNewUser: false, hooksEnabled: true,
    autoApprovalSettings: { enabled: false, version: 1, maxRequests: 2, enableNotifications: false,
      actions: { readFiles: false, readFilesExternally: false, editFiles: false, executeSafeCommands: false, executeAllCommands: false, useBrowser: false, useMcp: false } } };
  if (scenario === 'legacy-refusal') state.openAiBaseUrl = 'http://127.0.0.1:9/v1';
  const provider = { version: 1, lastUsedProvider: 'openai-compatible', modes: {}, providers: { 'openai-compatible': {
    settings: { provider: 'openai-compatible', model, apiKey: originalKey, baseUrl: 'http://127.0.0.1:9/v1' },
    updatedAt: '2026-11-13T00:00:00.000Z', tokenSource: 'migration' } } };
  const catalog = { version: 1, providers: { 'openai-compatible': { provider: { name: 'OpenAI Compatible', baseUrl: 'http://127.0.0.1:9/v1', defaultModelId: model },
    models: { [model]: { id: model, name: model, maxTokens: 4096, contextWindow: 128000, maxInputTokens: 128000, capabilities: ['streaming', 'tools'] } } } } };
  if (['setup-canaries','setup-attachment'].includes(scenario)) {
    info.supportsImages = true; catalog.providers['openai-compatible'].models[model].capabilities.push('images');
    catalog.providers['openai-compatible'].models[model].modalities = { input: ['text','image'], output: ['text'] };
    state.autoApprovalSettings.enabled = true; state.autoApprovalSettings.maxRequests = 8;
    state.autoApprovalSettings.actions.readFiles = true;
    state.autoApprovalSettings.actions.useMcp = true;
  }
  if (scenario === 'cline-free') {
    state.planModeApiProvider = state.actModeApiProvider = 'cline';
    state.planModeOpenRouterModelId = state.actModeOpenRouterModelId = model;
    state.planModeClineModelId = state.actModeClineModelId = model;
    state.planModeClineModelInfo = state.actModeClineModelInfo = info;
    provider.lastUsedProvider = 'cline'; provider.providers = { cline: { settings: { provider: 'cline', model } } };
    catalog.providers = { cline: { provider: { name: 'Cline', defaultModelId: model }, models: { [model]: { id: model, name: 'Solar Mini 4', maxTokens: 4096, contextWindow: 128000, capabilities: ['streaming','tools'] } } } };
  }
  return { scenario, artifactSha256: artifact, vendor: pin, publicControl,
    settings: { 'window.dialogStyle': 'custom', 'soterai.broker.autoStart': false, 'soterai.autoVaultMigration.enabled': false,
      'soterai.cloud.enabled': false, 'soterai.privacyMode': 'local', 'cline.telemetrySetting': 'disabled', 'workbench.enableExperiments': false,
      'typescript.disableAutomaticTypeAcquisition': true, 'extensions.ignoreRecommendations': true },
    files: { 'profile/.cline/data/globalState.json': state, 'profile/.cline/data/secrets.json': {},
      'profile/.cline/data/settings/providers.json': provider, 'profile/.cline/data/settings/models.json': catalog,
      'profile/.cline/data/settings/global-settings.json': { autoUpdateEnabled: false, telemetryOptOut: true },
      'profile/.cline/data/settings/cline_mcp_settings.json': { mcpServers: {} } } };
};

exports.run = async function () {
  const vscode = require('vscode');
  const out = process.env.SOTERAI_ACCEPTANCE_DIRECTORY;
  demand(typeof out === 'string' && path.isAbsolute(out) && path.resolve(process.env.USERPROFILE) === path.join(out, 'profile'));
  const prepared = JSON.parse(await ordinaryRead(out, path.join(out, 'prepared.json'), 16384));
  demand(prepared.schemaVersion === 1 && prepared.suite === 'cline' && prepared.artifactSha256 === artifact
    && /^[a-f0-9]{32}$/.test(prepared.runNonce) && prepared.identity === 'soterai.soterai-ide-guard'
    && ['legacy-refusal', 'setup-loopback', 'agentrouter', 'cline-free', 'setup-canaries', 'setup-attachment'].includes(prepared.clineScenario));
  demand(JSON.stringify(prepared.vendor) === JSON.stringify(pin));
  const scenario = prepared.clineScenario, fixture = exports.fixture(scenario);
  const external = scenario === 'agentrouter', model = external ? 'gpt-5.6-sol' : 'soterai-native-loopback';
  if (external) demand(typeof process.env.AGENTROUTER_API_KEY === 'string' && process.env.AGENTROUTER_API_KEY.length > 20);
  const workspace = path.join(out, 'workspace'), settings = path.join(out, 'profile/.cline/data/settings');
  const storage = path.join(out, 'profile/user-data/User/globalStorage', prepared.identity);
  const managedFiles = [path.join(settings, 'providers.json'), path.join(settings, 'cline_mcp_settings.json'), path.join(settings, 'global-settings.json'),
    path.join(workspace, '.clinerules/hooks/PreToolUse.ps1'), path.join(workspace, '.clinerules/hooks/TaskStart.ps1')];
  const result = { schemaVersion: 1, status: 'FAIL_NATIVE_CLINE', suite: 'cline', clineScenario: scenario,
    artifactSha256: artifact, runNonce: prepared.runNonce, editorVersion: vscode.version, checks: [], commandStages: [],
    productApiMocked: false, vendorManifestModified: false, vendorRuntimeModified: false, realProviderTested: false,
    requestCanariesTested: false, toolResultCanariesTested: false, attachmentsTested: false, nativeContextLeakProtectionCertified: false,
    taskCompletionCertified: false, osNetworkConfinementCertified: false, independentHumanReview: false, normalProfileModified: false,
    syntheticOnly: true, releaseReady: false };
  if (external) result.externalProvider = { provider: 'AgentRouter', endpoint: 'https://agentrouter.org/v1/chat/completions', model,
    observationProxy: 'Owned loopback collector forwards the exact broker request body', requests: [] };
  const configuration = vscode.workspace.getConfiguration('soterai');
  const globalFlag = name => { const inspected = configuration.inspect(name); return (inspected ? inspected.globalValue ?? inspected.defaultValue ?? true : configuration.get(name, true)) === true; };
  const profileMatches = value => typeof value === 'string' && path.resolve(value).toLowerCase() === path.join(out, 'profile').toLowerCase();
  result.prerequisites = {
    platformWindows: process.platform === 'win32', workspaceTrusted: vscode.workspace.isTrusted === true,
    homedirMatchesSyntheticProfile: profileMatches(homedir()), userprofileMatchesSyntheticProfile: profileMatches(process.env.USERPROFILE),
    singleLocalWorkspace: vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.scheme === 'file',
    remoteWorkspace: !!vscode.env.remoteName,
    adapterFlags: { clineAdapter: globalFlag('lite.clineAdapter'), safeReadMcp: globalFlag('lite.safeReadMcp') },
    readerFlags: Object.fromEntries(['projectPrivacy.enabled', 'projectPrivacy.atomicSensitivePolicy', 'projectPrivacy.safeViewComposition', 'hardening.addOnlyPolicy']
      .map(name => [name, configuration.get(name, true) === true]).concat([['lite.safeConsent', globalFlag('lite.safeConsent')]])),
    emptyClineOverrideFields: Object.fromEntries(['CLINE_DIR', 'CLINE_DATA_DIR', 'CLINE_PROVIDER_SETTINGS_PATH', 'CLINE_GLOBAL_SETTINGS_PATH', 'CLINE_MCP_SETTINGS_PATH']
      .map(name => [name, process.env[name] === undefined || typeof process.env[name] === 'string' && !process.env[name].trim()])),
  };
  let server, vendor, vendorApi, ordinal = 0, boundary = 'PREPARATION', collectorFailure = false, replySent = false, replyCount = 0, requestCanaryExpected = false;
  let toolReadRequested = false, toolResultObserved = false;
  const requests = [];
  result.collectorObservations = [];
  async function check(name, work) {
    try { await work(); result.checks.push({ name, status: 'PASS' }); return true; }
    catch (error) { result.checks.push({ name, status: 'FAIL', code: ['CLINE_CHECK_FAILED', 'CLINE_TIMEOUT', 'CLINE_COMMAND_TIMEOUT'].includes(error?.message) ? error.message : 'UNEXPECTED_FAILURE', boundary,
      testsSourceLines: (String(error?.stack || '').match(/tests[.]cjs:[0-9]+:[0-9]+/g) || []).slice(0, 4) }); return false; }
  }
  async function stableSnapshot() {
    let previous, matches = 0;
    return until(async () => {
      const current = await snapshot(), encoded = JSON.stringify(current);
      matches = previous === encoded ? matches + 1 : 0; previous = encoded;
      return matches >= 3 ? current : false;
    }, 5000);
  }
  async function snapshot() {
    const files = await Promise.all(managedFiles.map(file => optionalHash(out, file)));
    const backupDirectory = path.join(storage, 'config-backups'); let backups = [];
    try {
      const names = await fs.readdir(backupDirectory); demand(names.length <= 32 && names.every(name => /^[a-f0-9]{32}\.enc$/.test(name)));
      backups = await Promise.all(names.sort().map(async name => ({ name, ...await optionalHash(out, path.join(backupDirectory, name)) })));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { files, backups };
  }
  async function ack(stage, extra = {}, command) {
    ordinal++;
    const item = { stage, ordinal, state: 'PENDING' }; result.commandStages.push(item); boundary = 'NATIVE_COMMAND';
    await publish(path.join(out, `ui-request-${ordinal}.json`), { schemaVersion: 1, runNonce: prepared.runNonce, ordinal, stage, ...extra });
    if (stage === 'cline-configure-broker') {
      item.state = 'WAITING_FOR_RENDERER_COMMAND_READY';
      await until(async () => {
        try {
          const ready = JSON.parse(await ordinaryRead(out, path.join(out, `ui-command-ready-${ordinal}.json`), 8192));
          demand(ready.schemaVersion === 1 && ready.runNonce === prepared.runNonce && ready.stage === stage && ready.ordinal === ordinal
            && ready.editorBroughtToFront === true && ready.documentFocused === true); return true;
        } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      });
    }
    item.state = 'COMMAND_PENDING';
    const pending = command ? Promise.resolve().then(command).then(value => { item.state = 'COMMAND_RETURNED'; return value; }, () => {
      item.state = 'COMMAND_REJECTED'; throw Error('CLINE_CHECK_FAILED');
    }) : Promise.resolve();
    const value = await Promise.race([pending, delay(30000).then(() => { throw Error('CLINE_COMMAND_TIMEOUT'); })]);
    boundary = 'RENDERER_ACK';
    await until(async () => {
      try {
        const receipt = JSON.parse(await ordinaryRead(out, path.join(out, `ui-step-${ordinal}.json`), 8192));
        demand(receipt.schemaVersion === 1 && receipt.status === 'PASS' && receipt.runNonce === prepared.runNonce
          && receipt.ordinal === ordinal && receipt.stage === stage && receipt.realUiInteraction === true); return true;
      } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }, scenario === 'cline-free' ? 90000 : 25000);
    item.state = 'NATIVE_COMMAND_AND_UI_ACK_COMPLETE'; return value;
  }
  try {
    if (!await check('cline-native-synthetic-home-isolation', async () => {
      boundary = 'SYNTHETIC_HOME_ISOLATION';
      demand(result.prerequisites.homedirMatchesSyntheticProfile && result.prerequisites.userprofileMatchesSyntheticProfile);
    })) return;
    if (!await check('exact-installed-extension-activation', async () => {
      const extension = vscode.extensions.getExtension(prepared.identity); demand(extension && inside(path.join(out, 'profile/extensions'), extension.extensionPath));
      demand(extension.packageJSON.version === prepared.version && extension.packageJSON.main === './dist/extension.js');
      demand(Array.isArray(prepared.runtimes) && prepared.runtimes.length === 4 && new Set(prepared.runtimes.map(row => row.name)).size === 4);
      for (const runtime of prepared.runtimes) { demand(expectedRuntimes.includes(runtime.name)); const bytes = await ordinaryRead(out, path.join(extension.extensionPath, 'dist', runtime.name), 4 * 1024 * 1024); demand(bytes.length === runtime.bytes && sha(bytes) === runtime.sha256); }
      await extension.activate(); demand(extension.isActive && vscode.workspace.isTrusted && !vscode.env.remoteName);
      demand(vscode.workspace.workspaceFolders?.length === 1 && vscode.workspace.workspaceFolders[0].uri.fsPath.toLowerCase() === workspace.toLowerCase());
      result.installedExtensionVersion = extension.packageJSON.version;
      const state = JSON.parse(await ordinaryRead(out, path.join(out, 'profile/.cline/data/globalState.json')));
      const expectedProvider = scenario === 'cline-free' ? 'cline' : 'openai';
      demand(state.hooksEnabled === true && state.optOutOfRemoteConfig === true && state.planModeApiProvider === expectedProvider && state.actModeApiProvider === expectedProvider);
      demand(scenario === 'legacy-refusal' ? state.openAiBaseUrl === fixture.files['profile/.cline/data/globalState.json'].openAiBaseUrl : !Object.hasOwn(state, 'openAiBaseUrl'));
      demand(vscode.workspace.getConfiguration('soterai').get('broker.autoStart') === false);
      boundary = 'RENDERER_READY';
      await until(async () => { try { const ready = JSON.parse(await ordinaryRead(out, path.join(out, 'renderer-ready.json'), 8192)); demand(ready.status === 'READY' && ready.suite === 'cline' && ready.runNonce === prepared.runNonce); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } });
    })) return;
    if (!await check('exact-installed-cline-artifact', async () => {
      vendor = vscode.extensions.getExtension(pin.identity); demand(vendor && vendor.packageJSON.version === pin.version && vendor.packageJSON.main === './dist/extension.js');
      demand(inside(path.join(out, 'profile/extensions'), vendor.extensionPath));
      demand(sha(await ordinaryRead(out, path.join(vendor.extensionPath, 'package.json'), 65536)) === pin.manifestSha256);
      demand(sha(await ordinaryRead(out, path.join(vendor.extensionPath, 'dist/extension.js'), 32 * 1024 * 1024)) === pin.runtimeSha256);
      result.installedClineVersion = vendor.packageJSON.version;
    })) return;
    if (!await check('cline-native-vendor-activation-ready', async () => {
      boundary = 'UNCHANGED_VENDOR_ACTIVATION';
      vendorApi = await Promise.race([vendor.activate(), delay(30000).then(() => { throw Error('CLINE_TIMEOUT'); })]);
      demand(vendor.isActive && typeof vendorApi?.startNewTask === 'function');
      result.vendorActivationComplete = true;
      await stableSnapshot();
    })) return;
    if (scenario === 'cline-free') {
      result.freeModel = 'cline-free/solar-mini4'; result.soteraiManagedRoute = false;
      result.directProviderScope = 'Public reply using the built-in Cline free provider; this route does not establish SoterAI broker enforcement';
      if (!await check('cline-native-free-model-public-reply', async () => {
        await vscode.commands.executeCommand('claude-dev.SidebarProvider.focus');
        if (prepared.waitForLogin) {
          await publish(path.join(out, 'login-required.json'), { runNonce: prepared.runNonce, provider: 'Cline', freeModel: result.freeModel, isolatedProfile: true });
          await until(async () => {
            try { const ready = JSON.parse(await ordinaryRead(out, path.join(out, 'user-login-ready.json'), 8192));
              demand(ready.runNonce === prepared.runNonce && ready.userReportedSignedIn === true); return true;
            } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
          }, 540000);
        }
        await ack('cline-select-free-model', { freeModel: result.freeModel });
        const selected = JSON.parse(await ordinaryRead(out, path.join(settings, 'providers.json'))).providers?.cline?.settings;
        result.observedFreeModel = selected?.model;
        demand(selected?.model === result.freeModel);
        await ack('cline-public-reply', { publicControl }, () => vendorApi.startNewTask('Reply with exactly ' + publicControl + '. No files, commands, browser, skills or tools are needed.', []));
        result.realProviderTested = true; result.publicReplyRendered = true;
      })) return;
      result.status = 'PASS_NATIVE_CLINE_FREE_MODEL'; return;
    }
    if (scenario === 'legacy-refusal') {
      if (!await check('cline-native-legacy-route-refusal-without-write', async () => {
        const before = await stableSnapshot(); boundary = 'LEGACY_REFUSAL';
        const response = await vscode.commands.executeCommand('soterai.configurePinnedCline');
        const after = await snapshot(), adapter = await vscode.commands.executeCommand('soterai.clineAdapterStatus');
        const knownStatuses = ['APPLIED', 'ALREADY_CONFIGURED', 'CANCELLED', 'CHANGED', 'UNAVAILABLE', 'ROLLED_BACK', 'INCOMPLETE',
          'CLINE_DEFAULT_PROFILE_REQUIRED', 'CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED', 'CLINE_HOOKS_AND_REMOTE_CONFIG_OPT_OUT_REQUIRED',
          'ANOTHER_PROJECT_OWNS_SHARED_CLINE_CONFIG', 'CLINE_RESTORE_REQUIRED'];
        const changedEntries = before.files.flatMap((value, index) => JSON.stringify(value) === JSON.stringify(after.files[index]) ? []
          : [{ index, name: path.basename(managedFiles[index]) }]);
        result.legacyRefusal = { responseStatus: knownStatuses.includes(response?.status) ? response.status : response === undefined ? 'UNDEFINED' : 'UNEXPECTED',
          changedOwnedEntries: changedEntries, backupSnapshotChanged: JSON.stringify(before.backups) !== JSON.stringify(after.backups),
          adapterUnavailable: adapter?.status === 'UNAVAILABLE', vendorActivationComplete: vendor.isActive === true };
        demand(response?.status === 'CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED' && JSON.stringify(after) === JSON.stringify(before));
        demand(adapter?.status === 'UNAVAILABLE');
        result.refusalSnapshot = before;
      })) return;
      result.status = 'PASS_NATIVE_CLINE_LEGACY_REFUSAL'; return;
    }
    server = http.createServer(async (request, response) => {
      const observation = { methodMatched: request.method === 'POST', routeMatched: request.url === '/v1/chat/completions' };
      if (result.collectorObservations.length < 16) result.collectorObservations.push(observation);
      try {
        demand(request.method === 'POST' && request.url === '/v1/chat/completions' && requests.length < (scenario === 'setup-canaries' ? 10 : 4));
        let length = 0; const chunks = [];
        for await (const chunk of request) { length += chunk.length; demand(length <= 524288); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')), text = JSON.stringify(body);
        Object.assign(observation, { jsonDecoded: true, modelMatched: body.model === model, streamRequested: body.stream === true,
          publicControlMatched: text.includes(publicControl), upstreamAuthMatched: request.headers.authorization === 'Bearer ' + upstreamKey,
          unexpectedCredentialInBody: [originalKey, upstreamKey, 'BlueMango7!', 'OrangeRiver9!'].some(value => text.includes(value)),
          toolNames: Array.isArray(body.tools) ? body.tools.map(item => item?.function?.name).filter(name => typeof name === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(name)).slice(0, 40) : [] });
        demand(body.model === model && body.stream === true && text.includes(publicControl)
          && ![originalKey, upstreamKey, 'BlueMango7!', 'OrangeRiver9!'].some(value => text.includes(value)));
        demand(request.headers.authorization === 'Bearer ' + upstreamKey);
        const requestCanaryRedacted = /DB_PASSWORD\s*=\s*\[REDACTED_[A-Z_]+\]/.test(text);
        if (requestCanaryExpected) demand(requestCanaryRedacted);
        requests.push({ method: 'POST', route: '/v1/chat/completions', bytes: length, modelMatched: true, publicControlMatched: true, upstreamAuthMatched: true,
          requestCanaryExpected, requestCanaryRedacted });
        if (external) {
          const credential = process.env.AGENTROUTER_API_KEY;
          demand(!text.includes(credential));
          const upstream = await fetch('https://agentrouter.org/v1/chat/completions', {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential }, body: text,
          });
          const receipt = { status: upstream.status, requestSha256: sha(text), requestBytes: Buffer.byteLength(text), rawCanaryForwarded: false };
          result.externalProvider.requests.push(receipt);
          demand(upstream.status === 200 && upstream.body);
          const responseChunks = []; let responseBytes = 0;
          for await (const bytes of upstream.body) { responseBytes += bytes.length; demand(responseBytes <= 1048576); responseChunks.push(bytes); }
          const bodyBytes = Buffer.concat(responseChunks), responseText = bodyBytes.toString('utf8');
          demand(![credential, 'BlueMango7!', 'OrangeRiver9!'].some(value => responseText.includes(value)));
          demand(responseText.includes(publicControl) && responseText.includes('data:'));
          receipt.responseBytes = responseBytes; receipt.responseSha256 = sha(bodyBytes); receipt.publicControlReturned = true;
          result.responseKind = 'external-provider-stream';
          response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
          response.end(bodyBytes); replySent = true; replyCount++; return;
        }
        let reply = exports.syntheticReply(body.tools);
        if (scenario === 'setup-canaries' && text.includes('SOTERAI_NATIVE_TOOL_CANARY')) {
          if (!toolReadRequested) {
            const tool = body.tools.find(t => t.function?.name === 'soterai_safe_read__soterai_read_project_file_safely'); demand(tool);
            result.toolSchemaKeys = Object.keys(tool.function.parameters?.properties ?? {});
            reply = { kind: 'native-read-tool', finishReason: 'tool_calls', delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'native-canary-read', type: 'function', function: {
              name: tool.function.name, arguments: JSON.stringify({ path: 'canary-read.txt' }) } }] } };
            toolReadRequested = true;
          } else if (Array.isArray(body.messages) && body.messages.some(m => m.role === 'tool' && JSON.stringify(m).includes('SOTERAI_TOOL_CANARY_FILE'))) toolResultObserved = true;
        }
        result.responseKind = reply.kind;
        const chunk = (value, finish) => 'data: ' + JSON.stringify({ id: 'soterai-native-public', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta: value, finish_reason: finish }] }) + '\n\n';
        response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
        response.end(chunk(reply.delta, null) + chunk({}, reply.finishReason) + 'data: [DONE]\n\n'); replySent = true; replyCount++;
      } catch { collectorFailure = true; response.writeHead(400, { 'content-type': 'application/json' }); response.end('{"error":{"message":"Synthetic fixture refused this request"}}'); }
    });
    server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 4;
    await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
    const providerUrl = 'http://127.0.0.1:' + server.address().port + '/v1/chat/completions';
    if (!await check('cline-native-broker-provider-configuration', async () => {
      await ack('cline-configure-broker', { providerUrl }, () => vscode.commands.executeCommand('soterai.configureAIBroker'));
      demand(vscode.workspace.getConfiguration('soterai').get('broker.openAIProviderUrl') === providerUrl);
    })) return;
    if (!await check('cline-native-setup-cancel-without-owned-write', async () => {
      const before = await snapshot();
      const response = await ack('cline-setup-cancel', {}, () => vscode.commands.executeCommand('soterai.configurePinnedCline'));
      demand(response?.status === 'CANCELLED' && JSON.stringify(await snapshot()) === JSON.stringify(before));
    })) return;
    if (!await check('cline-native-reviewed-setup', async () => {
      const response = await ack('cline-setup-apply', {}, () => vscode.commands.executeCommand('soterai.configurePinnedCline'));
      demand(response?.status === 'APPLIED' && response.version === pin.version && response.badge === 'Uncovered');
      const state = JSON.parse(await ordinaryRead(out, path.join(out, 'profile/.cline/data/globalState.json'))); demand(!Object.hasOwn(state, 'openAiBaseUrl'));
      const provider = JSON.parse(await ordinaryRead(out, managedFiles[0])).providers['openai-compatible'].settings;
      const url = new URL(provider.baseUrl); demand(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/v1/ai/openai-compatible'
        && url.port && typeof provider.apiKey === 'string' && provider.apiKey !== originalKey && provider.headers.Authorization === 'Bearer ' + provider.apiKey);
      const configured = await snapshot(); demand(configured.files.every(Boolean) && configured.backups.length === 5);
      result.reviewedConfigSnapshot = configured;
    })) return;
    if (!await check('cline-native-idempotent-current-session', async () => {
      const before = await snapshot(), response = await vscode.commands.executeCommand('soterai.configurePinnedCline');
      demand(response?.status === 'ALREADY_CONFIGURED' && JSON.stringify(await snapshot()) === JSON.stringify(before));
      const status = await vscode.commands.executeCommand('soterai.clineAdapterStatus'); demand(status?.status === 'CONFIGURED_NEW_TASK_AND_ROUTE_VERIFICATION_REQUIRED' && status.badge === 'Uncovered');
    })) return;
    if (!await check('cline-native-public-loopback-route-and-reply', async () => {
      boundary = 'CLINE_PUBLIC_API';
      demand(vendor.isActive && typeof vendorApi?.startNewTask === 'function');
      await vscode.commands.executeCommand('claude-dev.SidebarProvider.focus');
      const prompt = 'Synthetic loopback route test. Submit exactly ' + publicControl + ' as your final summary. No files, commands, edits, browser, skills or other tools are needed.';
      await ack('cline-public-reply', { publicControl }, async () => {
        await vendorApi.startNewTask(prompt, []);
        await until(() => requests.length === 1 && replySent && !collectorFailure);
      });
      demand(requests.length === 1 && replySent && !collectorFailure);
      result.actualClineTrafficObserved = true; result.publicReplyRendered = true;
      result.collector = { requests, responseKind: result.responseKind, publicReplySent: replySent, externalProvider: external };
      if (external) result.realProviderTested = true;
      demand(sha(await ordinaryRead(out, path.join(vendor.extensionPath, 'package.json'), 65536)) === pin.manifestSha256
        && sha(await ordinaryRead(out, path.join(vendor.extensionPath, 'dist/extension.js'), 32 * 1024 * 1024)) === pin.runtimeSha256);
    })) return;
    if (scenario !== 'setup-attachment' && !await check('cline-native-recognized-request-canary-protected', async () => {
      boundary = 'CLINE_NATIVE_REQUEST_CANARY'; requestCanaryExpected = true;
      await vendorApi.startNewTask('Synthetic request canary: DB_PASSWORD=BlueMango7!\nReturn ' + publicControl + ' as a public summary. No files, commands or tools are needed.', []);
      const logRoot = path.join(out, 'profile/user-data/logs');
      async function withheldObserved(directory = logRoot, depth = 0) {
        if (depth > 6) return false;
        for (const item of await fs.readdir(directory, { withFileTypes: true })) {
          if (item.isSymbolicLink()) throw Error('CLINE_CHECK_FAILED');
          const file = path.join(directory, item.name);
          if (item.isDirectory() && await withheldObserved(file, depth + 1)) return true;
          if (item.isFile() && item.name.endsWith('Cline.log')) {
            // Cline appends while this observation runs; config/artifact reads
            // retain their strict unchanged-byte checks.
            const bytes = await ordinaryRead(out, file, 2 * 1024 * 1024, true);
            if (bytes.toString('utf8').includes('Gateway policy withheld protected data')) return true;
          }
        }
        return false;
      }
      const outcome = await until(async () => {
        demand(!collectorFailure);
        if (requests.length === 2 && replyCount === 2) return 'REDACTED_AND_FORWARDED';
        if (requests.length === 1 && await withheldObserved()) return 'WITHHELD';
      });
      if (outcome === 'REDACTED_AND_FORWARDED') demand(requests[1].requestCanaryRedacted === true);
      result.requestCanaryOutcome = outcome;
      // A fresh benign task proves the route is still useful after refusal.
      requestCanaryExpected = false;
      const before = requests.length, repliesBefore = replyCount;
      await vendorApi.startNewTask('Benign follow-up control. Return ' + publicControl + ' as a public summary. No files, commands or tools are needed.', []);
      await until(() => requests.length === before + 1 && replyCount === repliesBefore + 1 && !collectorFailure);
      result.benignTaskAfterCanarySucceeded = true;
      result.requestCanariesTested = true;
      result.requestCanaryScope = 'Actual Cline request containing a prefixed password was redacted or withheld, with useful controls before and after; exact withheld policy code and original client history are outside this check';
      result.collector.requests = requests;
    })) return;
    if (['setup-canaries','setup-attachment'].includes(scenario)) {
      async function clineLog() {
        const texts=[];
        async function visit(directory,depth=0){if(depth>6)return;for(const item of await fs.readdir(directory,{withFileTypes:true})){demand(!item.isSymbolicLink());const file=path.join(directory,item.name);if(item.isDirectory())await visit(file,depth+1);else if(item.isFile()&&item.name.endsWith('Cline.log'))texts.push((await ordinaryRead(out,file,2*1024*1024,true)).toString('utf8'));}}
        await visit(path.join(out,'profile/user-data/logs'));return texts.join('\n');
      }
      const count=(text,needle)=>text.split(needle).length-1;
      async function benign(){const before=requests.length,repliesBefore=replyCount;await vendorApi.startNewTask('Benign follow-up. Return '+publicControl+'. No files, commands or tools are needed.',[]);await until(()=>requests.length===before+1&&replyCount===repliesBefore+1&&!collectorFailure);}
      if (scenario === 'setup-canaries' && !await check('cline-native-tool-read-canary-protected',async()=>{
        boundary='CLINE_NATIVE_TOOL_CANARY';
        await fs.writeFile(path.join(workspace,'canary-read.txt'),'SOTERAI_TOOL_CANARY_FILE\nDB_PASSWORD="BlueMango7!"\n',{flag:'wx'});
        const before=requests.length,logBefore=await clineLog(),withheldBefore=count(logBefore,'Gateway policy withheld protected data');
        await vendorApi.startNewTask('SOTERAI_NATIVE_TOOL_CANARY. Read only canary-read.txt using the SoterAI safe reader, then return '+publicControl+'. No edits or commands.',[]);
        const outcome=await until(async()=>{demand(!collectorFailure);if(toolResultObserved)return 'REDACTED_TOOL_RESULT_FORWARDED';const log=await clineLog();
          if(toolReadRequested&&requests.length===before+1&&count(log,'Gateway policy withheld protected data')>withheldBefore)return 'TOOL_SEQUENCE_WITHHELD';
        },45000);
        result.nativeToolCanaryOutcome=outcome;result.toolResultCanariesTested=toolResultObserved;
        const consent=JSON.parse(await ordinaryRead(out,path.join(out,'safe-read-consent.json'),8192));demand(consent.runNonce===prepared.runNonce&&consent.safeTextChecked===true);
        result.nativeOwnerConsentObserved=true;result.nativeToolScope='Actual Cline SoterAI safe-reader MCP tool, native owner confirmation, recognized canary removed from the provider-visible result';
        result.nativeToolCallIssued=toolReadRequested;await benign();result.benignAfterToolCanary=true;
      }))return;
      if (!await check('cline-native-image-attachment-withheld',async()=>{
        boundary='CLINE_NATIVE_ATTACHMENT';const before=requests.length,logBefore=await clineLog();
        const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=';
        await vendorApi.startNewTask('Attachment test. Return '+publicControl+'. No files, commands or tools are needed.',[image]);
        const message=await until(async()=>{demand(!collectorFailure&&requests.length===before);const log=await clineLog();for(const marker of ['base64_unsupported','Request body could not be safely decoded','Base64 request could not be safely decoded','Gateway policy withheld protected data'])if(count(log,marker)>count(logBefore,marker))return marker;},45000);
        result.attachmentWithheldMarker=message;result.attachmentsTested=true;result.attachmentScope='One actual Cline PNG input withheld before reaching the synthetic provider';
        await benign();result.benignAfterAttachment=true;
      }))return;
    }
    result.status = external ? 'PASS_NATIVE_CLINE_AGENTROUTER' : 'PASS_NATIVE_CLINE_PUBLIC_LOOPBACK';
  } finally {
    // The real product command owns the broker child and measures its IPC stop;
    // fixture cleanup never guesses a PID or sends a signal to other processes.
    const stopped = await check('cline-native-owned-broker-cooperative-stop', async () => {
      boundary = 'OWNED_BROKER_COOPERATIVE_STOP';
      const snapshot = await vscode.commands.executeCommand('soterai.stopLocalAIBroker');
      const status = await vscode.commands.executeCommand('soterai.showBrokerStatus');
      result.brokerStopObservation = { stopState: snapshot?.state, statusState: status?.state, running: status?.running };
      demand(snapshot?.state === 'stopped' && status?.state === 'stopped' && status.running === false);
      result.ownedBrokerClose = { cooperativeCommandCompleted: true, state: 'stopped', running: false, arbitraryProcessSignalsRequested: false };
    });
    if (!stopped) result.status = 'FAIL_NATIVE_CLINE';
    if (server) { server.closeAllConnections(); await Promise.race([new Promise(done => server.close(done)), delay(2000)]); }
    result.collectorFailure = collectorFailure;
    await publish(path.join(out, 'host-result.json'), result);
  }
};
