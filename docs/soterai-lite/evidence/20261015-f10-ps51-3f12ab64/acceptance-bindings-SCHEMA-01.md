# Deferred F10 acceptance contract

These scripts are authored and unexecuted. Root supplies a new real final-facts JSON in this directory after every required final check passes. Paths in hash specifications are relative to this F10 evidence directory; artifact/source paths are relative to the repository. No filename discovery, guessed digest, historical artifact substitution or implicit PASS is supported.

Required top-level fields:

- `schemaVersion: 1`, `feature: "F10"`, `parentCommit: "24da9ce9907cd6082b7ce3a3e79136cd4c551508"`.
- `artifact: {path, sha256}` identifying the physical F10 VSIX. Accepted names explicitly encode date 20261016 or 20261017 and an `attemptNN`; Root binds the actual final object.
- `inspection: {path, sha256}` for the matching PASS content-inspection JSON, with its real extraction root/current source provenance. This is independent evidence, not a fabricated process receipt.
- `checks`: exactly eight process-receipt entries with distinct roles `focused`, `typecheck`, `full`, `readiness`, `package`, `hostBuild`, `native`, `affected`. Each has `log`, naming a raw `.txt` whose adjacent `.result.json` identifies argv/exit/SHA. Focused/full also have `kind: "tap"` and `expected: {tests,pass,fail,cancelled,skipped}` using actual final counts. A combined host wrapper receipt may serve both native and affected roles only if it actually executed both and returned success.
- `focusedPartition: {f10, extensionParity: 76}`. The explicit F10 count must be at least 332 and sum to the final focused TAP count; zero focused skips/failures/cancellations are required. The anticipated 335+76 is not inferred by the script.
- `native`: hash specifications `summary`, `freeze`, `probe`, `primary`, `restart`. The summary must bind exactly primary16/restart3 PASS observations to the supplied runtime/VSIX. The retained primary/restart results must be byte-identical to their actual isolated D: files. Probe may be a compiled `.js` inside an excluded prebuilt directory; its hash is recorded in acceptance, while copied runtime/probe files stay outside Git.
- `affected`: hash specifications `summary`, `functional`, `security`, `comparison`. The supplied summary must identify the same final physical artifact/runtime; functional10 must pass, and all 17 security identities must match the retained baseline statuses (8 BLOCKED_SCOPED/9 LEAK_CONFIRMED, zero changed rows).
- `reviews`: a nonempty array of final hash specifications; `reviewDisposition: "NO_OPEN_SCOPED_BLOCKERS"`. This is an explicit Root disposition at LOW independence, not an independent certification inferred by the scripts.
- Optional `priorEvidence`: exact F09 evidence-root filenames to carry into this source barrier, at most32, limited to JSON/TXT/PS1/CJS. No directory walk of prior features occurs.

Run in order, using the existing environment escalation when protected Git writes/child spawning require it:

1. `node docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/prepare-acceptance-01.cjs <new-final-facts.json>`.
2. Review the new `f10-acceptance-01.json`, `f10-evidence-index-01.json`, `f10-commit-allowlist-01.txt` and appended ledger receipt. Acceptance leaves queue F10 ACTIVE. Index includes current bytes of all explicit related source/test/doc paths plus F10 JSON/TXT/MD/PS1/CJS evidence, including preserved failed drafts. It excludes copied extension/profile/prebuilt/runtime/dist/VSIX/JS artifacts. The unchanged extension parity fixture is index-only; any change to it refuses acceptance.
3. Run `commit-f10-01.ps1`. It requires empty pre-existing staging, unchanged parent, exact index-bound allowlist and every staged byte. It uses command-local `core.autocrlf=false` and the existing offline hooks directory. No unrelated Git state is reset or cleaned.
4. `node docs/soterai-lite/evidence/20261015-f10-ps51-3f12ab64/verify-commit-01.cjs <actual-commit-40hex> <actual-final-vsix-sha256>`. It checks every indexed Git blob/current byte, exact changed-path set, parent, package source inputs, extracted runtime identity and fresh physical VSIX hash. It writes `f10-committed-byte-verification-01.json` only after these checks pass.

A separate Root-authored transition and its byte verification are still required before F10 DONE/F11 activation. These scripts do not perform that transition, push, publish, tag, OS/profile changes, cleanup, process termination, downloads, logins or any numerical rating.
