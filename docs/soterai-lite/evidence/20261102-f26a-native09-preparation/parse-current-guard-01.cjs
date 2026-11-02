'use strict';
// Grammar and interface inspection only. Never require/evaluate the guard.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const own = name => path.join(__dirname, name), sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const file = own('native09-current-admission-01.cjs'), raw = fs.readFileSync(file), source = raw.toString('utf8');
new vm.Script(source, { filename: file });
assert(!source.includes('node:child_process')); assert(!source.includes('cp.spawn'));
for (const declaration of ['function current()', 'function validate(binding)', 'function guard()', 'function originalChecks()', 'function barriers()']) assert(source.includes(declaration));
const result = { status: 'STATIC_CURRENT_GUARD_PARSE_ONLY_NOT_ADMISSION_OR_NATIVE_COVERAGE', observedAt: new Date().toISOString(), guard: { path: 'native09-current-admission-01.cjs', bytes: raw.length, sha256: sha(raw) }, evaluatedOrRequiredGuard: false, currentOrGuardInvoked: false, nativeLaunches: 0, gitOperations: 0, signalsRequested: 0, native09: 'EXPLICIT_USER_DEFERRED_NOT_RUN' };
fs.writeFileSync(own('current-guard-javascript-parse-01.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
