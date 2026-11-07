# F32 observer completion acknowledgment Implementation Plan

> **For agentic workers:** Implement the authorized bounded fixture change in this review directory. Root reviews the concrete files before any later native run.

**Goal:** Keep an owned Code window alive until the attach-only renderer has recorded the successful observer result and disconnected.

**Architecture:** Both observer variants publish their existing results with a fresh nonce. The renderer binds its completion receipt to that nonce and the exact observer-result bytes, and publishes it after CDP disconnection. The observer validates the receipt before its existing normal close command.

**Tech Stack:** Existing CommonJS fixtures, Node filesystem/crypto/assert APIs, PowerShell preparation only.

**Spec:** Root's delegated acknowledgment-successor task; original lifecycle contract in `../../20261103-f32-lifecycle-2e95d6a4/run-installed-lifecycle-proposed-07.cjs:753`.

## Global Constraints

- Write only within `docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/`.
- Preserve frozen native07 files and all 44 assertions, 59 observations, and eight phases.
- No native launch, product API replacement, process signal, new approval gate, or unbounded wait.
- Keep the renderer receipt a synchronization record; it adds no acceptance observation.

## Review Focus

- Observer completion before CDP attachment must keep the window alive.
- A receipt from another phase or attempt must fail closed.
- Changed observer-result bytes must not satisfy acknowledgment.
- Renderer disconnect failure must not publish success.
- Missing acknowledgment must expire under the existing 90-second UI bound.

## Task 1: Prepare inert successors and controls

- [x] Create current/old observer successors that await an exact nonce/hash acknowledgment before successful normal close.
- [x] Create a renderer successor that publishes acknowledgment only after its existing CDP disconnect succeeds.
- [x] Add focused controls for delayed acknowledgment, stale nonce, wrong phase, changed hash, timeout, and unchanged assertion bodies.
- [x] Inspect generated changes and verify originals remain byte exact; all three `node --check` commands exit 0.
- [x] Run `node --experimental-test-isolation=none --test docs/soterai-lite/evidence/20261106-remaining-queue/f32-review/completion-controls.test.cjs`: 18 passed, 0 failed. The installed Node requires the experimental flag spelling.
- [ ] Root reviews these concrete successors before any later native run.

## Task 2: Parameterized new-candidate successor

- [x] Accept explicit source parent and four pinned new-candidate artifacts; retain old evidence without equating it to new source/archive bytes.
- [x] Verify native07's retained consumed admission, trust failure, and actual Code/renderer closure streams.
- [x] Integrate ACK successors and optional timestamped trust failfast; an intent alone cannot satisfy the existing keyboard receipt.
- [x] Derive fresh R21 qualification from the new full-suite PASS line and derive expected installed size from the exact new archive/current vendor contract.
- [x] Preserve the complete 44/59/eight-phase acceptance sequence; 11 focused generator controls pass.
- [ ] Root supplies the current candidate facts and runs the inert generator's static admission before native verification.
