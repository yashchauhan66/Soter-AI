const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-pager-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: temp });
fs.writeFileSync(path.join(temp, 'a.txt'), 'line1\nline2\nline3\n');
execFileSync('git', ['add', '.'], { cwd: temp });
execFileSync('git', ['commit', '-m', 'c1'], { cwd: temp });

const markerPager = path.join(temp, 'marker_pager.txt').replace(/\\/g, '/');
const pagerScript = path.join(temp, process.platform === 'win32' ? 'fake_pager.bat' : 'fake_pager.sh');
if (process.platform === 'win32') {
    fs.writeFileSync(pagerScript, `@echo off\r\necho hit > "${markerPager}"\r\ntype %1\r\nexit /b 0\r\n`);
} else {
    fs.writeFileSync(pagerScript, `#!/bin/sh\necho hit > "${markerPager}"\ncat "$@"\nexit 0\n`, { mode: 0o755 });
}

execFileSync('git', ['config', 'core.pager', pagerScript], { cwd: temp });
execFileSync('git', ['config', 'pager.log', 'true'], { cwd: temp });

// Try verschiedene methods to trigger pager
console.log('Method 1: --paginate with GIT_PAGER_IN_EDITOR=1');
try {
    spawnSync('git', ['--paginate', 'log', '-1'], {
        cwd: temp,
        env: { ...process.env, GIT_PAGER_IN_EDITOR: '1', PAGER: pagerScript, GIT_PAGER: pagerScript },
        stdio: 'inherit',
    });
} catch (e) {
    console.log('Method 1 threw:', e);
}
console.log('marker exists after method 1:', fs.existsSync(markerPager));
if (fs.existsSync(markerPager)) fs.unlinkSync(markerPager);

console.log('Method 2: GIT_PAGER with git -p');
try {
    spawnSync('git', ['-p', 'log', '-1'], {
        cwd: temp,
        env: { ...process.env, GIT_PAGER: pagerScript, TERM: 'xterm' },
        stdio: 'inherit',
    });
} catch (e) {}
console.log('marker exists after method 2:', fs.existsSync(markerPager));
if (fs.existsSync(markerPager)) fs.unlinkSync(markerPager);

console.log('Method 3: pipe / script / pty check');
// On Windows, does git check isatty(1)?
// If stdio is inherit or a pseudo-console or python pty?
try {
    const pythonCode = `
import pty, os, subprocess
master, slave = pty.openpty()
p = subprocess.Popen(['git', '--paginate', 'log', '-1'], cwd=r'${temp}', stdout=slave, stderr=slave, stdin=slave)
os.close(slave)
os.read(master, 1024)
os.close(master)
p.wait()
`;
    // Python on windows might not have pty, check
    spawnSync('python', ['-c', pythonCode]);
} catch (e) {
    console.log('Method 3 pty threw:', e.message);
}
console.log('marker exists after method 3:', fs.existsSync(markerPager));

fs.rmSync(temp, { recursive: true, force: true });
