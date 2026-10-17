// Synthetic version-only diagnostic. Authored only; root executes and retains.
// Every executable/argument is fixed. No repo/history/config body is read and
// no timeout, shell launcher, profile, process termination or cleanup is used.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..'), git = 'C:\\Program Files\\Git\\cmd\\git.exe', ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soter-f10-git-versiondiag-')), job = fs.mkdtempSync(path.join(os.tmpdir(), 'soter-f10-git-versiondiag-job-'));
fs.mkdirSync(path.join(job, 'empty-hooks')); fs.writeFileSync(path.join(job, 'empty.gitconfig'), '', { flag: 'wx' });
const env = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, COMSPEC: process.env.COMSPEC, HOME: job, USERPROFILE: job, TEMP: job, TMP: job, XDG_CONFIG_HOME: job,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(job, 'empty.gitconfig'), GIT_CONFIG_SYSTEM: path.join(job, 'empty.gitconfig'), GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_ATTR_NOSYSTEM: '1', GIT_PROTOCOL_FROM_USER: '0' };
function finite(file, args, input) { return new Promise((resolve, reject) => {
    const child = cp.spawn(file, args, { cwd: root, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }), out = [], err = []; let bytes = 0;
    child.once('error', reject); child.stdout.on('data', value => { bytes += value.length; if (bytes <= 65536) out.push(value); });
    child.stderr.on('data', value => { bytes += value.length; if (bytes <= 65536) err.push(value); });
    child.once('close', code => bytes > 65536 ? reject(new Error('Finite diagnostic output exceeded bound.')) : resolve({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
    child.stdin.end(input);
}); }
const original = fs.readFileSync(path.join(repo, 'packages/vscode-extension/src/terminal/PowerShell51Worker.ts'), 'utf8').split('const SCRIPT = String.raw`')[1].split('`;')[0];
const prelude = original.split('\ntry {')[0], noFunctions = prelude.replace(/^function .+$/gm, ''), withoutGetItem = prelude.replace(/^function Get-Item .+$/gm, '');
const invoke = String.raw`
$git = 'C:\Program Files\Git\cmd\git.exe'
$beforeErrors = $Error.Count
$beforeExit = $LASTEXITCODE
try {
    $version = @(& $git --version)
    $nativeSuccess = $?
    $answer = @{version=@($version); count=$version.Count; lastExit=$LASTEXITCODE; beforeExit=$beforeExit; success=$nativeSuccess; errorDelta=($Error.Count-$beforeErrors)}
    [Console]::WriteLine((Microsoft.PowerShell.Utility\ConvertTo-Json -Compress -Depth 4 -InputObject $answer))
} catch { [Console]::WriteLine(('DIAGNOSTIC-EXCEPTION ' + $_.Exception.Message)); throw }
`;
const dotnet = String.raw`
$info = New-Object System.Diagnostics.ProcessStartInfo
$info.FileName = 'C:\Program Files\Git\cmd\git.exe'
$info.Arguments = '--version'
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardInput = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$native = New-Object System.Diagnostics.Process
$native.StartInfo = $info
[void]$native.Start()
$native.StandardInput.Close()
$stdout = $native.StandardOutput.ReadToEnd()
$stderr = $native.StandardError.ReadToEnd()
$native.WaitForExit()
[Console]::WriteLine((Microsoft.PowerShell.Utility\ConvertTo-Json -Compress -InputObject @{code=$native.ExitCode;stdout=$stdout;stderr=$stderr}))
$native.Dispose()
`;
(async () => {
    const results = [];
    results.push({ name: 'node-direct-version', result: await finite(git, ['--version']) });
    const variants = [
        ['minimal-native', noFunctions + invoke],
        ['all-shadow-functions-native', prelude + invoke],
        ['without-Get-Item-shadow-native', withoutGetItem + invoke],
        ['Get-Item-shadow-only-native', noFunctions + "\nfunction Get-Item { throw 'Use the approved reader.' }\n" + invoke],
        ['all-shadows-after-stdin-EOF-native', prelude + '\n$request = Microsoft.PowerShell.Utility\\ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())\n' + invoke],
        ['minimal-before-and-after-shadows', noFunctions + invoke + prelude.match(/^function .+$/gm).join('\n') + '\n' + invoke],
        ['all-shadows-explicit-process', prelude + dotnet],
    ];
    for (const [name, script] of variants) {
        results.push({ name, result: await finite(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], '{"operation":{"kind":"GIT","action":"status"}}') });
    }
    const evidence = { root, job, syntheticOnly: true, versionOnly: true, diagnosticCopy: true, results };
    fs.writeFileSync(path.join(__dirname, 'git-script-diagnostic-03.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(evidence));
})().catch(error => { console.error(error); process.exitCode = 1; });
