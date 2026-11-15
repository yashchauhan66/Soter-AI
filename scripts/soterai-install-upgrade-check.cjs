'use strict';
// Installation/metadata upgrade only. GUI, vault decryption and recovery are separate.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { resolveRelease } = require('../packages/soterai-lite/scripts/release-artifact.cjs');
const repo = path.resolve(__dirname, '..');
const executable = 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
async function main() {
  const [pointer, directory] = process.argv.slice(2); if (!pointer || !directory) throw Error();
  const out = path.resolve(repo, directory); if (!out.startsWith(repo + path.sep)) throw Error();
  const release = await resolveRelease({ repoRoot: repo, pointerPath: path.resolve(repo, pointer) });
  await fs.mkdir(out);
  const baseline = path.join(repo, 'packages/vscode-extension/soterai-ide-guard-0.6.2.vsix');
  const baselineHash = createHash('sha256').update(await fs.readFile(baseline)).digest('hex');
  const launcher = await fs.readFile(path.join(path.dirname(executable), 'bin/code.cmd'), 'utf8');
  const invocation = launcher.split(/\r?\n/).map(line => line.match(/^"([^"]+)"\s+"([^"]+)"\s+%\*\s*$/i)).find(Boolean); if (!invocation) throw Error();
  const cli = path.resolve(invocation[2].replace(/^%~dp0/i, path.join(path.dirname(executable), 'bin') + path.sep));
  const profile = path.join(out, 'profile'), extensions = path.join(out, 'extensions');
  await fs.mkdir(profile); await fs.mkdir(extensions); await fs.mkdir(path.join(out, 'temp'));
  const env = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', PATH: 'C:\\Windows\\System32', ELECTRON_RUN_AS_NODE: '1',
    USERPROFILE: profile, APPDATA: path.join(profile, 'AppData/Roaming'), LOCALAPPDATA: path.join(profile, 'AppData/Local'), TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') };
  for (const key of ['APPDATA', 'LOCALAPPDATA']) await fs.mkdir(env[key], { recursive: true });
  async function command(args) {
    return new Promise((resolve, reject) => {
      let size = 0, stdout = '', settled = false;
      const child = spawn(executable, [cli, '--user-data-dir', profile, '--extensions-dir', extensions, '--disable-telemetry', ...args], { env, cwd: out, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); if (!ok) child.kill(); ok ? resolve(stdout) : reject(Error('CLI_UNAVAILABLE')); };
      const timer = setTimeout(() => finish(false), 30000);
      child.on('error', () => finish(false));
      child.stdout.on('data', chunk => { size += chunk.length; if (size > 524288) finish(false); else stdout += chunk; });
      child.stderr.on('data', chunk => { size += chunk.length; if (size > 524288) finish(false); });
      child.on('close', code => finish(code === 0));
    });
  }
  const result = { schemaVersion: 1, status: 'UNAVAILABLE', baselineSha256: baselineHash, candidateSha256: release.sha256,
    baselineVersion: '0.6.2', candidateVersion: release.version, guiTested: false, vaultRecoveryTested: false, normalProfileModified: false, releaseReady: false };
  try {
    await command(['--install-extension', baseline]);
    if (!(await command(['--list-extensions', '--show-versions'])).split(/\r?\n/).includes(release.identity + '@0.6.2')) throw Error();
    const marker = path.join(profile, 'User/globalStorage/soterai.soterai-ide-guard/synthetic-upgrade-marker.json');
    await fs.mkdir(path.dirname(marker), { recursive: true }); const bytes = Buffer.from('{"syntheticOnly":true,"preserve":true}\n');
    await fs.writeFile(marker, bytes, { flag: 'wx' });
    await command(['--install-extension', path.join(repo, release.artifactPath), '--force']);
    if (!(await command(['--list-extensions', '--show-versions'])).split(/\r?\n/).includes(release.identity + '@' + release.version)) throw Error();
    if (!(await fs.readFile(marker)).equals(bytes)) throw Error();
    const roots = (await fs.readdir(extensions)).filter(name => name.startsWith(release.identity + '-' + release.version));
    if (roots.length !== 1) throw Error();
    const manifest = JSON.parse(await fs.readFile(path.join(extensions, roots[0], 'package.json'), 'utf8'));
    if (manifest.version !== release.version || manifest.publisher + '.' + manifest.name !== release.identity) throw Error();
    const build = JSON.parse(await fs.readFile(path.join(repo, release.buildReceiptPath), 'utf8'));
    for (const runtime of build.inventory) { const installed = await fs.readFile(path.join(extensions, roots[0], 'dist', runtime.name)); if (installed.length !== runtime.bytes || createHash('sha256').update(installed).digest('hex') !== runtime.sha256) throw Error(); }
    result.status = 'PASS_CLI_UPGRADE_METADATA_ONLY'; result.syntheticGlobalStorageMarkerPreserved = true; result.runtimeHashesVerified = 4;
  } catch { process.exitCode = 2; }
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
}
main().catch(() => { console.error('Install upgrade verification unavailable.'); process.exitCode = 2; });
