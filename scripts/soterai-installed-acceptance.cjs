'use strict';
// Run the exact installed VSIX in a separate VS Code profile. No normal profile,
// provider configuration, login, project source or historical evidence is modified.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const { resolveRelease } = require('../packages/soterai-lite/scripts/release-artifact.cjs');
const repo = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const executable = 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
const within = file => file.startsWith(repo + path.sep);
function run(args, env, cwd, timeoutMs = 30000, observe, visible = false) {
  return new Promise(resolve => {
    let bytes = 0, stdout = '', timedOut = false, done = false;
    const startedAt = Date.now();
    const child = spawn(executable, args, { env, cwd, shell: false, windowsHide: !visible, stdio: ['ignore', 'pipe', 'pipe'] });
    const observation = observe ? Promise.resolve().then(() => observe(child)).then(() => true, () => false) : Promise.resolve(true);
    const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on('error', () => finish({ ok: false, code: 'SPAWN_FAILED' }));
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 1048576) child.kill(); else stdout += chunk; });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 1048576) child.kill(); });
    child.on('close', async (code, signal) => { const observed = await observation; finish({ ok: code === 0 && !timedOut && bytes <= 1048576 && observed, exitCode: code, signal,
      code: timedOut ? 'TIMEOUT' : bytes > 1048576 ? 'OUTPUT_LIMIT' : !observed ? 'UI_OBSERVATION_FAILED' : code === 0 ? 'OK' : 'EXIT_NONZERO', stdout,
      pid: child.pid, startedAt, closedAt: Date.now(), processClosed: true }); });
  });
}
async function main() {
  const [mode, location, pointer, suite = 'foundation', scenario, option] = process.argv.slice(2);
  if (!['prepare', 'run'].includes(mode) || !location) throw Error('ARGUMENTS');
  const out = path.resolve(repo, location); if (!within(out)) throw Error('OUTPUT_SCOPE');
  if (mode === 'prepare') {
    if (!['foundation', 'workflow', 'restricted', 'vault', 'vault-app', 'vault-app-seed', 'vault-restart', 'cline'].includes(suite)) throw Error('SUITE');
    if (!pointer) throw Error('POINTER_REQUIRED');
    const pointerPath = path.resolve(repo, pointer); if (!within(pointerPath)) throw Error('POINTER_SCOPE');
    const release = await resolveRelease({ repoRoot: repo, pointerPath });
    const build = JSON.parse(await fs.readFile(path.join(repo, release.buildReceiptPath), 'utf8'));
    await fs.mkdir(out);
    for (const name of ['driver', 'workspace', 'profile', 'temp']) await fs.mkdir(path.join(out, name));
    await fs.writeFile(path.join(out, 'driver/package.json'), JSON.stringify({ name: 'soterai-acceptance-driver', publisher: 'local-test', version: '0.0.1', engines: { vscode: '^1.85.0' }, main: './extension.cjs', activationEvents: ['onStartupFinished'] }) + '\n', { flag: 'wx' });
    const nativeDriver = ['vault', 'vault-app', 'vault-app-seed', 'vault-restart', 'cline'].includes(suite);
    const nativeDriverSource = [
      "const fs = require('node:fs/promises'), path = require('node:path');",
      "exports.activate = () => { void (async () => { await new Promise(done => setTimeout(done, 1500));",
      "try { await require('./tests.cjs').run(); } catch (error) {",
      "const report = { schemaVersion: 1, status: 'DRIVER_FAILED', errorClass: ['Error','TypeError','ReferenceError','SyntaxError','RangeError'].includes(error?.name) ? error.name : 'OTHER', code: /^[A-Z0-9_]{1,40}$/.test(error?.code || '') ? error.code : undefined, testsSourceLines: (String(error?.stack || '').match(/tests[.]cjs:[0-9]+:[0-9]+/g) || []).slice(0, 3) };",
      "try { await fs.writeFile(path.join(__dirname, '../driver-failure.json'), JSON.stringify(report), { flag: 'wx' }); } catch {}",
      "} finally { await require('vscode').commands.executeCommand('workbench.action.quit'); } })(); };",
    ].join('\n') + '\n';
    await fs.writeFile(path.join(out, 'driver/extension.cjs'), nativeDriver
      ? nativeDriverSource
      : 'exports.activate = () => {};\n', { flag: 'wx' });
    const testSuite = ['vault-app', 'vault-app-seed'].includes(suite) ? 'vault' : suite;
    const tests = await fs.readFile(path.join(repo, suite === 'foundation' ? 'scripts/soterai-installed-acceptance.host.cjs' : `scripts/soterai-installed-${testSuite}.host.cjs`));
    await fs.writeFile(path.join(out, 'driver/tests.cjs'), tests, { flag: 'wx' });
    let rendererSha256;
    if (suite === 'workflow' || nativeDriver) {
      const renderer = await fs.readFile(path.join(repo, `scripts/soterai-installed-${testSuite}.renderer.cjs`));
      rendererSha256 = sha(renderer);
      await fs.writeFile(path.join(out, 'driver/renderer.cjs'), renderer, { flag: 'wx' });
      if (suite === 'workflow') {
        await fs.writeFile(path.join(out, 'workspace/debug.txt'), 'ECONNREFUSED connecting to the public mock service\nDB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\nRetry failed after 3 attempts.\n', { flag: 'wx' });
        await fs.writeFile(path.join(out, 'workspace/environment.txt'), 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\nAPP_PORT=5173\nDEBUG_ENABLED=true\nSERVICE_URL=https://local.example.invalid\n', { flag: 'wx' });
      }
    }
    if (['restricted', 'vault', 'vault-app', 'vault-app-seed'].includes(suite)) await fs.writeFile(path.join(out, 'workspace/.env'), 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n', { flag: 'wx' });
    let appFixtureSha256;
    if (suite === 'vault-app' || suite === 'vault-app-seed') {
      const app = Buffer.from("'use strict';\nconst {createHash}=require('node:crypto');\nconst digest=value=>typeof value==='string'?createHash('sha256').update(value).digest('hex'):'';\nconst ok=digest(process.env.DB_PASSWORD)==='f060b97a8a85125b4f5dc171880dbc6dac62945d4b12022b7f7fe624874a1115' && digest(process.env.API_PASSWORD)==='4b1438ce6fa727d17dc94afe735872798d9a8dec71679102148537c68c9494b9';\nprocess.stdout.write('VAULT_APP_OK='+String(ok)+'\\n');\n"
        + (suite === 'vault-app-seed' ? "process.stdout.write('VAULT_APP_PID='+process.pid+'\\n');\n" : '') + "process.exitCode=ok?0:1;\n");
      appFixtureSha256 = sha(app);
      await fs.writeFile(path.join(out, 'workspace/app-check.cjs'), app, { flag: 'wx' });
    }
    let restartSeed;
    if (suite === 'vault-restart') {
      if (!scenario) throw Error('SEED_REQUIRED');
      const cohortRoot = path.resolve(repo, scenario);
      if (!within(cohortRoot) || path.dirname(cohortRoot) !== path.dirname(out) || cohortRoot === out) throw Error('SEED_SCOPE');
      const hostBytes = await fs.readFile(path.join(cohortRoot, 'host-result.json'));
      const launchBytes = await fs.readFile(path.join(cohortRoot, 'native-launch.json'));
      const seed = JSON.parse(hostBytes), launch = JSON.parse(launchBytes);
      if (seed.status !== 'PASS_NATIVE_VAULT_APP_SEED' || seed.artifactSha256 !== release.sha256 || seed.sourceFinalState !== 'MASKED'
          || launch.artifactSha256 !== release.sha256 || launch.native?.ok !== true || launch.native?.code !== 'OK') throw Error('SEED_NOT_ACCEPTED');
      restartSeed = { cohortRoot, seedHostReportSha256: sha(hostBytes), seedLaunchReportSha256: sha(launchBytes),
        preservedSettingsSha256: sha(await fs.readFile(path.join(cohortRoot, 'profile/user-data/User/settings.json'))) };
    }
    let clineFixture;
    if (suite === 'cline') {
      clineFixture = require(path.join(repo, 'scripts/soterai-installed-cline.host.cjs')).fixture(scenario);
      if (clineFixture.artifactSha256 !== release.sha256) throw Error('CLINE_CANDIDATE_CHANGED');
      for (const [relative, value] of Object.entries(clineFixture.files)) {
        const target = path.resolve(out, relative);
        if (!target.startsWith(path.join(out, 'profile/.cline') + path.sep)) throw Error('CLINE_FIXTURE_SCOPE');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, JSON.stringify(value), { flag: 'wx' });
      }
      const source = 'C:\\Users\\USER\\.vscode\\extensions\\saoudrizwan.claude-dev-4.1.26';
      const target = path.join(out, 'profile/extensions/saoudrizwan.claude-dev-4.1.26');
      let count = 0, total = 0;
      async function copyPublicTree(from, to) {
        const stat = await fs.lstat(from);
        if (stat.isSymbolicLink()) throw Error('VENDOR_LINK');
        if (stat.isDirectory()) {
          await fs.mkdir(to, { recursive: true });
          for (const name of await fs.readdir(from)) await copyPublicTree(path.join(from, name), path.join(to, name));
        } else {
          if (!stat.isFile() || stat.nlink !== 1 || stat.size > 32 * 1024 * 1024 || ++count > 10000 || (total += stat.size) > 512 * 1024 * 1024) throw Error('VENDOR_SCOPE');
          await fs.writeFile(to, await fs.readFile(from), { flag: 'wx' });
        }
      }
      await copyPublicTree(source, target);
      if (sha(await fs.readFile(path.join(target, 'package.json'))) !== clineFixture.vendor.manifestSha256
          || sha(await fs.readFile(path.join(target, 'dist/extension.js'))) !== clineFixture.vendor.runtimeSha256) throw Error('VENDOR_CHANGED');
    }
    await fs.writeFile(path.join(out, 'workspace/app.txt'), 'const cfg = { DB_PASSWORD: "BlueMango7!", API_PASSWORD: "OrangeRiver9!" }; // public fixture\n', { flag: 'wx' });
    const launch = await fs.readFile(path.join(path.dirname(executable), 'bin/code.cmd'), 'utf8');
    const match = launch.split(/\r?\n/).map(line => line.match(/^"([^"]+)"\s+"([^"]+)"\s+%\*\s*$/i)).find(Boolean);
    if (!match) throw Error('LAUNCHER');
    const cli = path.resolve(match[2].replace(/^%~dp0/i, path.join(path.dirname(executable), 'bin') + path.sep));
    if (!cli.startsWith(path.dirname(executable) + path.sep)) throw Error('LAUNCHER_SCOPE');
    const prepared = { schemaVersion: 1, pointerPath, artifactSha256: release.sha256, artifactPath: release.artifactPath,
      identity: release.identity, version: release.version, cli, testsSha256: sha(tests), suite, nativeDriver, runNonce: randomBytes(16).toString('hex'), ...(rendererSha256 ? { rendererSha256 } : {}), ...(appFixtureSha256 ? { appFixtureSha256 } : {}),
      ...(clineFixture ? { clineScenario: scenario, vendor: clineFixture.vendor, extraSettings: clineFixture.settings,
        ...(scenario === 'cline-free' && option === 'wait-login' ? { waitForLogin: true } : {}) } : {}),
      ...(restartSeed ?? {}),
      runtimes: build.inventory.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })), normalProfileModified: false };
    await fs.writeFile(path.join(out, 'prepared.json'), JSON.stringify(prepared, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: 'PREPARED_NOT_RUN', out: path.relative(repo, out), artifactSha256: release.sha256 }));
    return;
  }
  const prepared = JSON.parse(await fs.readFile(path.join(out, 'prepared.json'), 'utf8'));
  const workflow = prepared.suite === 'workflow';
  const restricted = prepared.suite === 'restricted', seed = prepared.suite === 'vault-app-seed', restart = prepared.suite === 'vault-restart';
  const app = prepared.suite === 'vault-app' || seed, cline = prepared.suite === 'cline', vault = prepared.suite === 'vault' || app || restart, withUi = workflow || vault || cline;
  if (prepared.suite !== undefined && !['foundation', 'workflow', 'restricted', 'vault', 'vault-app', 'vault-app-seed', 'vault-restart', 'cline'].includes(prepared.suite)) throw Error('SUITE');
  if (withUi && sha(await fs.readFile(path.join(out, 'driver/renderer.cjs'))) !== prepared.rendererSha256) throw Error('RENDERER_CHANGED');
  const release = await resolveRelease({ repoRoot: repo, pointerPath: prepared.pointerPath });
  const build = JSON.parse(await fs.readFile(path.join(repo, release.buildReceiptPath), 'utf8'));
  if (prepared.identity !== release.identity || prepared.version !== release.version || prepared.artifactPath !== release.artifactPath
      || JSON.stringify(prepared.runtimes) !== JSON.stringify(build.inventory.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })))) throw Error('BUILD_CHANGED');
  if (release.sha256 !== prepared.artifactSha256 || sha(await fs.readFile(path.join(out, 'driver/tests.cjs'))) !== prepared.testsSha256) throw Error('PREPARATION_CHANGED');
  try { await fs.lstat(path.join(out, 'native-launch.json')); throw Error('RUN_ALREADY_RECORDED'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const name of ['host-result.json', 'renderer-result.json', 'renderer-ready.json']) {
    try { await fs.lstat(path.join(out, name)); throw Error('STALE_HOST_EVIDENCE'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const cohort = restart ? path.resolve(prepared.cohortRoot) : out;
  if (!within(cohort) || (restart && path.dirname(cohort) !== path.dirname(out))) throw Error('COHORT_SCOPE');
  const profile = path.join(cohort, 'profile');
  const env = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PATH: 'C:\\Windows\\System32;C:\\Program Files\\Git\\cmd',
    USERPROFILE: profile, APPDATA: path.join(profile, 'AppData/Roaming'), LOCALAPPDATA: path.join(profile, 'AppData/Local'),
    TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp'), SOTERAI_ACCEPTANCE_DIRECTORY: out };
  if (cline) env.PATH += ';C:\\Windows\\System32\\WindowsPowerShell\\v1.0';
  if (cline && prepared.clineScenario === 'agentrouter') {
    if (!process.env.AGENTROUTER_API_KEY) throw Error('AGENTROUTER_TEST_KEY_REQUIRED');
    env.AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY;
  }
  for (const name of ['APPDATA', 'LOCALAPPDATA']) await fs.mkdir(env[name], { recursive: true });
  await fs.mkdir(path.join(profile, 'user-data/User'), { recursive: true });
  if (restart) {
    if (sha(await fs.readFile(path.join(profile, 'user-data/User/settings.json'))) !== prepared.preservedSettingsSha256) throw Error('SEED_SETTINGS_CHANGED');
  } else await fs.writeFile(path.join(profile, 'user-data/User/settings.json'), JSON.stringify({ 'update.mode': 'none', 'extensions.autoCheckUpdates': false, 'extensions.autoUpdate': false,
    'telemetry.telemetryLevel': 'off', 'git.enabled': false, 'git.autoRepositoryDetection': false,
    ...(vault ? { 'window.dialogStyle': 'custom', 'soterai.autoVaultMigration.enabled': false } : {}),
    ...(app ? { 'files.simpleDialog.enable': true, 'files.dialog.defaultPath': path.join(out, 'workspace') } : {}),
    ...(cline ? prepared.extraSettings : {}),
    ...(restricted ? { 'security.workspace.trust.enabled': true, 'security.workspace.trust.startupPrompt': 'never' } : {}) }), { flag: 'wx' });
  const common = ['--user-data-dir', path.join(profile, 'user-data'), '--extensions-dir', path.join(profile, 'extensions'), '--disable-telemetry', '--skip-welcome', '--skip-release-notes', '--disable-updates'];
  const installation = await run([prepared.cli, ...common, '--install-extension', path.join(repo, release.artifactPath)], { ...env, ELECTRON_RUN_AS_NODE: '1' }, out);
  const result = { schemaVersion: 1, artifactSha256: release.sha256, install: { ok: installation.ok, code: installation.code }, native: { ok: false, code: 'NOT_RUN' }, normalProfileModified: false, providerTested: false, releaseReady: false };
  if (installation.ok) {
    const native = await run([...common, '--new-window', '--wait', '--disable-gpu', ...(restricted ? [] : ['--disable-workspace-trust']),
      ...(withUi ? ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'] : []),
      '--extensionDevelopmentPath=' + path.join(out, 'driver'),
      ...(prepared.nativeDriver ? [] : ['--extensionTestsPath=' + path.join(out, 'driver/tests.cjs')]), path.join(cohort, 'workspace')], env, out, prepared.waitForLogin ? 600000 : withUi ? 150000 : 90000,
      withUi ? async child => require(path.join(out, 'driver/renderer.cjs')).run(out, child) : undefined, prepared.waitForLogin === true);
    result.native = { ok: native.ok, code: native.code, pid: native.pid, startedAt: native.startedAt,
      closedAt: native.closedAt, processClosed: native.processClosed === true };
    try {
      const report = JSON.parse(await fs.readFile(path.join(out, 'host-result.json'), 'utf8')); result.hostReport = report;
      const required = workflow ? ['exact-installed-extension-activation', 'debug-reviewed-copy', 'environment-reviewed-copy', 'keep-preview-without-copy', 'cancel-without-copy', 'source-drift-refusal', 'preview-drift-refusal', 'settings-drift-refusal', 'concurrent-review-refusal', 'live-quickfix-reviewed-copy', 'one-use-action-refusal']
        : restart ? ['exact-installed-extension-activation', 'persisted-masked-source-and-ciphertext', 'persisted-reviewed-app-configuration', 'restarted-vault-app-selected-runtime', 'restart-restore-cancel-without-write', 'restart-reviewed-raw-restoration']
        : cline ? ['cline-native-synthetic-home-isolation', 'exact-installed-extension-activation', 'exact-installed-cline-artifact', 'cline-native-vendor-activation-ready', 'cline-native-owned-broker-cooperative-stop', ...(prepared.clineScenario === 'cline-free' ? ['cline-native-free-model-public-reply'] : prepared.clineScenario === 'legacy-refusal' ? ['cline-native-legacy-route-refusal-without-write'] : ['cline-native-broker-provider-configuration', 'cline-native-setup-cancel-without-owned-write', 'cline-native-reviewed-setup', 'cline-native-idempotent-current-session', 'cline-native-public-loopback-route-and-reply', ...(prepared.clineScenario === 'setup-attachment' ? ['cline-native-image-attachment-withheld'] : ['cline-native-recognized-request-canary-protected']), ...(prepared.clineScenario === 'setup-canaries' ? ['cline-native-tool-read-canary-protected','cline-native-image-attachment-withheld'] : [])])]
        : restricted ? ['exact-installed-extension-activation', 'restricted-local-findings', 'restricted-reviewed-context-refusal', 'restricted-vault-migration-refusal', 'restricted-finding-action-refusal', 'restricted-adapter-setup-refusal']
        : vault ? ['exact-installed-extension-activation', 'vault-migration-cancel-without-write', 'vault-reviewed-migration', 'vault-encrypted-records-and-safe-example', ...(!seed ? ['vault-restore-cancel-without-write', 'vault-reviewed-raw-restoration'] : []), ...(app ? ['vault-app-reviewed-configuration', 'vault-app-selected-runtime'] : [])]
        : ['exact-installed-extension-activation', 'declared-production-commands', 'native-live-findings-and-actions', 'native-stale-action-refusal'];
      const status = workflow ? 'PASS_NATIVE_REVIEWED_WORKFLOW' : restart ? 'PASS_NATIVE_VAULT_RESTART' : seed ? 'PASS_NATIVE_VAULT_APP_SEED' : cline ? (prepared.clineScenario === 'cline-free' ? 'PASS_NATIVE_CLINE_FREE_MODEL' : prepared.clineScenario === 'legacy-refusal' ? 'PASS_NATIVE_CLINE_LEGACY_REFUSAL' : prepared.clineScenario === 'agentrouter' ? 'PASS_NATIVE_CLINE_AGENTROUTER' : 'PASS_NATIVE_CLINE_PUBLIC_LOOPBACK') : restricted ? 'PASS_NATIVE_RESTRICTED_WORKSPACE' : app ? 'PASS_NATIVE_VAULT_APP_WORKFLOW' : vault ? 'PASS_NATIVE_VAULT_WORKFLOW' : 'PASS_NATIVE_FOUNDATION';
      if (report.artifactSha256 !== release.sha256 || report.installedExtensionVersion !== release.version || (prepared.runNonce && report.runNonce !== prepared.runNonce)
          || report.status !== status || !Array.isArray(report.checks)
          || required.some(name => !report.checks.some(check => check.name === name && check.status === 'PASS')) || report.checks.some(check => check.status !== 'PASS')) {
        result.native.ok = false; result.native.code = 'HOST_REPORT_FAILED';
      }
    } catch { result.native.ok = false; result.native.code = 'HOST_REPORT_MISSING'; }
  }
  await fs.writeFile(path.join(out, 'native-launch.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
  if (!result.native.ok) process.exitCode = 2;
}
module.exports = { run };
if (require.main === module) main().catch(() => { console.error('Installed acceptance unavailable; no native success claimed.'); process.exitCode = 2; });
