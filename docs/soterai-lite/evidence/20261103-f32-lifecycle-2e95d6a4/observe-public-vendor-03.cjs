// Successor02: fixed public System32 PowerShell is a legitimate Windows WinSxS hardlink.
// Only this exact read-only vendor file admits bounded linkCount<=16; private/npm files still require one link.
'use strict';
// Public installed application/package files only. Does not require vendor
// modules, enumerate processes, query listeners, launch a host or use network.
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const oldRoot = path.join(repo, 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304');
const codeDirectory = 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code';
const appRoot = path.join(codeDirectory, 'a717861c07', 'resources', 'app');
const oldAppRoot = path.join(codeDirectory, '2c33b50b16', 'resources', 'app');
const LIMITS = Object.freeze({ chunkBytes: 65536, maxSingleFile: 512 * 1024 * 1024,
  maxPackageFiles: 4096, maxPackageBytes: 128 * 1024 * 1024, maxTotalBytesPerPass: 1024 * 1024 * 1024 });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function physical(file, directory = false) {
  assert(path.isAbsolute(file));
  let cursor = file;
  for (;;) {
    const stat = fs.lstatSync(cursor);
    assert(!stat.isSymbolicLink(), 'Linked public path withheld.');
    if (cursor === file) assert(directory ? stat.isDirectory() : stat.isFile() && (stat.nlink === 1 || file.toLowerCase() === 'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe' && stat.nlink >= 1 && stat.nlink <= 16));
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  assert.equal(fs.realpathSync(file).toLowerCase(), path.resolve(file).toLowerCase());
}
function measure(file) {
  physical(file);
  const before = fs.lstatSync(file), sha = crypto.createHash('sha256');
  assert(before.size >= 0 && before.size <= LIMITS.maxSingleFile);
  const fd = fs.openSync(file, 'r'), chunk = Buffer.alloc(LIMITS.chunkBytes);
  let total = 0;
  try {
    const opened = fs.fstatSync(fd);
    assert.equal(opened.ino, before.ino); assert.equal(opened.size, before.size);
    for (;;) {
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      total += count; assert(total <= before.size && total <= LIMITS.maxSingleFile);
      sha.update(chunk.subarray(0, count));
    }
    const closed = fs.fstatSync(fd);
    assert.equal(closed.ino, opened.ino); assert.equal(closed.size, opened.size); assert.equal(closed.mtimeMs, opened.mtimeMs);
  } finally { fs.closeSync(fd); }
  const after = fs.lstatSync(file); physical(file);
  assert.equal(after.ino, before.ino); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(total, before.size);
  return { path: file, bytes: total, sha256: sha.digest('hex'), fileLinkCount: before.nlink };
}
function readPublicJson(file, maximum = 1024 * 1024) {
  const row = measure(file); assert(row.bytes <= maximum);
  const raw = fs.readFileSync(file); assert.equal(hash(raw), row.sha256);
  return { row, value: JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')) };
}
function packageFiles(directory) {
  physical(directory, true); const result = [], pending = [directory];
  let total = 0;
  while (pending.length) {
    const current = pending.pop(); physical(current, true);
    const handle = fs.opendirSync(current); let entry;
    try {
      while ((entry = handle.readSync()) !== null) {
        const target = path.join(current, entry.name), stat = fs.lstatSync(target);
        assert(!stat.isSymbolicLink());
        if (stat.isDirectory()) pending.push(target);
        else {
          assert(stat.isFile() && stat.nlink === 1); result.push(target); total += stat.size;
          assert(result.length <= LIMITS.maxPackageFiles && total <= LIMITS.maxPackageBytes);
        }
      }
    } finally { handle.closeSync(); }
  }
  return result.sort();
}
async function main() {
  assert.equal(process.argv.length, 2, 'No caller path, host or output arguments accepted.');
  const bindingFile = path.join(oldRoot, 'native-binding-01.json');
  const driftFile = path.join(oldRoot, 'vendor-drift-observation-01.json');
  const binding = readPublicJson(bindingFile, 2 * 1024 * 1024);
  const drift = readPublicJson(driftFile);
  const app = readPublicJson(path.join(appRoot, 'package.json'));
  const product = readPublicJson(path.join(appRoot, 'product.json'));
  assert.equal(app.value.name, 'Code'); assert.equal(app.value.version, '1.145.0');
  assert.equal(product.value.commit, 'a717861c07586a53d83b80d742cd3f59b20a6273');
  assert.equal(product.value.quality, 'stable');
  const fixed = [path.join(codeDirectory, 'Code.exe'), path.join(codeDirectory, 'bin', 'code.cmd'),
    'package.json', 'product.json', 'out/cli.js', 'out/main.js', 'out/mainImpl.js',
    'out/vs/code/node/cliProcessMain.js', 'out/vs/workbench/api/node/extensionHostProcess.js',
    'out/vs/workbench/workbench.desktop.main.js'].map((file, index) => index < 2 ? file : path.join(appRoot, file));
  fixed.push('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'C:\\Program Files\\nodejs\\node.exe');
  const packageRoots = ['playwright', 'playwright-core'].map(name => path.join(repo, 'node_modules', name));
  const packages = packageRoots.map(directory => ({ directory, manifest: readPublicJson(path.join(directory, 'package.json')) }));
  for (const item of packages) assert.equal(item.manifest.value.version, '1.61.1');
  const firstFiles = [...fixed, ...packageRoots.flatMap(packageFiles)];
  assert.equal(new Set(firstFiles.map(file => file.toLowerCase())).size, firstFiles.length);
  const firstAt = new Date().toISOString(), first = firstFiles.map(measure);
  assert(first.reduce((sum, row) => sum + row.bytes, 0) <= LIMITS.maxTotalBytesPerPass);
  await new Promise(resolve => setTimeout(resolve, 1000));
  const secondFiles = [...fixed, ...packageRoots.flatMap(packageFiles)];
  assert.deepEqual(secondFiles, firstFiles, 'Installed graph changed between observations.');
  const secondAt = new Date().toISOString(), second = secondFiles.map(measure);
  assert.deepEqual(second, first, 'Current public vendor bytes changed between observations.');
  const byPath = new Map(first.map(row => [row.path.toLowerCase(), row]));
  const oldToCurrent = binding.value.vendorFacts.flatMap(tested => {
    let target = tested.path;
    if (target.toLowerCase().startsWith(oldAppRoot.toLowerCase() + path.sep)) target = appRoot + target.slice(oldAppRoot.length);
    const observed = byPath.get(target.toLowerCase());
    if (!observed) return [];
    return [{ tested, observed, pathChanged: tested.path.toLowerCase() !== observed.path.toLowerCase(),
      bytesChanged: tested.bytes !== observed.bytes || tested.sha256 !== observed.sha256 }];
  });
  const metadata = {
    schemaVersion: 1, feature: 'F32', status: 'CURRENT_PUBLIC_VENDOR_TWO_PASS_STATIC_ONLY_NATIVE_ADMISSION_PENDING',
    observedAt: secondAt, observations: [firstAt, secondAt], twoStableObservations: true, limits: LIMITS,
    historicalBinding: binding.row, historicalPostTestDrift: drift.row,
    currentHost: { version: app.value.version, commit: product.value.commit, quality: product.value.quality,
      buildDate: product.value.date, appRoot, executable: byPath.get(fixed[0].toLowerCase()),
      electronApplicationPackage: app.row, product: product.row,
      codeCli: byPath.get(path.join(appRoot, 'out/cli.js').toLowerCase()),
      cliProcessMain: byPath.get(path.join(appRoot, 'out/vs/code/node/cliProcessMain.js').toLowerCase()),
      applicationFiles: first.filter(row => row.path.startsWith(appRoot + path.sep)),
      electronRuntimeVersion: 'NOT_INFERRED_FROM_APPLICATION_NPM_METADATA',
      standaloneElectronNpmPackage: 'NOT_REQUIRED_OR_LOADED_BY_CODE_EXECUTABLE_CLI',
      signatureValidation: 'CURRENT_EMBEDDED_SIGNER_REVIEW_REQUIRED_NOT_INFERRED_FROM_OLD_EXECUTABLE' },
    code1144To11450: { priorAppRoot: oldAppRoot, priorAppRootExists: fs.existsSync(oldAppRoot), comparisons: oldToCurrent },
    systemPowerShell: byPath.get('c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe'),
    node: byPath.get('c:\\program files\\nodejs\\node.exe'),
    playwright: { entry: path.join(packageRoots[0], 'index.js'),
      packages: packages.map(item => ({ name: item.manifest.value.name, version: item.manifest.value.version,
        directory: item.directory, manifest: item.manifest.row,
        completeInstalledFileGraph: first.filter(row => row.path.startsWith(item.directory + path.sep)) })),
      scope: 'Entire already installed public playwright and playwright-core package trees; browser caches and other npm packages are not read or loaded. No dependency module is required or executed.' },
    vendorFacts: first,
    excludedEdge: { launchRequired: false, observedHistoricalDrift: drift.value.changed,
      reason: 'Attach-only CDP targets the owned Code workbench. No Edge executable or driver is launched or re-admitted.' },
    launches: 0, processQueries: 0, listenerQueries: 0, downloads: 0, networkRequests: 0, signalsRequested: 0,
    reviewLimit: 'Two stable hashes and static metadata are not native behavior, signature chain validation, descendant custody, withdrawal or final current-source/VSIX admission. Root must bind this exact receipt and freshly observed owners before any host.'
  };
  const output = path.join(__dirname, 'public-vendor-observation-03.json');
  fs.writeFileSync(output, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: metadata.status, output, sha256: hash(fs.readFileSync(output)),
    host: metadata.currentHost.version, rows: first.length, totalBytesPerPass: first.reduce((sum, row) => sum + row.bytes, 0), launches: 0 }));
}
main().catch(error => { console.error('Public vendor observation withheld; preserve source and no native admission.'); console.error(String(error.message)); process.exitCode = 1; });
