'use strict';
// INERT launcher source contract. These helpers do not launch on import.
// Root must bind the current exact VSIX/source/vendor receipts and materialize
// one reviewed runner; this file deliberately has no executable main function.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const SAFE_SETTINGS = Object.freeze({
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.autoUpdate': false,
  'extensions.autoCheckUpdates': false,
  'extensions.ignoreRecommendations': true,
  'workbench.enableExperiments': false,
  'chat.disableAIFeatures': true,
  'git.enabled': false,
  'git.autoRepositoryDetection': false,
  'git.openRepositoryInParentFolders': 'never',
  'typescript.disableAutomaticTypeAcquisition': true,
  'json.schemaDownload.enable': false,
  'security.workspace.trust.enabled': true,
  'security.workspace.trust.startupPrompt': 'always',
  'security.workspace.trust.emptyWindow': false,
  'soterai.cloud.enabled': false,
  'soterai.privacyMode': 'local',
  'soterai.telemetry.redactedEvents': 'off',
  'soterai.autoVaultMigration.enabled': false,
  'soterai.broker.autoStart': false,
  'soterai.cloud.baseUrl': '',
  'soterai.broker.openAIProviderUrl': '',
  'soterai.broker.anthropicProviderUrl': '',
  'soterai.broker.codexResponsesProviderUrl': '',
  'soterai.broker.geminiProviderUrl': ''
});
function validate(b) {
  assert.equal(b.schemaVersion, 1); assert.equal(b.feature, 'F32');
  assert.equal(b.admission, 'FINAL_SOURCE_EXACT_VSIX_CURRENT_VENDOR_AND_OWNER_ABSENCE_REVIEWED');
  assert(Number.isInteger(b.normalRound) && b.normalRound >= 1 && b.normalRound <= 3);
  assert.equal(b.syntheticOnly, true); assert.equal(b.signalsRequested, 0);
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(b.runRoot));
  for (const key of ['profile', 'extensions', 'workspace', 'gate', 'observerRoot']) {
    const rel = path.relative(b.runRoot, b[key]);
    assert(rel && !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep));
  }
  for (const key of ['retainedInputsPath', 'retainedGeneratedPath', 'restartExpectedPath']) {
    const rel = path.relative(b.runRoot, b[key]);
    assert(rel && !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep));
  }
  assert.equal(b.product.id, 'soterai.soterai-ide-guard');
  assert(Number.isSafeInteger(b.configuredBrokerPort) && b.configuredBrokerPort >= 1024 &&
    b.configuredBrokerPort <= 65535 && b.configuredBrokerPort !== 47321);
  assert(typeof b.product.version === 'string');
  if (b.phase === 'upgrade-old') {
    assert.equal(b.product.version, '0.6.3');
    assert.equal(b.vsix.sha256, 'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677');
    assert.equal(b.vsix.bytes, 4446653);
  } else assert.notEqual(b.product.version, '0.6.3', 'Current phases cannot fake an old-version upgrade');
  assert.equal(b.vsix.localOnly, true);
  assert(!b.vsix.extensionDependencies?.length && !b.vsix.extensionPack?.length);
  assert.equal(b.productDevelopmentPath, undefined);
  assert.equal(b.productBootstrap, undefined);
  assert.equal(b.promptInterception, false);
  return b;
}
function environment(b, bindingFile, cli = false) {
  validate(b);
  const result = {
    SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
    USERPROFILE: b.profile, HOME: path.join(b.profile, 'Home'),
    APPDATA: path.join(b.profile, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(b.profile, 'AppData', 'Local'),
    XDG_CONFIG_HOME: path.join(b.profile, 'XdgConfig'), XDG_DATA_HOME: path.join(b.profile, 'XdgData'),
    TEMP: path.join(b.profile, 'Temp'), TMP: path.join(b.profile, 'Temp'),
    PATH: 'C:\\Windows\\System32;C:\\Program Files\\nodejs',
    DO_NOT_TRACK: '1', SOTERAI_F32_BINDING: bindingFile
  };
  if (cli) result.ELECTRON_RUN_AS_NODE = '1';
  return result;
}
function cliArgs(b, operation) {
  validate(b);
  const prefix = [b.codeCli.path, '--user-data-dir=' + b.profile, '--extensions-dir=' + b.extensions];
  if (operation === 'install') return [...prefix, '--install-extension', b.vsix.path, '--do-not-sync', '--force'];
  if (operation === 'list') return [...prefix, '--list-extensions', '--show-versions'];
  if (operation === 'uninstall') return [...prefix, '--uninstall-extension', b.product.id, '--do-not-sync'];
  throw Error('Unknown operation cannot become CLI authority');
}
function windowArgs(b, phase, port) {
  validate(b); assert(['primary', 'restart', 'upgrade-old', 'upgrade-current', 'upgrade-restart', 'untrusted', 'disabled', 'uninstalled'].includes(phase));
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
  return [
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port,
    // Only this separate observer is a development extension. Product is CLI installed.
    '--extensionDevelopmentPath=' + b.observerRoot,
    '--user-data-dir=' + b.profile, '--extensions-dir=' + b.extensions,
    '--new-window', '--disable-gpu', '--disable-updates', '--skip-welcome', '--skip-release-notes',
    '--disable-extension=vscode.git', '--disable-extension=vscode.github',
    '--disable-extension=vscode.github-authentication', '--disable-extension=vscode.microsoft-authentication',
    '--disable-extension=vscode.typescript-language-features', '--disable-extension=vscode.npm',
    ...(phase === 'disabled' ? ['--disable-extension=' + b.product.id] : []),
    b.workspace
  ];
}
function prepareUserSettings(b) {
  validate(b);
  const target = path.join(b.profile, 'User', 'settings.json');
  assert(!fs.existsSync(target), 'Never overwrite a profile or reuse an earlier fixture');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ ...SAFE_SETTINGS, 'soterai.broker.port': b.configuredBrokerPort }, null, 2) + '\n', { flag: 'wx' });
}
module.exports = { SAFE_SETTINGS, validate, environment, cliArgs, windowArgs, prepareUserSettings };
