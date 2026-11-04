const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const text = fs.readFileSync(path.join(__dirname, 'lifecycle-combined-03.txt'), 'utf8');
const cases = text.split(/\r?\n/).filter(line => line.startsWith('# Subtest: '));
const secureEditor = cases.filter(line => /^# Subtest: (F05-|F32 secure association)/.test(line)).length;
assert.equal(secureEditor, 35); assert.equal(cases.length, 140);
const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'full-suite-shards-02.json'), 'utf8')).files.length;
assert.equal(files, 357);
const result = { status: 'CORRECTION_OF_LEDGER_BREAKDOWN_ONLY_NO_TEST_REGRADING', total: 140,
  coordinator: 32, commands: 20, inventory: 22, ownedStop: 14, manifest: 2, profiles: 12, vault: 3, secureEditor,
  frozenTestFiles: files, reason: 'Previous prose mistyped secure-editor subtotal as55. Actual TAP is35; total140 and its raw hash were correct.' };
assert.equal(result.coordinator + result.commands + result.inventory + result.ownedStop + result.manifest + result.profiles + result.vault + result.secureEditor, result.total);
fs.writeFileSync(path.join(__dirname, 'component-breakdown-correction-01.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
fs.appendFileSync(path.join(repo, 'docs/soterai-lite/ledger.md'), '\n\nF32 component breakdown correction: prior receipt prose said secure-editor55; actual TAP prefix count is35. Correct breakdown32+20+22+14+2+12+3+35=140, with unchanged actual140PASS0FAIL/raw bdd89939. No failed test regraded. Frozen test-file count357 verified against actual shard manifest. Original mistaken prose/recorder retained; component-breakdown-correction01 records the correction.\n');
console.log(JSON.stringify(result));
