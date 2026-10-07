const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-pt-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: temp });
fs.writeFileSync(path.join(temp, 'a.txt'), 'hello\n');
execFileSync('git', ['add', '.'], { cwd: temp });
execFileSync('git', ['commit', '-m', 'c1'], { cwd: temp });

const markerPager = path.join(temp, 'marker_pt.txt');
const pagerScript = path.join(temp, 'fake_pager.bat');
fs.writeFileSync(pagerScript, `@echo off\r\necho hit > "${markerPager}"\r\nexit /b 0\r\n`);

execFileSync('git', ['config', 'core.pager', pagerScript], { cwd: temp });

// Test 1: spawnSync with stdio: 'inherit'
spawnSync('cmd.exe', ['/c', 'git --paginate log -1'], {
    cwd: temp,
    stdio: 'inherit',
    env: { ...process.env, TERM: 'xterm', GIT_PAGER_IN_EDITOR: '1' }
});
console.log('inherit marker exists:', fs.existsSync(markerPager));

// Test 2: powershell Start-Process
if (!fs.existsSync(markerPager)) {
    spawnSync('powershell.exe', ['-Command', `Start-Process git -ArgumentList '--paginate','log','-1' -WorkingDirectory '${temp}' -Wait -NoNewWindow`], {
        stdio: 'inherit',
        env: { ...process.env, TERM: 'xterm', GIT_PAGER_IN_EDITOR: '1' }
    });
    console.log('powershell marker exists:', fs.existsSync(markerPager));
}

// Test 3: script command if available on linux / WSL / python
// check if python has pty
try {
    const py = spawnSync('python', ['-c', 'import pty; print("pty available")']);
    console.log('python pty:', py.stdout ? py.stdout.toString().trim() : 'no');
} catch (e) {
    console.log('python pty error:', e.message);
}

fs.rmSync(temp, { recursive: true, force: true });
