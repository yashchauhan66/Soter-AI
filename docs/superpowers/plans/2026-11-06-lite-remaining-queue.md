# SoterAI Lite Remaining Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining F32, F26a, F31 and V01–V05 work with current executable evidence and an accurate queue.

**Architecture:** Continue the existing implementation and acceptance contracts. Repair the isolated verification harness where current VS Code behavior invalidates its old assumptions; change product code only for reproduced product failures. Preserve previous results and unrelated changes.

**Tech Stack:** TypeScript, Node.js tests, PowerShell, installed Windows VS Code, Playwright, local VSIX packaging.

**Spec:** `docs/soterai-lite/IMPLEMENTATION-PLAN.md`, `docs/soterai-lite/FEATURE-QUEUE.json`.

## Global Constraints

- The owner's 6 November request explicitly resumes F26a and the remaining cards. Historical skipped/failed results stay historical; they do not supply new acceptance.
- One product implementation at a time. Local synthetic fixtures, isolated profiles, exact artifact identity, owned process shutdown, no normal-profile installation.
- Retain the original F32 44 assertions / 59 observations / eight phases and F26a 34 native checks.
- Onboarding under 120 seconds, zero admin prompts and zero extra installs for advertised local features.
- Preserve the frozen catalog and the 17-case unmanaged baseline, with every failed and unavailable result visible.
- V05 prepares HUMAN-ACTIONS and stops for the specified human evidence. No numerical rating, publication or independent-human verdict is invented.
- Execute directly in this session under the user's existing request; the named superpowers execution subskills are not installed. Do not pause authorized implementation for plan approval.

## Review Focus

- Updated VS Code executable and application files must match their measured identities before a native launch.
- Modal UI and desktop startup must be observable without replacing product confirmations.
- `vscode-userdata` storage must work locally while remote, noncanonical and workspace-contained paths refuse safely.
- Restart, broker outage, hook withdrawal and extension removal must preserve policy and avoid exposing stored secrets.
- Queue and release documents must distinguish automated completion from remaining human and unavailable-platform checks.

## Task 1: Complete installed lifecycle verification

**Files:** Existing F32 harness in `docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/`; successor evidence in `docs/soterai-lite/evidence/20261106-remaining-queue/`; product lifecycle files only if a product regression is reproduced.

**Interfaces:** Consume the current exact VSIX, genuine 0.6.3 upgrade VSIX and measured installed VS Code identities. Produce assertion-level lifecycle results and owned close/stream evidence.

- [ ] Read retained extra06 stderr and current vendor receipts; identify the startup failure.
- [ ] Add focused harness regression controls for the diagnosed difference, and retain old failures.
- [ ] Run a reviewed successor on an isolated synthetic profile through all required phases.
- [ ] Verify loaded product hashes and original assertion IDs before accepting F32.

## Task 2: Complete pre-commit support

**Files:** `packages/vscode-extension/src/history-hooks/PreCommitController.ts`, `packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts`, existing F26a native harness and successor evidence.

**Interfaces:** Preserve the existing hook/controller protocol. Produce current public-commit, blocked-secret, outage, restart and restoration evidence.

- [ ] Run the existing storage URI regression and pre-commit component/integration suites.
- [ ] Diagnose the retained activation failure and minimally fix any reproducible defect.
- [ ] Build a unique current VSIX and run all original native checks, including actual Git.
- [ ] Restore supported claims only after complete acceptance, then reverify affected lifecycle/package checks.

## Task 3: Package and final automated gates

**Files:** `packages/soterai-lite/scripts/`, release metadata and documentation under `docs/soterai-lite/`, `FEATURE-QUEUE.json`.

**Interfaces:** Consume one final artifact identity and exact source inputs; produce an inspected VSIX, dependency audit, catalog results and neutral verifier kit.

- [ ] Run typecheck, the complete relevant suite, package controls and affected real-host routes.
- [ ] Run the dependency audit and resolve findings within scope; record unresolved external constraints accurately.
- [ ] Reconcile V02 budgets, catalog controls and two scripted benchmark projects against the final artifact.
- [ ] Refresh V03 documentation and V04 neutral kit; validate hashes, allowlists and claims.
- [ ] Write V05 HUMAN-ACTIONS and the exact-object handoff for genuinely human work.
- [ ] Update queue/ledger from verified results and review the final scoped diff. Commit locally only if the repository gate permits it.
