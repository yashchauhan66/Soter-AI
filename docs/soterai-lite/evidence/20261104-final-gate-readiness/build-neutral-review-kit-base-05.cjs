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
const compiledDistInputs = new Map([
  [
    "packages/detectors/dist/business-sensitive.js",
    {
      "bytes": 7457,
      "sha256": "e728f1e5248c28b6a1f01d0c90b131b42a5afdf6ce817dcb231718baa45a360e"
    }
  ],
  [
    "packages/detectors/dist/code.js",
    {
      "bytes": 969,
      "sha256": "626a3675f56fa10c0514b00cc69a00dce8945a922ada32e980f149505ef74011"
    }
  ],
  [
    "packages/detectors/dist/core.js",
    {
      "bytes": 868,
      "sha256": "9494da59300423519c73f48a803930c5a75c25a63704fd4c13e85749c6436157"
    }
  ],
  [
    "packages/detectors/dist/index.js",
    {
      "bytes": 2768,
      "sha256": "92dfa49d24c023483fab7b462fd2c494fd95a4af889afa18d78741f0ed0f7a89"
    }
  ],
  [
    "packages/detectors/dist/multimodal.js",
    {
      "bytes": 26053,
      "sha256": "cfd7ac947a567ce4a6cb3434579be4ee25380928209acd11f3c0ced0e323435c"
    }
  ],
  [
    "packages/detectors/dist/normalize.js",
    {
      "bytes": 12863,
      "sha256": "29364d378b4c39be54ff00777e94211280b093a12253c58817245f57fb9746a6"
    }
  ],
  [
    "packages/detectors/dist/pii-global.js",
    {
      "bytes": 2274,
      "sha256": "2501204dca2656732c5f5d10aba9e6d81d1af0757fa39084f85d2a2c60720f09"
    }
  ],
  [
    "packages/detectors/dist/pii-india.js",
    {
      "bytes": 2400,
      "sha256": "7eb5542d19cb2d83d8c3cd88aaee98ea5a4a4c6a2d55200e2e796f934ce9410c"
    }
  ],
  [
    "packages/detectors/dist/prompt-injection.js",
    {
      "bytes": 6742,
      "sha256": "a54061e40fbafa321f544cf1b99e328f728c0f9681f8d65e5a619f941d0461e5"
    }
  ],
  [
    "packages/detectors/dist/secrets.js",
    {
      "bytes": 4218,
      "sha256": "a7ae71487c91976470c611d41447881cc30ccb5cf74ef04b9c43048337f290c1"
    }
  ],
  [
    "packages/detectors/dist/semantic.js",
    {
      "bytes": 5652,
      "sha256": "fda0bc6ecf22dceefe6c233d07cbe32a3b244500d30de11f3f8600701c747d8c"
    }
  ],
  [
    "packages/guard-core/dist/ApprovalToken.js",
    {
      "bytes": 6779,
      "sha256": "b041cd14995f6b5158553107531576852ba760ba3b5f8f60525c399c1d20fead"
    }
  ],
  [
    "packages/guard-core/dist/BrokerScanner.js",
    {
      "bytes": 6274,
      "sha256": "6b4dfc94d52e657bb586e2e632d7c1facce024b9d1b8fb3ddefcbd072ab8cd38"
    }
  ],
  [
    "packages/guard-core/dist/Canary.js",
    {
      "bytes": 4691,
      "sha256": "b5131fd65e8affe0abb69a273d97a9068b3229b97861d4ecd08e0be5489fc57e"
    }
  ],
  [
    "packages/guard-core/dist/CapabilityRegistry.js",
    {
      "bytes": 34683,
      "sha256": "e8f00efe304242d57cf28c4bce9a5e4e8ce81178d13abad64fd18e528452d44a"
    }
  ],
  [
    "packages/guard-core/dist/CheckpointRollback.js",
    {
      "bytes": 10691,
      "sha256": "c8e81273794a1710a3e9890d7517c8d60d874baef6f521005c9830ce30044ae6"
    }
  ],
  [
    "packages/guard-core/dist/ContextRedactor.js",
    {
      "bytes": 3052,
      "sha256": "9fc8cbc0fcabea2a84e563cf442b82e297e80ba1dd20c963cd6936ba836a4f39"
    }
  ],
  [
    "packages/guard-core/dist/ControlledTerminal.js",
    {
      "bytes": 5402,
      "sha256": "9e0b79f1567c48bb38bc56db8a6146a37d228eb410d5c922bc9d40ce9b410535"
    }
  ],
  [
    "packages/guard-core/dist/CoverageMatrix.js",
    {
      "bytes": 4668,
      "sha256": "947804c40f3ea5da93cd25a281c3109fa8c342ecd40b9fbb0085b509660f6199"
    }
  ],
  [
    "packages/guard-core/dist/DecisionEngine.js",
    {
      "bytes": 12229,
      "sha256": "c2a6ebdaaee4ecedd7e6fc16173abb6930a312922d0ff7de680cfce95452cfd2"
    }
  ],
  [
    "packages/guard-core/dist/detectors/AIGeneratedCodeRiskDetector.js",
    {
      "bytes": 4872,
      "sha256": "e7ee298fa854ac851c4e52e5671a204b540c39e8536ee8d51ef31acc111fc44b"
    }
  ],
  [
    "packages/guard-core/dist/detectors/EncodedSecretDetector.js",
    {
      "bytes": 6588,
      "sha256": "28e21e18c744600f0663a2d1dced50e2bbbdf513b61ee480e4df328bd21f0478"
    }
  ],
  [
    "packages/guard-core/dist/detectors/EnvFileDetector.js",
    {
      "bytes": 1831,
      "sha256": "19b135030df2e1f5f1e89331376bdba9e7a0dcb0e075102ffffda418e388db06"
    }
  ],
  [
    "packages/guard-core/dist/detectors/FileContextRiskDetector.js",
    {
      "bytes": 4248,
      "sha256": "e3ec4a61595168ab8ff8efe1072abc3b4f910b98d486e6d99f05d240ed8ea9cf"
    }
  ],
  [
    "packages/guard-core/dist/detectors/index.js",
    {
      "bytes": 6993,
      "sha256": "6609d1fec2c87e2ae1d42c6452338e09bd6f98b5dd73531627f2fe17daf3be6a"
    }
  ],
  [
    "packages/guard-core/dist/detectors/IndiaPIIDetector.js",
    {
      "bytes": 3177,
      "sha256": "43f31bf358abbef1633bedc954e30de4ae913cb84f50025cb618a2c72b4c3a4e"
    }
  ],
  [
    "packages/guard-core/dist/detectors/JailbreakLiteDetector.js",
    {
      "bytes": 10741,
      "sha256": "05744da522c21ea71b6c78d1812aa5deac394d6c6afc6d707e4537d48f4058fe"
    }
  ],
  [
    "packages/guard-core/dist/detectors/MCPConfigRiskDetector.js",
    {
      "bytes": 2807,
      "sha256": "44c6036f27a2f2b6fadfdae0ddd07134063e505bcbbcf322af24f1f680e6303d"
    }
  ],
  [
    "packages/guard-core/dist/detectors/OutputExfiltrationDetector.js",
    {
      "bytes": 4020,
      "sha256": "72439e44b89479c926aca1e43eeb2554528017e7348a9c097033dc47187e03bb"
    }
  ],
  [
    "packages/guard-core/dist/detectors/PIIDetector.js",
    {
      "bytes": 3004,
      "sha256": "09eb678a36d3a4229aac48753645801428799748e3c347b2623e04be4bbf0a3c"
    }
  ],
  [
    "packages/guard-core/dist/detectors/PromptInjectionLiteDetector.js",
    {
      "bytes": 17071,
      "sha256": "47245977ed5e455c77750b9289fe6cd62250d6553cc330183b9cdf9cd5f42a32"
    }
  ],
  [
    "packages/guard-core/dist/detectors/RepoInstructionPoisoningDetector.js",
    {
      "bytes": 4295,
      "sha256": "3b2b766ba552581f3563d520d63798d0bc5789904d39fa39320d064f9120bb50"
    }
  ],
  [
    "packages/guard-core/dist/detectors/SecretDetector.js",
    {
      "bytes": 32181,
      "sha256": "564476c85ca12385137a9b37e50ef4abdf3c15725c5f52bc4b3cdedebc1432b4"
    }
  ],
  [
    "packages/guard-core/dist/detectors/TerminalCommandRiskDetector.js",
    {
      "bytes": 7059,
      "sha256": "f64e3ddf6f8e1b95d332d1f677327d1914c3940985c554d0ad918a556fa33e1a"
    }
  ],
  [
    "packages/guard-core/dist/detectors/utils.js",
    {
      "bytes": 3561,
      "sha256": "873e7266377cc36fe42e22c640ac345a4b8862896bbfc7d4e1b6cec21110f1bd"
    }
  ],
  [
    "packages/guard-core/dist/EvidenceMinimizer.js",
    {
      "bytes": 1473,
      "sha256": "45eb0653f7ce5934710b249075264e2d85d8766fe761a796e5dac5bbad392e95"
    }
  ],
  [
    "packages/guard-core/dist/ExtensionIsolationPolicy.js",
    {
      "bytes": 4472,
      "sha256": "388c2e2a80c00bfa964656ec39e6e60bddd305c2e4676e127d5baca958ccbe56"
    }
  ],
  [
    "packages/guard-core/dist/ExtensionRiskScanner.js",
    {
      "bytes": 6546,
      "sha256": "d009d2476d91fc8f501ffb6f194493a65de60dfa60578f4d7f6482c075bf3589"
    }
  ],
  [
    "packages/guard-core/dist/FileOperationFirewall.js",
    {
      "bytes": 5709,
      "sha256": "84fa3c50f7b01c9c5d4f8339295613e8cac8380bae6d060888dba445d643820f"
    }
  ],
  [
    "packages/guard-core/dist/GovernancePolicy.js",
    {
      "bytes": 3033,
      "sha256": "73403668e77a44fd5cb9279ab0177b6184e5bce4e34eec80dfcbddc05b859561"
    }
  ],
  [
    "packages/guard-core/dist/HashCache.js",
    {
      "bytes": 7809,
      "sha256": "ffa5487a66c52ef1bcb05a3a6bcc5196ba8abae6e4c67073ee85fcd3b3f00d0f"
    }
  ],
  [
    "packages/guard-core/dist/index.js",
    {
      "bytes": 2896,
      "sha256": "deff36cace0cded0f52e9cf0b56d2550f60cb0ecdf20d31c310ed82e0fefec5a"
    }
  ],
  [
    "packages/guard-core/dist/Ledger.js",
    {
      "bytes": 8790,
      "sha256": "65ba22a2968655c9be12fb939bf806006b889d2a8cd38bb09176b2e80dfb78db"
    }
  ],
  [
    "packages/guard-core/dist/LitePolicyCatalog.js",
    {
      "bytes": 10382,
      "sha256": "4abfd336bd4a9d26453460653fc3f75856b7320527cb6da159043724d581abce"
    }
  ],
  [
    "packages/guard-core/dist/MCPCredentialBoundary.js",
    {
      "bytes": 3665,
      "sha256": "3a4ce5afa1d3c9ddc21e4f924de546b81ec8a1b2138c9be0ba0c78220c3fc897"
    }
  ],
  [
    "packages/guard-core/dist/MCPGateway.js",
    {
      "bytes": 4908,
      "sha256": "1f93d209a74ea977167344d69b911569db9eb7590a160a54d6f68201759ebc37"
    }
  ],
  [
    "packages/guard-core/dist/MCPPolicyAnalyzer.js",
    {
      "bytes": 10043,
      "sha256": "257eb4f978f07d44064f4b76a3a640f5f972693232222d1b775eb403ca4622b1"
    }
  ],
  [
    "packages/guard-core/dist/MemorySession.js",
    {
      "bytes": 4817,
      "sha256": "c2cda00fe3577a736df57ad1a1b82e89b1e8d87caa5ee262e97d105c8d52bb2f"
    }
  ],
  [
    "packages/guard-core/dist/NetworkEgressPolicy.js",
    {
      "bytes": 7031,
      "sha256": "b9ae06b8a734a8204a95bdddec7b501ac978d601902ca54e023d09a22f5f53a1"
    }
  ],
  [
    "packages/guard-core/dist/OutputLeakScanner.js",
    {
      "bytes": 3287,
      "sha256": "00e10b9699a1784faab1d243d6db42fa7e0730a45738686a9cc0c1c2f5b256eb"
    }
  ],
  [
    "packages/guard-core/dist/PolicyEvaluator.js",
    {
      "bytes": 3720,
      "sha256": "33eb29ba48cfb47e6637b695d034e3a8b6f87c1548a73d102221a517cad5db30"
    }
  ],
  [
    "packages/guard-core/dist/ProcessSandboxPolicy.js",
    {
      "bytes": 5662,
      "sha256": "49e10546300fd2d2595fbb39a86196846b278235c1f1aedd00e30f122cf5c440"
    }
  ],
  [
    "packages/guard-core/dist/ProjectPolicy.js",
    {
      "bytes": 7843,
      "sha256": "3dbab85be929e9866ce59d4627d14d5e2dd9a4eb8063cb344347a4c57660ef36"
    }
  ],
  [
    "packages/guard-core/dist/Redactor.js",
    {
      "bytes": 15935,
      "sha256": "cfaf0c082c38effc48150940506edd1295ef1c85fb002795623b0b8f30c4c20f"
    }
  ],
  [
    "packages/guard-core/dist/RuntimeDiscovery.js",
    {
      "bytes": 5072,
      "sha256": "561bc9f2f85fb67a9ba3c5055540c60c1954ffb7b7d9e299131dca9bca76eff3"
    }
  ],
  [
    "packages/guard-core/dist/RuntimePolicyEngine.js",
    {
      "bytes": 8640,
      "sha256": "75697fc8e9bd553dfdd937d0b2ae3753dbd665bf915b9a99994aea4208338d34"
    }
  ],
  [
    "packages/guard-core/dist/SafeContextBuilder.js",
    {
      "bytes": 9620,
      "sha256": "0c011b4a595ac09360d9ca815f198713a706364b54e8e3e3482cbe59aa5dd88b"
    }
  ],
  [
    "packages/guard-core/dist/SafeMode.js",
    {
      "bytes": 8126,
      "sha256": "f858c4f9c28ac4afe16b75b90ef4b45c37304ec3f79d35ec9f15130edf884333"
    }
  ],
  [
    "packages/guard-core/dist/sensitiveFiles.js",
    {
      "bytes": 8275,
      "sha256": "e9ff335cb9428f6725e15c18b91b3f68a82e348e2a3f7f2b22b4376884dac0ee"
    }
  ],
  [
    "packages/guard-core/dist/TaintEngine.js",
    {
      "bytes": 2761,
      "sha256": "826eb8f46c2261b2e2ced42dfba8c1bde76e827710ca236c56c7db618290ca86"
    }
  ],
  [
    "packages/guard-core/dist/types.js",
    {
      "bytes": 298,
      "sha256": "3d7d9f9a8a51ec9c98ed93cb98034f0e26454120835b63715fb8d73ae508752a"
    }
  ],
  [
    "packages/guard-core/dist/Vault.js",
    {
      "bytes": 9393,
      "sha256": "cd9e52c0fc14d134a574689a157e154d36c477d44bfea92bf9dd92afade5b1b9"
    }
  ],
  [
    "packages/guard-core/dist/VaultCrypto.js",
    {
      "bytes": 3334,
      "sha256": "a76fc4ccd13c3c98aad821fa0cda8d1e7724630fb7d3d09dd565586495cd80c8"
    }
  ]
]);
// Only these four actual runtime build inputs bypass the contextual directory names.
const runtimeDirectoryInputs = new Map([
  [
    "packages/vscode-extension/src/artifacts/ArtifactContent.ts",
    {
      "bytes": 10256,
      "sha256": "9d642ea537bf304f0cadb61f90da440ba5d698096ad2917575facea4b9282f88"
    }
  ],
  [
    "packages/vscode-extension/src/artifacts/ArtifactController.ts",
    {
      "bytes": 12775,
      "sha256": "e7259e62bc36e924608958fbeaa506d546335464afe3f0fae68580c21f7ef161"
    }
  ],
  [
    "packages/vscode-extension/src/artifacts/ArtifactFlags.ts",
    {
      "bytes": 474,
      "sha256": "ee2b8f0b6f03031ff4b82cdc49b312ecfcf6e97899631d8180a6084354e8baa9"
    }
  ],
  [
    "packages/vscode-extension/src/artifacts/commands.ts",
    {
      "bytes": 1590,
      "sha256": "28bdf131559e2a526a4de85c4174372147f3a643f57542f04f842b022ca084f0"
    }
  ]
]);
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
  const compiled = compiledDistInputs.get(p);
  const compiledProduct = row.role === 'PRODUCT_SOURCE' && compiled && row.bytes === compiled.bytes && row.sha256 === compiled.sha256;
  const runtimeDirectory = runtimeDirectoryInputs.get(p);
  const runtimeDirectoryProduct = row.role === 'PRODUCT_SOURCE' && runtimeDirectory && row.bytes === runtimeDirectory.bytes && row.sha256 === runtimeDirectory.sha256;
  assert(!/(?:^|\/)(?:\.git|node_modules|builds)(?:\/|$)/i.test(p));
  assert(runtimeDirectoryProduct || !/(?:^|\/)(?:artifacts|evidence)(?:\/|$)/i.test(p));
  assert(compiledProduct || !/(?:^|\/)dist(?:\/|$)/i.test(p));
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
  assert(runtimeLedger || compiledProduct || !/ledger/i.test(path.basename(p)));
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
