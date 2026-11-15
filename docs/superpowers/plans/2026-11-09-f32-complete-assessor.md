# F32 Complete Disk Assessor Implementation Plan

> **For agentic workers:** Implement the assigned assessor task autonomously; the root agent owns execution and review.

**Goal:** Independently assess original F32 44 assertions, 59 observations and eight phases from immutable disk evidence.

**Architecture:** A new inert CommonJS assessor reads the selected preparation/admission, hashes exact artifacts and evidence, and evaluates each phase independently. Unknown descendants and failed helpers prevent acceptance; an explicit CLI output flag may create a new report without replacing prior evidence.

**Tech Stack:** Node.js built-ins and node:test.

**Spec:** docs/soterai-lite/FEATURE-QUEUE.json F32; legacy/native-ps7-07 generated original phase contract.

## Global Constraints

- Preserve current VSIX ceea88a4aef06ab37f886beccdcdaab7677e87caacdcab51a37f22c2e648ef7d and genuine old dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677.
- Do not run native applications, alter generated runners, or edit canonical feature status.
- Require natural actual close, zero signals, both EOF and hashes of raw streams for every declared owned child.
- Keep releaseReady false: lifecycle evidence does not satisfy independent human or OS secure-desktop gates.

## Review Focus

- Missing or duplicated IDs cannot inflate the original contract.
- A passing observer with a failed helper or missing final receipt remains incomplete.
- Null command metadata requires exact vanished snapshot identity/time/parent and independent later absence.
- Unknown command hashes remain rejected even after owner absence.
- Recomputed package/source/admission hashes detect tampering and links.

### Task 1: Assessor and regression controls

**Files:**
- Create: docs/soterai-lite/evidence/20261109-queue-resume/legacy/assess-complete-ps7.cjs
- Create: docs/soterai-lite/evidence/20261109-queue-resume/legacy/assess-complete-ps7.test.cjs

**Interfaces:** `assess({ selected, output })`, `close(fact)`, `census(custody, context)`, and original `PHASE_IDS`.

- [x] Add tests for closure tampering, phase contract duplication, unknown descendants, and vanished identity/time qualification.
- [x] Implement read-only disk hashing, independent package/source validation, original phase checks and conservative report.
- [x] Run node --test on assessor controls and node assessor native-ps7-07; controls PASS23/23 and prior run INCOMPLETE with helper exit1 / missing phase8 / run failure.
- [ ] Have root run the assessor after independently closed native08.
