'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validateEntry, validateManifest, comparePayload, payload } = require('./package.cjs');
const entry = name => ({ fileName: name, compressedSize: 3, uncompressedSize: 3, generalPurposeBitFlag: 0, externalFileAttributes: 0 });
test('refuses traversal, unexpected scripts, archive aliases and symbolic links', () => {
  for (const name of ['extension/../../outside', 'extension/.vscodeignore', 'extension/postinstall.js', 'extension\\package.json']) {
    assert.throws(() => validateEntry(entry(name), new Set()), /Unexpected/);
  }
  const seen = new Set(); validateEntry(entry('extension/README.md'), seen);
  assert.throws(() => validateEntry(entry('extension/readme.md'), seen), /Duplicate/);
  assert.throws(() => validateEntry({ ...entry('extension/package.json'), externalFileAttributes: 0o120000 << 16 }, new Set()), /Non-file/);
});
test('package payload comparison rejects missing, added and changed bytes', () => {
  const before = new Map(payload.map(n => ['extension/' + n, Buffer.from(n)]));
  assert.equal(comparePayload(before, new Map(before)).length, payload.length);
  for (const mutate of [m => m.delete('extension/package.json'), m => m.set('extension/extra', Buffer.from('x')),
    m => m.set('extension/dist/extension.js', Buffer.from('changed'))]) {
    const after = new Map(before); mutate(after); assert.throws(() => comparePayload(before, after));
  }
});
test('only an inert release manifest can enter the packager', () => {
  const manifest = { publisher: 'soterai', name: 'soterai-ide-guard', version: '0.7.0', main: './dist/extension.js' };
  validateManifest(manifest);
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'extensionPack', 'extensionDependencies']) {
    assert.throws(() => validateManifest({ ...manifest, [key]: {} }), /refused/);
  }
  assert.throws(() => validateManifest({ ...manifest, publisher: 'other' }));
});
