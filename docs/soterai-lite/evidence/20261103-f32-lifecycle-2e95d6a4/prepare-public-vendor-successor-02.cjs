'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const first = path.join(__dirname, 'observe-public-vendor-01.cjs');
let value = fs.readFileSync(first, 'utf8');
for (const [before, after] of [
  ["assert(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1);",
   "assert(directory ? stat.isDirectory() : stat.isFile() && (stat.nlink === 1 || file.toLowerCase() === 'c:\\\\windows\\\\system32\\\\windowspowershell\\\\v1.0\\\\powershell.exe' && stat.nlink >= 1 && stat.nlink <= 16));"],
  ["return { path: file, bytes: total, sha256: sha.digest('hex') };",
   "return { path: file, bytes: total, sha256: sha.digest('hex'), fileLinkCount: before.nlink };"],
  ["'public-vendor-observation-01.json'", "'public-vendor-observation-02.json'"],
  ["main().catch(() => { console.error('Public vendor observation withheld; preserve source and no native admission.'); process.exitCode = 1; });",
   "main().catch(error => { console.error('Public vendor observation withheld; preserve source and no native admission.'); console.error(String(error.message)); process.exitCode = 1; });"],
]) {
  assert.equal(value.split(before).length - 1, 1); value = value.replace(before, after);
}
value = '// Successor02: fixed public System32 PowerShell is a legitimate Windows WinSxS hardlink.\n' +
  '// Only this exact read-only vendor file admits bounded linkCount<=16; private/npm files still require one link.\n' + value;
fs.writeFileSync(path.join(__dirname, 'observe-public-vendor-02.cjs'), value, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'public-vendor-attempt-01-failure.json'), JSON.stringify({
  status: 'READ_ONLY_PREPARATION_FAILED_NO_NATIVE_ADMISSION',
  command: 'node docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/observe-public-vendor-01.cjs',
  actualToolExitCode: 1,
  stdout: 'Public vendor observation withheld; preserve source and no native admission.\n',
  retainedOriginalSource: 'observe-public-vendor-01.cjs',
  diagnostic: 'Read-only public file metadata found exact System32 Windows PowerShell executable is a Windows WinSxS hardlink. Original single-link private-file guard was overbroad for this fixed public OS vendor input. No host/process/listener checks ran. Successor keeps strict one-link checks elsewhere and records actual link count.',
  launches: 0, processQueries: 0, listenerQueries: 0, signalsRequested: 0,
}, null, 2) + '\n', { flag: 'wx' });
