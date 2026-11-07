const fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'capture-source-candidates-02.cjs'), 'utf8');
// The sealed F25 proof uses records; F26 proof uses files. Failed02 stopped
// before writing any report. Preserve it and produce a new executable copy.
if (!source.includes('prior.files') || !source.includes('source-candidates-02.json')) throw Error('Original candidate helper differs.');
const result = source.split('prior.files').join('prior.records').split('source-candidates-02.json').join('source-candidates-03.json');
fs.writeFileSync(path.join(__dirname, 'capture-source-candidates-03.cjs'), result, { flag: 'wx' });
console.log('Prepared successor03 for actual sealed F25 records schema; no scope finalization or Git writes.');
