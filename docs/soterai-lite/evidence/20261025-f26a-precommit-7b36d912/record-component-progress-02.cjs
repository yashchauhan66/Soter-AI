const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../..');
const relative = file => path.relative(repo, file).split(path.sep).join('/');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const item = file => { const bytes = fs.readFileSync(file); return { path: relative(file), bytes: bytes.length, sha256: sha(bytes) }; };
const parse = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const names = ['protocol-baseline-01','protocol-tests-01','wire-baseline-02','wire-tests-01','index-baseline-01','index-tests-01',
 'staged-content-baseline-01','staged-content-tests-01','staged-content-tests-02','public-dotenv-diagnostic-01','public-dotenv-diagnostic-02',
 'process-baseline-01','process-tests-01','process-tests-02','compiler-01','compiler-02','compiler-03','components-combined-01','components-combined-03'];
const gates = {};
for (const name of names) {
 const file = path.join(__dirname, name+'.txt'), receiptFile = file+'.result.json', receipt = parse(receiptFile), raw = item(file);
 if (raw.sha256 !== receipt.sha256.toLowerCase()) throw Error('Raw receipt mismatch: '+name);
 const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
 const counts = {};
 for (const key of ['tests','pass','fail','cancelled','skipped']) { const m = new RegExp('^# '+key+' (\\d+)\\r?$', 'm').exec(text); if(m) counts[key] = Number(m[1]); }
 gates[name] = { raw, receipt: item(receiptFile), exitCode: receipt.exitCode, counts };
}
for (const name of ['protocol-tests-01','wire-tests-01','index-tests-01','staged-content-tests-02','process-tests-02','compiler-03','components-combined-03']) {
 if (gates[name].exitCode !== 0) throw Error('Required component gate not passing: '+name);
}
if(gates['components-combined-03'].counts.tests !== 295 || gates['components-combined-03'].counts.pass !== 295) throw Error('Unexpected combined count');
const sources = fs.readdirSync(path.join(repo,'packages/vscode-extension/src/history-hooks')).filter(name=>name.endsWith('.ts')).map(name=>path.join(repo,'packages/vscode-extension/src/history-hooks',name));
const tests = ['preCommitProtocol','preCommitWire','checkedHookIndex','stagedContent','stagedContentPublicContext.review','preCommitGitProcess'].map(name=>path.join(repo,'packages/vscode-extension/src/__tests__',name+'.test.ts'));
const proof = {status:'F26A_PRIVATE_COMPONENTS_295_PASS_COMPILER03_PASS_HOOK_GATES_PENDING', feature:'F26a', parent:'1969c368d439237126a360af452c254a5826be88', time:new Date().toISOString(), gates,
 files:[...sources,...tests,path.join(repo,'packages/vscode-extension/src/hygiene/HygieneCandidatePolicy.ts')].map(item),
 corrections:[
  'One effective content correction: positive parsed public Stripe dotenv context for raw heuristic pass; shared canonical public-context helper extracted without changing existing candidate policy. Original 48PASS/1FAIL and separate before-fix review retained.',
  'Process fixture first27PASS/1FAIL: undefined operation was converted by test default to valid version. Only actual-undefined forwarding corrected; all28 cases/assertions/deadlines retained; current28PASS.',
  'Compiler02 four errors: descriptor mapped type and expected-environment assertion narrowing. Type annotations only, beforebytes retained. Compiler03PASS. Combined02 NOT_RUN after compiler02 failure.',
 ],
 scope:'Private stage framing, signed metadata, genuine checked effective index, bounded canonical staged content and finite Git process transport only. No hook/service/client/flag/installer/backup/undo/newVSIX/native/feature completion claim. Sizes and whole-tree scanner fixtures frozen, baseline pending; no replacement plan or next feature production. No live registered-value promise. All failures immutable. LOW; no rating; original L6 HUMAN-ACTIONS STOP; no push.'};
const target = path.join(__dirname,'progress-02.json'); fs.writeFileSync(target, JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
const q = path.join(repo,'docs/soterai-lite/FEATURE-QUEUE.json'), before = fs.readFileSync(q,'utf8');
const old = 'docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912/progress-01.json';
if(before.split(old).length!==2) throw Error('Queue progress reference ambiguous');
fs.writeFileSync(q,before.replace(old,relative(target)));
fs.appendFileSync(path.join(repo,'docs/soterai-lite/ledger.md'),'\r\n\r\n## STEP RECEIPT F26a-COMPONENTS / current295PASS and compiler03PASS; whole-tree fixtures ready\r\n\r\n'+relative(target)+' sha'+item(target).sha256+'. Actual current combined03 295tests295PASS0FAIL/compiler03PASS: protocol32/wire19/effectiveindex33/content53/process28 plus affected canonical hygiene and eight config families. Private bounded index/transport/signatures/content only; no hook/service/client/strictflag/installer/encryptedbackup/undo/newVSIX/native completion. Original missingmodules, content48PASS1FAIL, process27PASS1FAIL and compiler02 errors retained unregraded. One public-dotenv correction extracts existing positive canonical Stripe context without changing policy; private siblings/comments/encoding remain checked. Process fixture only corrected undefined forwarding; typecheck only added two annotations, beforebytes retained. New frozen sizes18/scanner28 require actual failure baselines before production. HEAD1969c36/indexempty observed; F25scopedDONE, F26aACTIVE, F26b-c/F27-F32/Vgatespending. No push/LOW/no rating/L6HUMAN-ACTIONSSTOP/diskwaiver/unrelatedwork persist.\r\n');
console.log(JSON.stringify({progress:item(target),combined:gates['components-combined-03'].counts,compiler:gates['compiler-03'].exitCode}));
