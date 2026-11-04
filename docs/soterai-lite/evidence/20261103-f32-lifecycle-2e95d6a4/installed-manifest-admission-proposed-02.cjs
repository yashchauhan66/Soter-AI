'use strict';
// INERT test-only admission. Reflects reviewed installed VS Code cliProcessMain:
// extract adds timestamp/platform/size; updateManifestMetadata serializes tabs.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
function json(raw) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const parsed = JSON.parse(text);
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  const stack = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(undefined);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ':') {
      const keys = stack.at(-1), key = JSON.parse(token);
      assert(keys && !keys.has(key), 'Duplicate JSON property is not installer metadata');
      keys.add(key);
    }
  }
  return parsed;
}
function bytes(file, limit) {
  const before = fs.lstatSync(file);
  assert(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= limit);
  const raw = fs.readFileSync(file), after = fs.lstatSync(file);
  assert.equal(raw.length, before.size); assert.equal(after.size, before.size);
  assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs);
  return raw;
}
function admitInstalledManifest(input) {
  const originalRaw = bytes(input.original.path, 1024 * 1024);
  assert.equal(originalRaw.length, input.original.bytes); assert.equal(sha(originalRaw), input.original.sha256);
  const original = json(originalRaw);
  assert(!Object.hasOwn(original, '__metadata'), 'Unreviewed original installer metadata refuses admission');
  const installedRaw = bytes(input.installedPath, 1024 * 1024), installed = json(installedRaw);
  const metadata = installed.__metadata;
  assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata));
  assert.equal(Object.keys(metadata).sort().join(','), 'installedTimestamp,size,targetPlatform');
  assert(Number.isSafeInteger(input.installStartedWallMs) && Number.isSafeInteger(input.installCompletedWallMs));
  assert(input.installStartedWallMs <= input.installCompletedWallMs);
  assert(Number.isSafeInteger(metadata.installedTimestamp) && metadata.installedTimestamp >= input.installStartedWallMs &&
    metadata.installedTimestamp <= input.installCompletedWallMs);
  // Reviewed local VSIX URI branch constructs ExtensionKey(id,version) without
  // its platform argument. That constructor defaults to the STRING "undefined".
  // Artifact XML platform is a separate VSIX content admission, not this field.
  assert.equal(input.targetPlatform, 'undefined');
  assert.equal(metadata.targetPlatform, 'undefined');
  assert(Number.isSafeInteger(input.payloadUncompressedBytes) && input.payloadUncompressedBytes > 0);
  assert.equal(metadata.size, input.payloadUncompressedBytes);
  // No generic remove-and-deep-equal relaxation. Match EXACT serialization made
  // by the pinned vendor function from original fields and only known metadata.
  const expected = Buffer.from(JSON.stringify({ ...original, __metadata: metadata }, null, '\t'));
  assert(installedRaw.equals(expected), 'Installed manifest differs beyond exact permitted vendor rewrite');
  return { originalSha256: sha(originalRaw), installedSha256: sha(installedRaw),
    installerOnlyFields: ['installedTimestamp', 'targetPlatform', 'size'],
    installedTimestamp: metadata.installedTimestamp, targetPlatform: metadata.targetPlatform, size: metadata.size };
}
module.exports = { admitInstalledManifest };
