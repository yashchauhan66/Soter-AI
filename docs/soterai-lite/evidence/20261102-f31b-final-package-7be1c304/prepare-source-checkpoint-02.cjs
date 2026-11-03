'use strict';
// First preparation stopped at sandbox spawnSync EPERM, before any Git mutation.
// Use a distinct output prefix so that failed raw evidence remains immutable.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const own = name => path.join(__dirname, name);
const original = fs.readFileSync(own('scoped-f31b-source-checkpoint-01.cjs'), 'utf8');
const before = "const prefix = 'scoped-f31b-source-checkpoint-01';";
const after = "const prefix = 'scoped-f31b-source-checkpoint-02';";
assert.equal(original.split(before).length - 1, 1);
const successor = original.replace(before, () => after);
assert.equal(successor.replace(after, () => before), original);
new vm.Script(successor, { filename: 'scoped-f31b-source-checkpoint-02.cjs' });
fs.writeFileSync(own('scoped-f31b-source-checkpoint-02.cjs'), successor, { flag: 'wx' });
console.log('Prepared exact prefix-only successor; Git/source scope and gates unchanged.');
