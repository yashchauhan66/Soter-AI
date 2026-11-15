# Secret Protection P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the reproduced recognized-password forwarding defect and make release automation verify the Lite artifact it actually builds.

**Architecture:** Reuse accepted detector spans for assignment redaction, then validate the exact final serialized provider payload under finite limits. Bind packaging and workflow outputs to the existing immutable build/package receipts rather than legacy filenames. Preserve Lite's declared cooperative boundary.

**Tech Stack:** TypeScript, Node.js, node:test/tsx, existing esbuild/vsce toolchain, GitHub Actions.

**Spec:** `docs/soterai-lite/ROADMAP-2026-11-12.md` and `docs/soterai-lite/SECRET-PROTECTION-AUDIT-2026-11-12.md`.

**Execution:** User authorized implementation on 12 November. Native execution with reasoning-only peer review; subagents do not have repository tools in this session. Companion execution skills are not installed. Follow the per-task test cycle directly. No extra plan approval is needed. This is the executable P0 slice; P1-P4 remain tracked in the roadmap, not silently marked complete.

**Current result:** Source fixes, release receipt integration, a new VSIX and packaged-broker smoke are complete with fresh verification. Full installed-host UI/upgrade and external release acceptance remain open. See `docs/soterai-lite/P0-IMPLEMENTATION-2026-11-12.md`. User cancelled cleanup; no project cleanup is authorized.

## Global Constraints

- Windows local Lite candidate remains 0.7.0 pre-release; no universal isolation claim.
- Preserve unrelated working changes and old evidence; create new dated evidence.
- Use synthetic credentials and mock/loopback collectors for regression tests.
- No real credential reads, publication, production deployment, or destructive migration in this slice.
- A detector hit is not proof of credential validity. Preserve existing false-positive handling and high-risk policy vocabulary.
- Approved requests still obey secret-protection checks.
- Raw provider payloads, matches and credentials must not enter diagnostics.
- Record fresh source/bundle verification separately from native installed-host or independent human acceptance.

## Review Focus

1. Quoted/prefixed password assignments below entropy thresholds must be redacted or blocked.
2. Nested provider metadata and JSON tool arguments cannot bypass final validation or be forwarded as corrupted protocol JSON.
3. Enterprise approval cannot bypass the outbound secret invariant.
4. Public IDs, placeholders and ordinary prompts must retain useful passing controls.
5. Wrong/stale artifact paths, versions and hashes cannot enter verification, signing or upload.

## Task 1: Detector-aligned redaction and outbound invariant

**Files:**
- Modify `packages/guard-core/src/Redactor.ts` and `BrokerScanner.ts`.
- Create `packages/guard-core/src/__tests__/assignment-redaction.test.ts`.
- Create `apps/local-ai-broker/src/OutboundSecretPolicy.ts` and its tests.
- Modify `apps/local-ai-broker/src/GatewayPolicy.ts`; modify protocol redaction helpers in `BrokerServer.ts` only if required to preserve valid arguments.
- Create `packages/vscode-extension/src/__tests__/gatewayAssignmentRedaction.test.ts`.

**Interfaces:**
- Consume `detectSecrets(text).matches` and existing `DetectorMatch` spans; no independently copied assignment-key grammar.
- Add `findUnredactedSecrets(text: string): string[]`, a value-free outbound survivor check distinct from the global high-risk category vocabulary.
- Add `assertSafeOutboundJson(wire: string): void`, using bounded semantic decoding and generic errors. Validate the same immutable string subsequently supplied to fetch.

- [x] Write tests for prefixed/unprefixed and quoted password/API assignments, false positives, idempotence, final metadata/argument protection and public controls.
- [x] Run the new tests before implementation and retain actual failing output.
- [x] Implement detector-span redaction, survivor checking and bounded final payload validation. Preserve valid tool argument JSON or refuse unsupported transformations.
- [x] Run new tests plus existing redaction, detector vocabulary, broker and gateway suites.
- [x] Re-run the audit's original synthetic reproduction into a new result file; the original audit evidence stays immutable.
- [x] Verify compiler and bundled behavior; report any installed-host gap explicitly.

Commands start from repository root: `node --import tsx --test <new test files>`; `node node_modules/typescript/bin/tsc --noEmit -p packages/soterai-lite/tsconfig.json`.

## Task 2: Receipt-based release identity

**Files:**
- Modify `packages/soterai-lite/scripts/package.cjs` and `build.cjs` as needed for explicit receipts and fresh dependency input.
- Create a focused Lite release-receipt helper and tests under `packages/soterai-lite/scripts/`.
- Modify `.github/workflows/cross-ide-release.yml` and `.github/workflows/signed-release.yml`.
- Modify existing provenance integration only where legacy artifact discovery must be removed.

**Interfaces:**
- Consume immutable `build-provenance.json`, `package-receipt.json` and final inventory.
- Produce validated identity, version, repo-relative artifact path, byte count, hash and receipt paths for CI.
- Receipt-derived values drive verification, comparison, signing and upload. No glob-based fallback to legacy VSIX files.

- [x] Write synthetic receipt tests for correct identity and wrong path/version/hash/runtime/manifest inputs.
- [x] Observe failures before implementing the new helper.
- [x] Implement the helper using existing final-package verification and safe bounded file reads.
- [x] Update workflow packaging/toolchain setup and artifact consumers without removing signing, reproducibility or human gates.
- [x] Run release tests, parse both workflows, build/package one new candidate, and validate its receipt/hash.
- [x] Confirm source tests and the produced bundle exercise the same redaction implementation.

## Task 3: Current implementation record

- [x] Add dated implementation results and commands with actual pass/fail counts.
- [x] Update roadmap progress without rewriting the prior audit observations.
- [x] Explicitly retain P1 usability, P2 isolation/broker, P3 CI/deploy product work and P4 independent/human acceptance as outstanding until implemented and verified.

No commit or publication is required to make this working-tree implementation reviewable.
