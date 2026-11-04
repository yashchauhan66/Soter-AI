const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
let text = fs.readFileSync(path.join(__dirname, 'run-integrated-01.cjs'), 'utf8');
const replace = (before, after, expected = 1) => { assert.equal(text.split(before).length - 1, expected, before); text = text.replaceAll(before, after); };
replace("own('full-inputs-01.json')", "own('full-inputs-04.json')", 2);
for (const name of ['compiler-owned', 'full-suite-shards', 'full-suite-acceptance', 'package-components', 'readiness', 'build', 'package', 'integrated-result']) {
  const before = name + '-01'; const count = name === 'package-components' ? 2 : 1;
  replace(before, name + '-04', count);
}
replace("padStart(2, '0') + '-01'", "padStart(2, '0') + '-04'");
fs.writeFileSync(path.join(__dirname, 'run-integrated-04.cjs'), text, { flag: 'wx' });
console.log('Prepared fresh full compiler/all357 test files/build/package chain04; no prior shard counts reused after notification runtime fix.');
