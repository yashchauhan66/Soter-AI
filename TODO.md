# SoterAI IDE Guard — Enterprise Upgrade TODO

## Phase 0 — Real Marketplace Baseline Test
- [ ] Create `docs/enterprise-real-test/baseline-marketplace-test-report.md` placeholder with PASS/FAIL table (BLOCKED until real Marketplace install testing).
- [ ] Document real test procedure in `docs/enterprise-real-test/README.md`.

## Phase 1 — Enterprise AI Runtime Threat Model
- [ ] Create `docs/enterprise-ai-runtime-threat-model.md` covering 20 threat classes with:
  - risk
  - user fear
  - real attack path
  - SoterAI current coverage (honest)
  - missing control
  - enterprise control to add
  - test case

## Phase 2 — Build AI Activity Sentinel
- [ ] Inspect existing canary/vault/broker/memory modules to wire event sources (no raw secrets).
- [ ] Implement sentinel event model + redacted evidence storage (pure functions + tests).
- [ ] Implement background watchers for observable signals:
  - protected file changes
  - MCP config changes
  - repo instruction poisoning files changes
  - brokered request/response events (routed through SoterAI only)
  - canary hits in generated output/reports
  - terminal commands (only via SoterAI terminal workflows)
  - extension enable/install changes (via VS Code events)
- [ ] Add commands:
  - `SoterAI: Enable AI Activity Sentinel`
  - `SoterAI: Disable AI Activity Sentinel`
  - `SoterAI: Show AI Activity Timeline`
  - `SoterAI: Export AI Activity Report`
  - `SoterAI: Clear AI Activity Events`
- [ ] Add UI:
  - status bar On/Off
  - sidebar latest high-risk AI activity
  - timeline panel with redacted evidence only (no HTML/script injection)
- [ ] Add unit/integration tests for sentinel:
  - secret redaction guarantee (no raw canaries/secrets in reports)
  - event timeline ordering
  - risk scoring deterministic behavior
  - fail-closed behavior on parsing/IO errors

## Phase 3 — Protected Workspace Mode (scaffold only in this cycle)
- [ ] Add command + settings plumbing only (behavior gated until Phase 2 complete and Vault/Safe Context wiring verified).
