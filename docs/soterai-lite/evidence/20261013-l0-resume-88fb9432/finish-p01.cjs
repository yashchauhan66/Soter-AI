const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const docs = path.resolve(__dirname, '../..');
const root = path.resolve(docs, '../..');
const queueFile = path.join(docs, 'FEATURE-QUEUE.json');
const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8').replace(/^\uFEFF/, ''));
Object.assign(queue.preparations.find(p => p.id === 'P01'), {status:'DONE', result:'PASS', scope:'Git connectivity only; supplemental full fsck INCOMPLETE/RUNNING'});
Object.assign(queue.preparations.find(p => p.id === 'P02'), {status:'ACTIVE'});
queue.scope = 'Serial execution authorized; P02 packaging active, behavior features NOT-RUN';
fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2) + '\n');
fs.appendFileSync(path.join(docs, 'ledger.md'), '\nP01 receipt-write attempt 01 was INCOMPLETE: Node JSON.parse rejected the PowerShell UTF-8 BOM in FEATURE-QUEUE.json. The ledger append had completed; queue/index had not. finish-p01.cjs strips the BOM and finishes only pending bookkeeping, without duplicating the receipt or rerunning checks. Early P02 build attempt 01 was INCOMPLETE with exact error `Error: spawn EPERM`; no raw log was written because the wrapper stopped on native stderr. The corrected wrapper captures native stderr; authorized escalated retry 02 passed and retained a separate immutable build directory. Two non-product inspection/edit failures are retained: path read `packages/vscode-extension/src/project-privacy/pathContainment.ts` did not exist (actual security/pathContainment.ts was read); PowerShell stripped node -e quote characters (SyntaxError); a partial-line patch failed to match record-p01.cjs and changed no file. These are not product PASS results.\n');
const files = ['backup-pair.json','baseline-typecheck-01.txt','checkpoint-commit-01.txt',
 'existing-backup-identity.json','existing-backup-refs.txt','existing-backup-verify-01.txt',
 'git-connectivity-01.txt','incremental-backup-create-01.txt','incremental-backup-verify-01.txt',
 'record-p01.cjs','finish-p01.cjs','run-check.ps1'];
const paths = [...files.map(f=>path.join(__dirname,f)), ...['ledger.md','FEATURE-QUEUE.json','inputs.json'].map(f=>path.join(docs,f))];
const entries = paths.map(file=>({path:path.relative(root,file).replace(/\\/g,'/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(path.join(__dirname,'p01-evidence-index.json'), JSON.stringify({stage:'P01',scope:'CONNECTIVITY-PASS; FULL-CHECK-INCOMPLETE',entries},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'p01-commit-allowlist.txt'), entries.map(e=>e.path).concat('docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p01-evidence-index.json').join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({stage:'P01',result:'PASS_SCOPED',fullFsck:'INCOMPLETE',indexed:entries.length}));
