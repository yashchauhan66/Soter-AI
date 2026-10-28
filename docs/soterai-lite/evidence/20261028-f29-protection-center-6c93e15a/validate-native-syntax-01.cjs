'use strict';
// Read-only syntax preparation. This cannot launch Code or accept native tests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const file = path.join(__dirname, 'f29-native01.host.ts');
const raw = fs.readFileSync(file);
const output = esbuild.transformSync(raw.toString('utf8'), { loader: 'ts', format: 'cjs', platform: 'node', target: 'node22' });
if (!output.code || output.warnings.length) throw new Error('Prepared native fixture syntax warnings or empty result.');
process.stdout.write(JSON.stringify({ status: 'PASS_TS_SYNTAX_ONLY_NOT_TYPECHECKED_OR_EXECUTED', bytes: raw.length,
    sha256: crypto.createHash('sha256').update(raw).digest('hex'), assertions: { primary: 25, restart: 5 },
    nativeRuns: 0, productImports: false, signals: 0 }) + '\n');
