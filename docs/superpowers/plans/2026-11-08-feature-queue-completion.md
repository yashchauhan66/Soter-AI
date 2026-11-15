# Remaining Feature Queue Implementation Plan

> **For agentic workers:** Execute with one product implementation writer and parallel investigation, evidence tooling, and review. The owner requested immediate completion; existing authorization covers necessary local verification. Preserve all existing work.

**Goal:** Finish the remaining executable queue work, close verified feature gates, and expose the precise unresolved acceptance requirements.

**Architecture:** Reuse the exact recovery artifact only after checking all frozen inputs and receipt hashes. Repair reproducible verification failures without changing historical artifacts or assertions. Reconcile the queue and release documents with verified current evidence, then checkpoint the scoped source and evidence.

**Tech Stack:** TypeScript, Node.js test runner, PowerShell, VS Code native integration harnesses, Git.

**Spec:** `docs/soterai-lite/FEATURE-QUEUE.json` and `docs/soterai-lite/IMPLEMENTATION-PLAN.md`, F26/F31/F32 and V01–V05.

## Global Constraints

- Preserve unrelated dirty work and immutable historical receipts.
- Product implementations remain serial; independent investigations and evidence tools may run concurrently.
- Keep real human results, external review, unsupported platforms, and unresolved native assertions incomplete until evidence exists.
- Use isolated synthetic profiles for native checks; leave normal profiles and credentials alone.
- Required evidence must refer to exact source, artifact, tool and configuration identities.

## Review Focus

- Queue current-artifact fields must never refer to superseded receipts as current acceptance.
- Native deadlines and missing process close/stream records must remain explicit failures.
- Genuine 0.6.3 upgrade failure cannot be repaired by changing the historical binary or weakening assertions.
- Aggregate route tests do not establish all 264 catalog pairs or override-resistant protection.
- Scoped commits must preserve the tested file bytes and exclude unrelated user work.

### Task 1: Validate current evidence and finish F26a closure

**Files:** Current recovery candidate and native acceptance receipts; new `docs/soterai-lite/evidence/20261108-queue-completion/` verification tools and checkpoint records; `docs/soterai-lite/ledger.md`.

**Interfaces:** Verification consumes pinned `{path, bytes, sha256}` records and produces a dated receipt with actual results, artifact identity and scope.

- [x] Verify the frozen 1,245 inputs, current handoff and neutral kit using the existing verifier.
- [x] Reverify native34 and affected509 acceptance against the recovery VSIX.
- [x] Review the current source changes and create an explicit scoped source/evidence checkpoint with raw-byte verification.
- [x] Prepare F26a/F26 and scoped F31 completion after native and source verification; completion takes effect only when the separate transition byte proof passes.

### Task 2: Resolve remaining automated native failures

**Files:** Existing F32 and Codex IDE failed receipts; new evidence-only successors under `docs/soterai-lite/evidence/20261108-queue-completion/`.

**Interfaces:** Successors retain original assertion IDs, bind actual host/tool hashes, and write new output paths without overwriting failed runs.

- [x] Diagnose Codex IDE deadline using retained logs and process evidence; add focused controls for any justified harness correction.
- [x] Execute the reviewed isolated successor and retain success or actual failure evidence.
- [x] Recheck F32 current lifecycle and limited upgrade results; record genuinely unavailable legacy assertions separately.

### Task 3: Reconcile queue and handoff

**Files:** `FEATURE-QUEUE.json`, `FINAL-REPORT.md`, `HUMAN-ACTIONS.md`, `README-CLAIMS.md`, `RELEASE-EVIDENCE.json`, release checklist, dated status evidence.

**Interfaces:** Current queue metadata references verified current receipts; immutable historical reports retain their original meaning.

- [x] Add drift/consistency checks that reject stale artifact references and unsupported completion claims.
- [x] Replace stale running/not-built fields with verified results, update remaining work and retain incomplete required gates.
- [x] Run focused verification, inspect the final diff and record completed work plus concrete remaining blockers.
- [x] Confirm human results availability: owner answered on 8 November that none are available; no invented usability, screen-reader, real-agent or independent verdict.

## Continued implementation: build dependency remediation

The owner reiterated that all remaining work is required. Human results are still unavailable. Continue executable engineering work without promoting absent acceptance.

- [x] Resolve the nine affected build dependencies against actual published metadata and the retained 42 advisory records.
- [x] Install an isolated, pinned packaging toolchain; preserve the current candidate, root dependencies and frozen input proof.
- [x] Exercise the real VSIX packaging API on the current immutable staged payload and compare every decompressed package entry against the accepted candidate.
- [x] Verify the new installed closure against the retained advisories, record compatibility failures and perform an actual current advisory lookup where available.
- [x] Prepare exact scoped progress for the queue, leaving legacy migration, catalog scenario controls and human gates incomplete unless new evidence satisfies them.

## Final checkpoint

Source commit `639639189c49cc6b45691abed4a61f6852176984` verified479 files with zero mismatches. Codex IDE21 and combined CLI/IDE41 pass with actual nested closure; raw catalog linkage indexes99+hook4 and promotes zero of264 pairs. Final F26/F31 completion requires `docs/soterai-lite/evidence/20261108-queue-completion/transition-checkpoint-01-byte-proof.json` and a passing `node docs/soterai-lite/evidence/20261108-queue-completion/verify-completion.cjs`. Original legacy0.6.3 migration and actual catalog/human acceptance remain incomplete.
