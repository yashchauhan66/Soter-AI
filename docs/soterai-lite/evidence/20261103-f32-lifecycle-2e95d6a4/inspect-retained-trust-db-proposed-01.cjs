'use strict';
// Read-only retained synthetic SQLite inspection. No live host/process access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = 'D:\\SoterAI-Lite-test-profiles\\f32-installed-20261104T021038Z-aa54c353\\profile-primary';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const names = ['User/globalStorage/state.vscdb', '.vscode-shared/sharedStorage/state.vscdb',
  'User/workspaceStorage/91e366e12e91bc46521e453039aceb37/state.vscdb'];
const keys = ['content.trust.model.key', 'workspace.trust.startupPrompt.shown',
  'memento/workspaceTrust', 'workspace.trust.emptyWindow'];
const result = { status: 'READ_ONLY_RETAINED_SYNTHETIC_STATE', hostQueries: 0, writesToProfile: 0, observations: [] };
for (const name of names) {
  const file = path.join(root, name), before = fs.readFileSync(file);
  const db = new DatabaseSync(file, { readOnly: true });
  const rows = [];
  try {
    const query = db.prepare('SELECT key, value FROM ItemTable WHERE key = ?');
    for (const key of keys) {
      const row = query.get(key);
      rows.push({ key, present: !!row, ...(row ? { value: Buffer.isBuffer(row.value) || row.value instanceof Uint8Array ? Buffer.from(row.value).toString('utf8') : row.value } : {}) });
    }
  } finally { db.close(); }
  const after = fs.readFileSync(file);
  if (sha(before) !== sha(after)) throw Error('Retained database changed during static inspection');
  result.observations.push({ relativeFile: name, bytes: before.length, sha256: sha(before), rows });
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
