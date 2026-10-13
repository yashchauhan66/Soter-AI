# Enterprise privacy increment I1: sensitive policy consistency

Date: 2026-10-12. Branch: security-hardening. Starting HEAD: 8ef3aeb54f4019f4ee815a844443995176a656f0. The pre-existing project-privacy changes were retained. This increment and those changes are local and uncommitted. No installation, live editor reload, host probe, OS/account/ACL/VM/firewall/driver change, push or deployment was performed.

## Result and claim

**FACT (source and local tests, 2026-10-12):** a manually sensitive file now stores its deny and always-masked treatment in one retained PathRule, using one logical Memento write. Existing ordinary denies upgrade without consuming a duplicate slot. Additive public policy APIs preserve stronger treatment. The safe reader uses the immutable boundary snapshot for sensitivity and policy revision.

**FACT (source and local tests, 2026-10-12):** legacy sensitive metadata is validated and committed into the retained policy before managed release, and is not deleted. Failed migration/corrupt state withhold the affected managed reader. A completed migration retains treatment if the old tag store later disappears. Generic deny relaxation excludes sensitive entries. During sensitive marking, earlier reviews/previews are revoked, overlapping reads of the normalized path are withheld, and unrelated public-file reads can continue. A save failure does not acknowledge a saved restriction.

**Claim sentence — INFERENCE:** SoterAI's managed reader now retains manually sensitive classification together with its deny, preventing the tested split-write, downgrade and overlapping-save disclosure paths. This does not establish that Cline, sibling extensions or ordinary terminals cannot read or send original project data. Full G1-G6 remain BLOCKED; selected-architecture assertions remain UNTESTED; release WITHHELD; deployment DEFERRED.

**INFERENCE / persistence limit:** “atomic” describes one logical saved record, not independently owned or experimentally crash-safe storage. Complete policy deletion, same-user Memento manipulation, durability across OS failure and rollback continuity remain unverified. Do not infer new OS guarantees from passing stub tests.

## Changed files in this increment

Paths in the first group are relative to packages/vscode-extension/:

- src/ai-boundary/policy.ts: validated file-only sensitive:true metadata; normalized-identity restrictive merge.
- src/ai-boundary/BoundarySnapshot.ts: legacy migration, immutable sensitive classification, revision inclusion and sensitive-relaxation exclusion.
- src/project-privacy/SensitiveRestrictions.ts: malformed present-root metadata is rejected rather than defaulted to empty.
- src/project-privacy/commands.ts: one policy write; per-normalized-file pending-write holds; revoke/clear before and after mutation; dedicated flag.
- src/project-privacy/panel.ts: show sensitive treatment from retained rules; respect the dedicated rollback flag. This does not implement the later UI workstream.
- package.json: soterai.projectPrivacy.atomicSensitivePolicy, default true, machine scope, restricted in untrusted workspaces.
- src/__tests__/sensitive-policy.test.ts: twelve product/adapter regressions with synthetic data and positive controls.
- src/__tests__/project-privacy.test.ts: existing marking assertion checks the retained rule rather than expecting a second legacy write.
- README.md: actual restricted-setting count updated from 34 to 35.

Repository documents:

- docs/vscode-extension-readiness.md: regenerated from the actual manifest.
- docs/project-privacy/ENTERPRISE-ARCHITECTURE.md: ADRs, explicit decision matrix, G1-G6 layer limits, development workflow, implementation/rollback roadmap and primary-source dates.
- docs/project-privacy/USER-GUIDE.md: new storage semantics and safe rollback instructions.
- This report, its checksum index and evidence directory. Earlier implementation reports and historical Phase 0-5 evidence were not rewritten.

## Verification

**FACT (local runs, 2026-10-12):**

| Check | Result | Evidence |
|---|---|---|
| Focused policy/privacy/boundary unit tests | 64 PASS, 0 FAIL; exit 0 | [focused final](evidence/20261012-atomic-sensitive-policy/focused-tests-final.log) |
| Full extension unit suite, serial | 679 discovered; 677 PASS, 0 FAIL, 2 SKIP; 106 suites; exit 0 | [full final](evidence/20261012-atomic-sensitive-policy/full-tests-serial.log) |
| TypeScript typecheck | PASS; exit 0 | [typecheck final](evidence/20261012-atomic-sensitive-policy/typecheck-final.log) |
| Production build, two esbuild CPU workers | PASS; exit 0 | [build final](evidence/20261012-atomic-sensitive-policy/build-serial.log) |
| Independent read-only source review | Pending-write race identified and addressed; no new blocking defect in final review | Findings described below; not an independent operational certification |

The focused suite is a subset of the full suite. The twelve new controls cover one logical write, failed save, existing-review revocation, overlapping-save denial with a working public control, upgrade at 256-rule capacity, malformed data, retained migration, migration failure, concurrent roots, revision binding/monotonic classification, sensitive relaxation exclusion and rollback. Assertions execute actual product modules/command adapters with synthetic files and a VS Code stub.

**FACT (full test output, 2026-10-12):** two existing Windows symlink assertions were skipped because creation returned EPERM. The directory junction control passed. Those two assertions remain UNTESTED; no privilege or feature was changed to enable them.

**FACT (retained failed attempts, 2026-10-12):** initial focused workers could not start inside the sandbox: `spawn EPERM`. The approved retry exited before assertions with `exitCode: 3221225725` / `3221226505`. Serial execution then ran 63 tests with one test-harness failure, `undefined == true`, because the new test guessed modal readiness with a bounded immediate-poll loop. It now waits for the actual modal barrier; the security assertion was not relaxed. These logs remain [initial](evidence/20261012-atomic-sensitive-policy/focused-tests.log), [worker retry](evidence/20261012-atomic-sensitive-policy/focused-tests-retry.log), [serial initial](evidence/20261012-atomic-sensitive-policy/focused-tests-serial.log).

**FACT (retained resource failures, 2026-10-12):** the initial full-suite process reported `Fatal process out of memory: Zone`. The initial build reported `fatal error: runtime: cannot allocate memory`, `runtime: VirtualAlloc of 16384 bytes failed with errno=1455` and `Error: The service was stopped`. Failed logs remain [full initial](evidence/20261012-atomic-sensitive-policy/full-tests.log) and [build initial](evidence/20261012-atomic-sensitive-policy/build.log). The build had removed generated dist output; the backed-up old bundles were restored before retry. With memory pressure eased, the sequential retries passed. GOMAXPROCS=2 applied only to those command processes and was restored afterwards. No Code.exe process was closed/killed and no OS memory setting was changed. These are harness/resource failures, not safety-filter rejections or passing security observations.

**FACT (source review and final regression, 2026-10-12):** review found that a request begun during a pending failed save could otherwise use the old ordinary treatment. Counted pending markers now hold that normalized path before the write is queued until settlement. The deferred-write regression asserts no review/content for that file and useful output for an unrelated public file. Lexical path normalization is not proof of canonical Windows file-alias equivalence.

## Artifact hashes and historical preservation

**FACT (local SHA-256, 2026-10-12):**

| Artifact | SHA-256 |
|---|---|
| New extension.js | f6648b9c09dc1daca6d8fdb587da92476cad52dd313ba5c3d39411dfc61346a4 |
| Unchanged local-ai-broker.js | 6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397 |
| Unchanged soterai-mcp-server.js | 6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486 |
| Previous extension.js, backed up | 8ee14f9798011270eab9794c31e9f348eabd552b60952e8e08c381c05ce74206 |
| Restored historical phase2/results.jsonl | 3191295ab69a2f35b069a8b6bab94ac5a4c9670fd19708cfa81ab7d21fe1c9e3 |

The new bundles have not been loaded into a live host. Source/document/raw-log hashes are in [ENTERPRISE-I1-SHA256SUMS.txt](ENTERPRISE-I1-SHA256SUMS.txt); their identities do not establish operational security. Previous bundles are preserved in this increment's pre-change-bundles directory.

**FACT (byte comparison, 2026-10-12):** the unit suite appended synthetic results to tracked phase2/results.jsonl. The original prefix was checked byte-for-byte against the pre-test backup, generated output was retained separately as unit-generated-phase2-results.jsonl, and the exact original bytes were restored. The restored hash matches the starting hash above. A0 and historical host records remain unchanged.

## Rollback and outstanding work

**FACT (source and unit control, 2026-10-12):** set only soterai.projectPrivacy.atomicSensitivePolicy false to withdraw the new reader/mutation routes; keep soterai.projectPrivacy.enabled true. Retained denies remain and existing project-privacy raw-paste/reveal masking defaults stay enabled. This setting change has not been applied to the owner's live IDE. Re-enable after diagnosing the problem. Do not downgrade to an older reader that ignores sensitive:true; no automatic downgrade/data migration is provided.

**INFERENCE / unprotected and UNTESTED:** Cline's independent filesystem/tools/model uploads; ordinary terminals; original protected buffers, clipboard, screenshots, process memory/environment, source history and old copies; custom repository sensitivePaths always-masked treatment; unknown private prose; complete store deletion or same-user tampering; crash durability; Windows file-name aliases and concurrent filesystem replacement; remote workspaces and delegates; independent consent/policy/key custody; actual OS isolation and mandatory egress. The pre-existing protected-region/dotenv composition concern belongs to I2 and is not claimed fixed here.

**INFERENCE / next step:** I2 safe-view composition, followed by honest UI, publication/dummy runtime, broker capabilities and separately authorized enforced deployment. Current per-read prompts remain; no claim of uninterrupted live Cline workflows is made. Stop after I1, following the owner's one-workstream review instruction.
