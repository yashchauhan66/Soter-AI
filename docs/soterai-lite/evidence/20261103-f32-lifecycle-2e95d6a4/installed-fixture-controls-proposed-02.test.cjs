'use strict';
// INERT proposed component controls only. Not a native/install/upgrade result.
// Root may execute explicitly after reviewing this evidence-only source.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
let count = 0;
function fixture() {
  const root = path.join(__dirname, 'manifest-controls-' + Date.now() + '-' + process.pid + '-' + (++count));
  fs.mkdirSync(root);
  const originalValue = { name: 'synthetic', publisher: 'synthetic', version: '1.0.1',
    main: './dist/extension.js', activationEvents: ['onStartupFinished'], extensionDependencies: [] };
  const originalRaw = Buffer.from(JSON.stringify(originalValue, null, 4) + '\n');
  const originalPath = path.join(root, 'original.json'), installedPath = path.join(root, 'installed.json');
  fs.writeFileSync(originalPath, originalRaw, { flag: 'wx' });
  const metadata = { installedTimestamp: 1500, targetPlatform: 'undefined', size: 12345 };
  const installed = { ...originalValue, __metadata: metadata };
  fs.writeFileSync(installedPath, JSON.stringify(installed, null, '\t'), { flag: 'wx' });
  return {
    root, originalValue, installed, installedPath,
    input: { original: { path: originalPath, bytes: originalRaw.length, sha256: sha(originalRaw) }, installedPath,
      installStartedWallMs: 1000, installCompletedWallMs: 2000, targetPlatform: 'undefined', payloadUncompressedBytes: 12345 },
    change(action) {
      action(installed);
      fs.writeFileSync(installedPath, JSON.stringify(installed, null, '\t'));
    },
  };
}
test('MF01 exact reviewed installer serialization accepted with original artifact hash retained', () => {
  const f = fixture(), result = admitInstalledManifest(f.input);
  assert.equal(result.originalSha256, f.input.original.sha256);
  assert.notEqual(result.installedSha256, f.input.original.sha256);
  assert.deepEqual(result.installerOnlyFields, ['installedTimestamp', 'targetPlatform', 'size']);
});
for (const [field, value] of [['main', './observer.cjs'], ['version', '9.9.9'], ['activationEvents', ['*']]]) {
  test('MF02 rejects changed product field ' + field + ' even with valid installer metadata', () => {
    const f = fixture(); f.change(manifest => { manifest[field] = value; });
    assert.throws(() => admitInstalledManifest(f.input));
  });
}
test('MF03 rejects arbitrary additional installer metadata authority', () => {
  const f = fixture(); f.change(manifest => { manifest.__metadata.isBuiltin = true; });
  assert.throws(() => admitInstalledManifest(f.input));
});
test('MF04 rejects timestamp outside actual CLI interval on either side', () => {
  for (const timestamp of [999, 2001]) {
    const f = fixture(); f.change(manifest => { manifest.__metadata.installedTimestamp = timestamp; });
    assert.throws(() => admitInstalledManifest(f.input));
  }
});
test('MF05 rejects platform and extracted-size mismatches', () => {
  for (const [field, value] of [['targetPlatform', 'win32-x64'], ['size', 12346]]) {
    const f = fixture(); f.change(manifest => { manifest.__metadata[field] = value; });
    assert.throws(() => admitInstalledManifest(f.input));
  }
});
test('MF06 rejects JSON duplicate fields before parser normalization', () => {
  const f = fixture();
  fs.writeFileSync(f.installedPath, JSON.stringify(f.installed, null, '\t').replace('"version": "1.0.1",',
    '"version": "1.0.1",\n\t"version": "1.0.1",'));
  assert.throws(() => admitInstalledManifest(f.input));
});
test('MF07 refuses generic pretty print relaxation and appended newline', () => {
  for (const suffix of ['', '\n']) {
    const f = fixture();
    fs.writeFileSync(f.installedPath, JSON.stringify(f.installed, null, suffix ? '\t' : 2) + suffix);
    assert.throws(() => admitInstalledManifest(f.input));
  }
});
test('MF08 rejects changed original artifact bytes even when parsed fields agree', () => {
  const f = fixture();
  fs.appendFileSync(f.input.original.path, ' ');
  assert.throws(() => admitInstalledManifest(f.input));
});
test('MF09 refuses original artifact with unreviewed metadata', () => {
  const f = fixture();
  const raw = Buffer.from(JSON.stringify({ ...f.originalValue, __metadata: { installedTimestamp: 0 } }));
  fs.writeFileSync(f.input.original.path, raw);
  f.input.original.bytes = raw.length; f.input.original.sha256 = sha(raw);
  assert.throws(() => admitInstalledManifest(f.input));
});
test('SQ01 primary source keeps owned receipts and defers the complete aggregate to restart', () => {
  const source = fs.readFileSync(path.join(__dirname, 'installed-observer-proposed-02.cjs'), 'utf8');
  const primary = source.slice(source.indexOf("if (b.phase === 'primary')"), source.indexOf("} else if (b.phase === 'restart')"));
  const upgradeStart = source.indexOf("} else if (b.phase === 'upgrade-current' || b.phase === 'upgrade-restart')");
  assert(upgradeStart > 0);
  const restart = source.slice(source.indexOf("} else if (b.phase === 'restart')"), upgradeStart);
  assert(!primary.includes("result.status, 'COMPLETE'"));
  assert(!primary.includes("check('I12'"));
  assert(restart.includes("check('I19'") && restart.includes("check('I12'"));
  assert(restart.indexOf("check('I19'") < restart.indexOf("check('I12'"));
  assert(!restart.slice(restart.indexOf("check('I12'")).includes('FIXED.configureProfile'));
});
test('SQ02 prior seed uses actual old void public API and current upgrade never recreates deny', () => {
  const old = fs.readFileSync(path.join(__dirname, 'installed-upgrade-old-observer-proposed-02.cjs'), 'utf8');
  assert(old.includes("native('soterai.blockFromAI'"));
  assert(!old.includes("native('soterai.restrictProjectFile'"));
  const current = fs.readFileSync(path.join(__dirname, 'installed-observer-proposed-02.cjs'), 'utf8');
  const upgradeStart = current.indexOf("} else if (b.phase === 'upgrade-current' || b.phase === 'upgrade-restart')");
  assert(upgradeStart > 0);
  const upgraded = current.slice(upgradeStart);
  assert(!upgraded.includes('native(FIXED.restrict'));
  assert(upgraded.includes("['U08', 'U09', 'U10']") && upgraded.includes('OMITTED'));
  assert(upgraded.includes("path.basename(b.upgradePublicFile) === 'upgrade-public.txt'"));
});
test('SQ03 old and current native migration prompts are distinct actual contracts', () => {
  const renderer = fs.readFileSync(path.join(__dirname, 'installed-renderer-proposed-02.cjs'), 'utf8');
  assert(renderer.includes("'Move these values into the encrypted vault and replace them with placeholders?': ['Migrate securely']"));
  assert(renderer.includes("'Migrate 1 secret(s) from .env into the protected vault? An encrypted backup (outside the workspace) will be created.': ['Migrate & Backup']"));
});
test('SQ04 distinct scenario retention paths are bound rather than sharing top-level files', () => {
  for (const file of ['installed-observer-proposed-02.cjs', 'installed-upgrade-old-observer-proposed-02.cjs']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert(source.includes('read(b.retainedInputsPath)'));
    assert(!source.includes("path.join(b.runRoot, 'retained-inputs.json')"));
    assert(!source.includes("path.join(b.runRoot, 'retained-generated.json')"));
    assert(!source.includes("path.join(b.runRoot, 'restart-expected.json')"));
  }
});
