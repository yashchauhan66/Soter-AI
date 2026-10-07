const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-gpg-override-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: temp });
fs.writeFileSync(path.join(temp, 'a.txt'), 'hello\n');
execFileSync('git', ['add', '.'], { cwd: temp });
execFileSync('git', ['commit', '-m', 'c1'], { cwd: temp });

const markerGpg = path.join(temp, 'marker_gpg.txt');
const gpgScript = path.join(temp, process.platform === 'win32' ? 'fake_gpg.bat' : 'fake_gpg.sh');
if (process.platform === 'win32') {
    fs.writeFileSync(gpgScript, `@echo off\r\necho hit > "${markerGpg}"\r\nexit /b 0\r\n`);
} else {
    fs.writeFileSync(gpgScript, `#!/bin/sh\necho hit > "${markerGpg}"\nexit 0\n`, { mode: 0o755 });
}
execFileSync('git', ['config', 'gpg.program', gpgScript], { cwd: temp });

// Signed commit
const tree = execFileSync('git', ['write-tree'], { cwd: temp, encoding: 'utf8' }).trim();
const commitData = `tree ${tree}
author Test <t@example.com> 1000000000 +0000
committer Test <t@example.com> 1000000000 +0000
gpgsig -----BEGIN PGP SIGNATURE-----
 Version: GnuPG v1

 iQEcBAABAgAGBQJ...
 -----END PGP SIGNATURE-----

signed commit
`;
const commitSha = execFileSync('git', ['hash-object', '-t', 'commit', '--stdin', '-w'], { cwd: temp, input: commitData, encoding: 'utf8' }).trim();
execFileSync('git', ['update-ref', 'refs/heads/main', commitSha], { cwd: temp });

// 1. Unhardened run: must execute fake_gpg and create marker
try { execFileSync('git', ['log', '--show-signature', '-1'], { cwd: temp }); } catch (e) {}
console.log('Unhardened marker exists:', fs.existsSync(markerGpg));
if (fs.existsSync(markerGpg)) fs.unlinkSync(markerGpg);

// 2. Direct override test with -c gpg.program=
try { execFileSync('git', ['-c', 'gpg.program=', 'log', '--show-signature', '-1'], { cwd: temp }); } catch (e) {}
console.log('Overridden marker exists:', fs.existsSync(markerGpg));

fs.rmSync(temp, { recursive: true, force: true });
