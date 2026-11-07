const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const parent = 'docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/host-current-binding-01.ps1', raw = fs.readFileSync(parent);
let source = raw.toString('utf8').replaceAll('F25', 'F26A').replaceAll('20261024-f25-logs-a41d9e62', '20261025-f26a-precommit-7b36d912')
 .replaceAll('full-tests-03', 'full-tests-02').replaceAll('native-source-inputs-01.json', 'full-inputs-02.json')
 .replaceAll('native-driver-provenance-01.json', 'native-driver-provenance-02.json').replaceAll('$taskFrozen.records', '$taskFrozen.files')
 .replaceAll('@($taskDrivers.drivers).Count -ne 20', '@($taskDrivers.drivers).Count -ne 21').replaceAll('Twenty current built', 'Twenty-one current built');
const bindings = [
 ['cbd15f4146d780eb97a125eb2cb32d6c00e84a659710a31884fc5a23a4e4d0eb', '__F26A_FULL02_RECEIPT_SHA256__'],
 ['303128dd11a71f2e9bf204f4772d26390b8813aec90dd1c63eb23f46236be3f8', '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322'],
 ['633d8b88ab0c2fcc4e55ef9ed0c46a20de9ccc63b7814c16f7ab03f95a25cd08', '__F26A_DRIVER02_PROVENANCE_SHA256__'],
 ['5753c649112077de63fe26fabfb10491b4dc278de4ffc4aa6436b29057a155de', '__F26A_HOST_REVIEW_SHA256__'] ];
for (const [before, after] of bindings) { if (source.split(before).length !== 2) throw Error('Expected exact host guard binding marker.'); source = source.replace(before, () => after); }
source = source.replaceAll("if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND')", "if('__F26A_TEMPLATE_BOUND__' -cne 'F26A_CURRENT_FACTS_BOUND')");
const output = path.join(__dirname, 'host-current-binding-01.template.ps1'); fs.writeFileSync(output, source, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'host-guard-preparation-01.json'), JSON.stringify({ status: 'PREPARED_NOT_BOUND_NOT_EXECUTED', time: new Date().toISOString(),
 input: { path: parent, sha256: crypto.createHash('sha256').update(raw).digest('hex') },
 output: { path: path.relative(process.cwd(), output).replace(/\\/g, '/'), sha256: crypto.createHash('sha256').update(source).digest('hex') },
 required: 'Actual full02 PASS receipt,21-driver built provenance02, fresh installedhost review01 exactSHA, current989sourcebytes and actualnewVSIX/content. No oldnative result reused. PreserveCode1.143.1 pins; refusevendor drift beforelaunch.' }, null, 2) + '\n', { flag: 'wx' });
console.log('Current host guard template prepared, blocked on actual full/build facts.');
