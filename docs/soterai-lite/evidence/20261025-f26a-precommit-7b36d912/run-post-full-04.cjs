// One heavy gate at a time. No native/editor launch and no native06 preparation.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { check, gate, fact, own, repo, OUTPUT } = require('./post-full04-contract.cjs');
try {
    const inputs = check(); delete inputs.sourceFiles;
    if (fs.existsSync(path.join(repo, OUTPUT))) throw Error('New attempt02 VSIX already exists.');
    const startFile = own('post-full-start-04.json'), completeFile = own('post-full-complete-04.json');
    if (fs.existsSync(startFile) || fs.existsSync(completeFile)) throw Error('Immutable serial run already exists.');
    fs.writeFileSync(startFile, JSON.stringify({ status: 'STARTED_NOT_COMPLETED', time: new Date().toISOString(), pid: process.pid,
        signalsRequested: 0, inputs, runner: fact(__filename), entry: fact(own('post-full-check-entry-04.ps1')) }, null, 2) + '\n', { flag: 'wx' });
    const receipts = {};
    for (const [mode, name] of [['backend-typecheck', 'backend-typecheck-04'], ['backend-tests', 'backend-tests-04'], ['native-build', 'native-build-04'], ['package', 'package-04']]) {
        const current = check(); delete current.sourceFiles;
        if (JSON.stringify(current) !== JSON.stringify(inputs)) throw Error('Checked gate identity changed.');
        cp.execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', own('post-full-check-entry-04.ps1'), '-Check', mode],
            { cwd: repo, windowsHide: true, shell: false, stdio: 'inherit' });
        const passed = gate(name); receipts[name] = { receipt: passed.receipt, raw: passed.raw };
    }
    check(); const artifact = fact(path.join(repo, OUTPUT));
    fs.writeFileSync(completeFile, JSON.stringify({ status: 'CURRENT_BACKEND_BUILD_PACKAGE_GATES_COMPLETED_NOT_NATIVE', time: new Date().toISOString(),
        inputs, receipts, artifact, signalsRequested: 0, driverProvenance: fact(own('native-driver-provenance-04.json')),
        limits: 'Fresh backend checks, 21-driver build and unique attempt02 packaging only; content and actual native acceptance pending.' }, null, 2) + '\n', { flag: 'wx' });
    console.log('Sequential current backend/build/package gates completed; content/native pending.');
} catch (error) { console.error(error); process.exitCode = 1; }
