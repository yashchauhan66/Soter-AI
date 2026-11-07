// Sequential heavy gates only after actual current full02/compiler13 PASS.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..'), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function checkInputs() {
 const file = path.join(__dirname, 'full-inputs-02.json'), raw = fs.readFileSync(file);
 if (sha(raw) !== '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322') throw Error('Current source proof differs.');
 const proof = JSON.parse(raw); if (proof.files.length !== 989) throw Error('Full source membership differs.');
 for (const entry of proof.files) { const current = fs.readFileSync(path.join(repo, entry.path)); if (current.length !== entry.bytes || sha(current) !== entry.sha256) throw Error('Current source input drift: ' + entry.path); }
}
function gate(name) {
 const file = path.join(__dirname, name + '.txt'), receipt = json(file + '.result.json');
 if (receipt.exitCode !== 0 || receipt.sha256.toLowerCase() !== sha(fs.readFileSync(file))) throw Error('Current gate unavailable: ' + name);
 return receipt;
}
try {
 checkInputs(); gate('compiler-13'); gate('full-tests-02');
 const started = { status: 'STARTED_NOT_COMPLETED', time: new Date().toISOString(), pid: process.pid, signalsRequested: 0, sourceProof: 'full-inputs-02.json' };
 fs.writeFileSync(path.join(__dirname, 'post-full-start-01.json'), JSON.stringify(started, null, 2) + '\n', { flag: 'wx' });
 for (const mode of ['backend-typecheck','backend-tests','native-build','package']) {
  checkInputs();
  cp.execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'post-full-check-entry-01.ps1'),'-Check',mode],
   { cwd: repo, windowsHide: true, shell: false, stdio: 'inherit' });
  gate(({ 'backend-typecheck': 'backend-typecheck-01', 'backend-tests': 'backend-tests-01', 'native-build': 'native-build-01', package: 'package-01' })[mode]);
 }
 checkInputs();
 fs.writeFileSync(path.join(__dirname, 'post-full-complete-01.json'), JSON.stringify({ status: 'CURRENT_BACKEND_BUILD_PACKAGE_GATES_COMPLETED_NOT_NATIVE', time: new Date().toISOString(), signalsRequested: 0 }, null, 2) + '\n', { flag: 'wx' });
 console.log('Current sequential backend,21driver and four-runtime package gates completed; content/native pending.');
} catch (error) { console.error(error); process.exitCode = 1; }
