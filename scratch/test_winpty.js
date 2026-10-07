const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-winpty-'));
execFileSync('git', ['init', '-b', 'main'], { cwd: temp });
fs.writeFileSync(path.join(temp, 'a.txt'), 'hello\n');
execFileSync('git', ['add', '.'], { cwd: temp });
execFileSync('git', ['commit', '-m', 'c1'], { cwd: temp });

const markerPager = path.join(temp, 'marker_winpty.txt');
const pagerScript = path.join(temp, 'fake_pager.bat');
fs.writeFileSync(pagerScript, `@echo off\r\necho hit > "${markerPager}"\r\ntype %1\r\nexit /b 0\r\n`);

execFileSync('git', ['config', 'core.pager', pagerScript], { cwd: temp });

const bash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const unixTemp = temp.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\\/g, '/');
console.log('Running winpty git log -1 in', unixTemp);
try {
    const out = execFileSync(bash, ['-c', `cd "${unixTemp}" && winpty git --paginate log -1`], { encoding: 'utf8' });
    console.log('out:\n', out);
} catch (e) {
    console.log('winpty threw:', e.message);
}

console.log('marker exists after winpty:', fs.existsSync(markerPager));
fs.rmSync(temp, { recursive: true, force: true });
