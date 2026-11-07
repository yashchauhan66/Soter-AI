const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const file = path.join(__dirname, 'build-native-hosts-01.cjs'), raw = fs.readFileSync(file);
let source = raw.toString('utf8');
for (const [before, after] of [
 ['prebuilt-native-hosts-01','prebuilt-native-hosts-02'], ['full-inputs-01.json','full-inputs-02.json'],
 ['2a99cbe546aeca19800e5de8bb5b93dbf95a7e3363bc5cac6529f20806807284','5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322'],
 ["gate('compiler-12')","gate('compiler-13')"], ["gate('full-tests-01')","gate('full-tests-02')"], ['native-driver-provenance-01.json','native-driver-provenance-02.json']]) {
 if (source.split(before).length !== 2) throw Error('Expected one exact unexecuted build binding: ' + before);
 source = source.replace(before, () => after);
}
const next = path.join(__dirname, 'build-native-hosts-02.cjs'); fs.writeFileSync(next, source, { flag: 'wx' });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
fs.writeFileSync(path.join(__dirname, 'native-build-preparation-02.json'), JSON.stringify({ status: 'PREPARED_NOT_EXECUTED_REQUIRES_FULL02_PASS', time: new Date().toISOString(),
 predecessorSha256: sha(raw), successorSha256: sha(Buffer.from(source)), sourceProof: 'full-inputs-02.json', inputCount: 989, drivers: 21,
 compilerRequired: 'compiler-13', fullRequired: 'full-tests-02', scope: 'Keep original20 driver entries/JSONC/zero-unit-double guards; add exact native pre-commit driver. No earlier full/build/native PASS transfer.' }, null, 2) + '\n', { flag: 'wx' });
console.log('New 21-driver builder02 prepared; execution requires current compiler13/full02 PASS.');
