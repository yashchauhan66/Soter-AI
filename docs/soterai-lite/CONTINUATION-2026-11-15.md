# Continuation of the isolated-agent improvements, 15 November 2026

Resumed thread `01a1d7c4-c88d-7602-a7ad-425c7687214e` at its final failed regression/package checks. The earlier isolated agent, Vault operations, app dependency snapshots, recovery envelope and evaluation corpus were already implemented. They were retained rather than rebuilt.

The final Windows x64 0.7.0 preview is [soterai-secret-guard-0.7.0-isolated-hardening-20261115-final.vsix](../../packages/soterai-lite/soterai-secret-guard-0.7.0-isolated-hardening-20261115-final.vsix), 1,706,656 bytes, SHA-256 `984296701d88e395b736248fa26748fbd28495b63c5006b87da511587fbd91ee`. Use the [final release pointer](../../output/hardening-20261115/final-release-pointer.json) for subsequent checks. The earlier failed package attempt and intermediate packages remain preserved. No publication occurred; `releaseReady` remains false.

## Completed remaining integration work

- Fixed seven new command titles that repeated the SoterAI category, and added their advanced-command menu entries to the canonical and Lite manifests. Enable `soterai.showAllCommands` to expose these commands in the palette.
- Aligned the two new native command registration helpers with the existing static registration contract. The handlers were already registered at runtime; this closes the contract failure without granting new authority or changing their review/argument checks.
- Regenerated the readiness document from the actual command and setting counts.
- Fixed package provenance admission for the four new isolated-agent CLI dependencies. Only the exact reviewed paths join the existing shared scanner allowlist. Adjacent CLI modules and owner-operation entrypoints remain refused, and admitted files still require matching current bytes.
- Fixed verification startup on clean CI checkouts by creating the missing fixed `output` parent. Existing run directories still cannot be overwritten; out-of-scope output paths remain rejected. The clean initialization failure was reproduced before the fix and checked afterward. Hosted CI itself was not run.
- Added shipped usage, privacy and changelog documentation for isolated tasks, secretless Vault operations, dependency snapshots and portable recovery. Prepared a new review packet and unsigned local provenance for the final artifact.

## Verification without repeating completed work

The interrupted full run is preserved at [source-final-01](../../output/hardening-20261114/source-final-01/result.json): 5,237 passed, 10 failed and seven skipped. Its three typechecks and 21 selected core/CLI checks passed. This continuation did not rerun the entire suite or rewrite that failed receipt.

The ten failed cases are closed by these scoped checks:

| Check | Result |
| --- | --- |
| Command/menu/readiness changes and affected native-command/recovery suites | 122 passed, zero failures/skips |
| Claude schema/conversation, MCP scanner and broker lifecycle suites | 67 passed, zero failures/skips |
| Release/provenance/package suites, including new admission and hash-refusal controls | 104 passed, zero failures/skips |
| Extension TypeScript check | Passed |
| Final shipped-document contracts | 87 passed, zero failures/skips; overlaps the earlier 122 |
| Exact final package audit, embedded SBOM and notices | Passed |
| Exact packaged broker loopback scenarios | 12 passed; synthetic credentials, no external provider |
| Isolated 0.6.2 to 0.7.0 CLI installation/metadata upgrade | Passed; synthetic metadata retained and all four runtime hashes verified |
| Review packet byte verification | Passed; no human verdict |

Four earlier failures occurred at timing boundaries while the full suite ran concurrently. All four affected suites passed with test-file concurrency one; production deadlines were not relaxed. This establishes the scoped rerun results, not freedom from timing sensitivity on all machines. The remaining six failures concerned command metadata, static registration discovery and generated documentation.

The new provenance-admission regression failed before the fix and passed afterward, while correctly hashed unapproved CLI files remained rejected. [New check logs and receipts](../../output/hardening-20261115/summary.json) retain both the failing reproduction and successful results.

## Retained completed improvements

The earlier [native isolated-agent result](../../output/hardening-20261114/native-agent-final-05/result.json) remains `PASS_NATIVE_ISOLATED_AGENT`, with actual guest planning/tools, traversal refusal, verified execution and cleanup, and no application of guest writes to the host. It used a deterministic model callback rather than an external provider. All three recorded source hashes still match.

The earlier [50-case synthetic evaluation](../../output/hardening-20261114/evaluation-final/security-evaluation.md) retains 40 supported cases with zero false positives/negatives, five explicitly outside-contract misses, five unsupported inputs, and nine of nine public workflow-preservation checks. All 86 recorded source bindings still match. These small, self-maintained cases do not establish real-world detection rates or model task quality.

[Retained-evidence reconciliation](../../output/hardening-20261115/retained-evidence.json) also confirms all four compiled runtimes are byte-identical to the last built runtimes from the previous thread. The two helper-name changes affect source hashes but not the minified runtime bytes. Docker and evaluation were not rerun.

## Still external or unverified

Real Vault issuance/ACL enforcement, an external provider through the new isolated-command flow, native GUI acceptance of the revised app loader and portable recovery commands, independent human/security/accessibility trials, independently reproducible clean builds, hosted CI execution and publication remain outside the completed local checks. Earlier native evidence for other package versions does not establish these new command flows. The direct Cline free-model reply remains evidence of that unmanaged route only.

The preview provides finite optional isolation; other extensions and arbitrary same-user processes remain outside that guest boundary. Unsupported transformations and separate-request fragmentation remain documented gaps. Nothing here establishes universal secret protection or a new numerical product rating.
