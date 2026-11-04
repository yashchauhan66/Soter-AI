'use strict';
// Inert until invoked. This authoring helper copies only a separately reviewed,
// hash-pinned allowlist; it performs no test, install, process, or network action.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const digest = raw => crypto.createHash('sha256').update(raw).digest('hex');
const expectedArtifact = 'e2ce3dc44d45b5e160ab0f95d713a9434a9ea7d610ce7abd2bf2500abe89d649';
const expectedCatalog = '1ce46192e9f315b5f2142c9f61542f1d513143dc2e19d4def6d95cea38c73ed4';
const roles = new Set(['PRODUCT_SOURCE', 'PRODUCT_MANIFEST', 'BUILD_RECIPE', 'LICENSE', 'SYNTHETIC_FIXTURE', 'NEUTRAL_INSTRUCTIONS']);
const prohibitedReferences = ['docs/soterai-lite/ledger.md', 'docs/soterai-lite/SCORECARD.md', 'docs/soterai-lite/FINAL-REPORT.md', 'docs/soterai-lite/evidence/', 'NEXT-CHAT-HANDOFF-'];
const slash = p => p.replaceAll('\\', '/');
function relative(p) {
  assert.equal(typeof p, 'string');
  assert(p.length > 0 && p.length < 320 && !p.includes('\\') && !p.includes(':') && !p.startsWith('/'));
  assert(p.split('/').every(s => s !== '' && s !== '.' && s !== '..'));
  assert(!/[\u0000-\u001f]/.test(p));
  return p;
}
function within(base, p) {
  const rel = path.relative(base, p);
  assert(rel !== '' && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function regular(p) {
  within(repo, p);
  let current = p;
  while (current !== repo) {
    const st = fs.lstatSync(current);
    assert(!st.isSymbolicLink(), 'Linked component: ' + slash(path.relative(repo, current)));
    if (current === p) assert(st.isFile() && st.nlink === 1, 'Regular single-link file required');
    else assert(st.isDirectory());
    current = path.dirname(current);
  }
}
function pinned(row) {
  assert.equal(typeof row, 'object');
  const rel = relative(row.path), file = path.resolve(repo, rel);
  assert(Number.isSafeInteger(row.bytes) && row.bytes > 0 && row.bytes < 32 * 1024 * 1024);
  assert(/^[0-9a-f]{64}$/.test(row.sha256));
  regular(file);
  const raw = fs.readFileSync(file);
  assert.equal(raw.length, row.bytes, rel + ': size');
  assert.equal(digest(raw), row.sha256, rel + ': hash');
  return { rel, raw, sha256: row.sha256, bytes: row.bytes };
}
function allowed(row) {
  assert(roles.has(row.role));
  const p = relative(row.path);
  assert(!/(?:^|\/)(?:\.git|node_modules|builds|dist|artifacts|evidence)(?:\/|$)/i.test(p));
  // These are actual current runtime sources, not the builder's ledger.
  // Every one remains separately role-bound and exact-byte allowlisted/pinned.
  const runtimeLedger = row.role === 'PRODUCT_SOURCE' && new Set([
    'packages/vscode-extension/src/advanced/auditLedger.ts',
    'packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts',
    'packages/guard-core/src/Ledger.ts',
    'packages/vscode-extension/src/firewall/LedgerStore.ts',
    'packages/vscode-extension/src/firewall/ledger-commands.ts',
  ]).has(p);
  assert(!/(?:scorecard|final-report|handoff|builder[-_]?notes|acceptance|receipt|result|\.env(?:\.|$))/i.test(path.basename(p)));
  assert(runtimeLedger || !/ledger/i.test(path.basename(p)));
  assert(!p.startsWith('docs/'), 'Builder documents are outside the source allowlist');
  assert(/^(?:packages\/(?:vscode-extension|soterai-lite|core|guard-core|detectors)\/|apps\/local-ai-broker\/|LICENSE$|LICENSING\.md$|package\.json$|package-lock\.json$)/.test(p));
  if (row.role === 'PRODUCT_SOURCE') assert(/\.(?:ts|tsx|js|cjs|mjs)$/.test(p) && !p.includes('/__tests__/'));
  if (row.role === 'SYNTHETIC_FIXTURE') assert(p.includes('/__tests__/') || p.includes('/fixtures/'));
  if (row.role === 'LICENSE') assert(/(?:^|\/)(?:LICENSE(?:\.[a-z]+)?|LICENSING\.md|THIRD-PARTY-NOTICES\.md)$/i.test(p));
  if (row.role === 'PRODUCT_MANIFEST') assert(p.endsWith('/package.json') || p === 'package.json' || p === 'package-lock.json');
  return pinned(row);
}
const reviewerPrompt = `# Independent defensive review

Review the owner's SoterAI Lite extension under the cooperative AI threat model. A same-user hostile process is outside its security boundary. Make your own findings before consulting any prior verdict. Do not assume protection from UI labels or a successful runner exit.

First run node verify-kit.cjs and retain the complete output. Confirm object-identity.json, the VSIX, runtime hashes, catalog and every listed input. Inspect the VSIX and sources statically. Use only synthetic values for dynamic checks in a fresh isolated profile with explicit --user-data-dir and --extensions-dir. Install only the supplied VSIX; a development-path product is a different execution mode. Do not use a normal profile, real secrets, external providers, downloads, logins, publishing, Git pushes, process signals, or OS/VM changes.

Create a fresh public file and fake .env fixture with seed-synthetic-project.cjs. Test useful public reads and withheld synthetic values, exact previews, cancellation, drift, feature withdrawal, restart, trust changes, policy preservation and explicit Restore changes before removal. Retain raw commands, output, exact loaded runtime hashes, timestamps, statuses, actual child close and stdout/stderr EOF facts. Observe unknowns as UNVERIFIED; a missing result is not PASS. For each supported tool distinguish an actual tool route from an API or mock. Any test requiring broader authority stops and records that requirement.

Pre-commit is unsupported and must not be advertised as verified. Check retained recovery access without re-running its withdrawn original native test program. Record build dependencies and advisory uncertainty separately from shipped runtime behavior. Windows observations do not establish Linux/macOS/remote support. Authenticated real-agent smoke, five-user usability and a real screen-reader pass require separate human evidence.

Return the complete report verbatim as UTF-8 Markdown plus optional JSON. Every finding needs ID, severity, exact object identity, evidence paths/hashes and command/result, affected catalog IDs, reproducible synthetic steps, expected/actual behavior, impact under the stated threat model, and a fix suggestion. Include verified cases, failed cases, skips, unexecuted scope and limitations. Do not calculate a final rating. The owner retains the publication decision.
`;
const verifier = `'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=__dirname, manifest=JSON.parse(fs.readFileSync(path.join(base,'file-list.json'),'utf8')), digest=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const r of manifest.files){assert(!path.isAbsolute(r.path)&&!r.path.split('/').some(s=>s==='..'||s==='.'));const f=path.join(base,r.path);let p=f;while(p!==base){const s=fs.lstatSync(p);assert(!s.isSymbolicLink());if(p===f)assert(s.isFile()&&s.nlink===1);p=path.dirname(p);}const b=fs.readFileSync(f);assert.equal(b.length,r.bytes,r.path);assert.equal(digest(b),r.sha256,r.path);}
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.relative(base,path.join(p,e.name)).replaceAll('\\\\','/')]);
assert.deepEqual(walk(base).sort(),[...manifest.files.map(r=>r.path),'file-list.json'].sort());
console.log(JSON.stringify({status:'PASS_EXACT_PACKET_FILE_BYTES_ONLY',files:manifest.files.length,identity:JSON.parse(fs.readFileSync(path.join(base,'object-identity.json'),'utf8')),nativeTestsRun:0,independentVerdict:'NOT_PROVIDED'}));
`;
const seed = `'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(process.argv[2]||'');assert(process.argv.length===3&&path.isAbsolute(process.argv[2]));assert(!fs.existsSync(base));assert(/(?:^|[\\\\/])soterai-review-synthetic-[a-zA-Z0-9-]+$/.test(base));assert(fs.lstatSync(path.dirname(base)).isDirectory());fs.mkdirSync(base);fs.writeFileSync(path.join(base,'public.txt'),'PUBLIC_REVIEW_CONTROL_7BE61\\n',{flag:'wx'});fs.writeFileSync(path.join(base,'.env'),'FAKE_API_KEY=SOTERAI_SYNTHETIC_REVIEW_ONLY_7BE61\\nPUBLIC_REVIEW_MODE=fixture\\n',{flag:'wx'});console.log(JSON.stringify({status:'SYNTHETIC_FIXTURE_CREATED_NO_PRODUCT_TEST_RUN',path:base,files:['public.txt','.env']}));
`;
function prepare(request) {
  assert.equal(request.schemaVersion, 1);
  assert.deepEqual(Object.keys(request).sort(), ['artifact','catalog','destination','files','runtimeIdentity','schemaVersion'].sort());
  assert(/^docs\/soterai-lite\/independent-review-kit-20261104-[0-9a-f]{8}$/.test(request.destination));
  const destination = path.resolve(repo, relative(request.destination));
  assert(!fs.existsSync(destination));
  const parent = path.dirname(destination);
  assert(fs.lstatSync(parent).isDirectory() && !fs.lstatSync(parent).isSymbolicLink());
  const artifact = pinned(request.artifact), catalog = pinned(request.catalog);
  assert.equal(artifact.rel, 'packages/soterai-lite/soterai-lite-0.7.0-f32-20261103-attempt01.vsix');
  assert.equal(artifact.sha256, expectedArtifact);
  assert.equal(catalog.rel, 'docs/soterai-lite/LITE-CATALOG.json');
  assert.equal(catalog.sha256, expectedCatalog);
  assert(Array.isArray(request.files) && request.files.length > 0 && request.files.length <= 1600);
  const admitted = request.files.map(row => ({ ...allowed(row), role: row.role }));
  assert.equal(new Set(admitted.map(r => r.rel.toLowerCase())).size, admitted.length);
  assert(admitted.some(r => r.role === 'PRODUCT_SOURCE'));
  assert(admitted.some(r => r.role === 'LICENSE'));
  assert(Array.isArray(request.runtimeIdentity) && request.runtimeIdentity.length === 4);
  for (const row of request.runtimeIdentity) assert(/^[a-z0-9-]+\.js$/.test(row.name) && /^[0-9a-f]{64}$/.test(row.sha256) && Number.isSafeInteger(row.bytes) && row.bytes > 0);
  assert.equal(new Set(request.runtimeIdentity.map(r => r.name)).size, 4);
  const items = [{ rel: 'product/SoterAI-Lite.vsix', raw: artifact.raw, role: 'EXACT_ARTIFACT' }, { rel: 'catalog/LITE-CATALOG.json', raw: catalog.raw, role: 'FROZEN_CATALOG' }, ...admitted.map(r => ({ rel: 'source/' + r.rel, raw: r.raw, role: r.role }))];
  const identity = { schemaVersion: 1, artifact: { path: 'product/SoterAI-Lite.vsix', bytes: artifact.bytes, sha256: artifact.sha256 }, catalog: { path: 'catalog/LITE-CATALOG.json', bytes: catalog.bytes, sha256: catalog.sha256 }, runtimeIdentity: request.runtimeIdentity, threatModel: 'COOPERATIVE_AI', independentReview: 'NOT_PROVIDED', finalRating: 'PENDING_REQUIRED_HUMAN_EVIDENCE', preCommit: 'UNSUPPORTED_OWNER_SKIPPED_NO_MORE_ORIGINAL_NATIVE_RUNS', buildAdvisoryReview: 'KNOWN_FINDINGS_REMEDIATION_OPEN_NO_RISK_ACCEPTANCE', dynamicExecution: 'NOT_RUN_BY_PACKET_GENERATOR' };
  for (const [rel, text] of [['reviewer-prompt.md',reviewerPrompt],['verify-kit.cjs',verifier],['seed-synthetic-project.cjs',seed],['object-identity.json',JSON.stringify(identity,null,2)+'\n']]) items.push({ rel, raw: Buffer.from(text), role: 'NEUTRAL_INSTRUCTIONS' });
  const hits = [];
  for (const item of items) if (!item.rel.endsWith('.vsix')) {
    const text = item.raw.toString('utf8').replaceAll('\\', '/');
    for (const needle of prohibitedReferences) if (text.toLowerCase().includes(needle.toLowerCase())) hits.push({ path: item.rel, needle });
  }
  assert.deepEqual(hits, [], 'Excluded contextual reference found; inspect and narrow the allowlist');
  return { destination, items, identity, search: { status: 'PASS_EXACT_EXCLUDED_PATH_REFERENCE_SEARCH', scannedNonArchiveFiles: items.length - 1, prohibitedReferences, hits, limitation: 'The archive is inspected separately by the exact release-content auditor. This search proves the declared reference patterns, not absence of every possible contextual influence.' } };
}
function main() {
  assert(['--check','--build'].includes(process.argv[2]) && process.argv.length === 4);
  const requestPath = path.resolve(process.argv[3]); regular(requestPath);
  const request = JSON.parse(fs.readFileSync(requestPath,'utf8').replace(/^\uFEFF/,''));
  const plan = prepare(request);
  if (process.argv[2] === '--check') { console.log(JSON.stringify({ status: 'PASS_INERT_PACKET_ALLOWLIST_ADMISSION_NO_FILES_WRITTEN', files: plan.items.length, search: plan.search, nativeTestsRun: 0 })); return; }
  fs.mkdirSync(plan.destination);
  const files=[];
  plan.items.push({rel:'exclusion-search.json',role:'PACKET_EXCLUSION_PROOF',raw:Buffer.from(JSON.stringify(plan.search,null,2)+'\n')});
  for (const item of plan.items) { const target=path.join(plan.destination,item.rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,item.raw,{flag:'wx'});files.push({path:item.rel,role:item.role,bytes:item.raw.length,sha256:digest(item.raw)}); }
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,status:'EXACT_PACKET_BYTES_NOT_INDEPENDENT_REVIEW',files},null,2)+'\n');
  fs.writeFileSync(path.join(plan.destination,'file-list.json'),manifest,{flag:'wx'});
  console.log(JSON.stringify({status:'NEUTRAL_PACKET_WRITTEN_NOT_TESTED_OR_INDEPENDENTLY_REVIEWED',destination:slash(path.relative(repo,plan.destination)),files:files.length,fileListSha256:digest(manifest),nativeTestsRun:0,releaseReady:false}));
}
if(require.main===module) main();
module.exports={prepare,relative,allowed};
