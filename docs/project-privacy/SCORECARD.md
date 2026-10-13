# Local candidate scorecard — 2026-10-12

All result rows are **FACT**, measured from the linked local execution evidence on 2026-10-12. A passing compatibility or runner result is not a confidentiality guarantee.

| Check | Actual result | Evidence / limit |
|---|---|---|
| Final unit suite | **790 PASS / 0 FAIL / 3 SKIP**, 793 tests, 106 suites | [Log](evidence/20261012-final-local/full-tests-agent-target.log); skipped Windows symlink cases remain UNTESTED |
| Typecheck and production/test build | **PASS** | [Typecheck](evidence/20261012-final-local/typecheck-agent-target.log), [build](evidence/20261012-final-local/build-agent-target.log) |
| Real VS Code functional host | **10 PASS / 0 FAIL** | [Results](evidence/20261012-final-local/raw/functional/functional-results.json); synthetic files and scripted dialogs, not independent presence |
| Existing SecurityReview, all 17 cases | **8 scoped blocks / 9 leaks** | [All-17 comparison](evidence/20261012-final-local/host-comparison.json); 16 unchanged vs A0, retained repository deny improved |
| Existing NativeBaseline | **9 scoped blocks / 9 leaks / 6 public controls / 1 identity observation / 1 NOT_REPRODUCED** | [Results](evidence/20261012-final-local/raw/native/results.json); overlapping leak observations are not 18 distinct failures |
| Actual dashboard review host | **UI_READY; MATCHED; full claim BLOCKED** | [Receipt](evidence/20261012-final-local/raw/ui/ui-ready.json); separate synthetic review window, main editor untouched |
| Final browser visual checks | **30 PASS / 0 FAIL** | [Receipt](evidence/20261012-final-local/visual-results.json); captured actual-host HTML, not native editor screenshots or accessibility certification |
| Codex / Gemini public-context compatibility | **1 PASS each** | [Agent receipts](evidence/20261012-final-local/agent-cli/results.json); supplied synthetic context, no protection/IDE routing proof |
| Claude Code CLI | **INCOMPLETE** | Installed 2.1.292; `Not logged in · Please run /login`; zero model tokens. [Raw response](evidence/20261012-final-local/agent-cli/claude-public-control.json) |
| Claude Code IDE / Cline / Cursor | **NOT_TESTED** | Installed inventory or launcher is not proof of authenticated routing; [receipts](evidence/20261012-final-local/agent-cli/results.json) |
| Ollama | **INCOMPLETE** | Server-start check timed out; no local model/server provisioned |
| Local VSIX | **PASS** | [Inventory](evidence/20261012-final-local/vsix-integrity.json); source/tests/caches/secrets excluded; bundled file hashes match current files |
| Full project confidentiality / G1–G6 | **BLOCKED** | Existing nine leaks remain. Independent OS identity, policy/consent authority, secret runtime and mandatory egress are undeployed |

**INFERENCE:** The candidate is usable for bounded managed reads and reviewed public development workflows. It cannot enforce original-file confidentiality against independent same-user agents. See [final report](FINAL-LOCAL-REPORT.md), [rollback controls](FINAL-LOCAL-REPORT.md#rollback) and [deployment gates](DEPLOYMENT-GATES.md).

No main-editor installation, OS/account/VM/firewall/driver change, push or deployment was performed. Historical Phase 0–5/A0 evidence is retained; this scorecard does not replace it.

**FACT (Gemini CLI result recorded 2026-10-12):** A separate actual tool control also passed: two successful `read_file` calls read the previously approved synthetic public export, returning its greeting and dotenv schema names. One `update_topic` metadata call occurred; zero file changes were recorded. This verifies public-export compatibility, not original-file denial, SoterAI tool interception or isolation. Sources: [raw result](evidence/20261012-final-local/agent-cli/gemini-selected-files-control.json), [agent receipts](evidence/20261012-final-local/agent-cli/results.json).

## Subsequent backend setup, separate scope

**FACT / later local setup (2026-10-12):** After candidate verification above, the separately approved VirtualBox base/core-driver installation completed. Following the owner's delegated choice on the exact VM plan, only the new D: storage-root ACL and two new powered-off base VMs were configured. Read-only assertions: **22 PASS / 0 FAIL**. The existing backend inspector observed real metadata for both; artifact binding remains UNVERIFIED and full claim BLOCKED. Extension/controller source and frozen bundle were unchanged in this VM step; earlier suites were not rerun. Sources: [setup report](full-mode/STOPPED-VM-SETUP-REPORT.md), [assertions](evidence/20261012-stopped-vm-create/configuration-assertions.json), [actual inspector](evidence/20261012-stopped-vm-create/live-backend-inspection.json).

**INFERENCE / current assessment:** Stopped configuration does not resolve nine native-route leaks or establish working AI isolation, mandatory egress or independent consent. Full claim remains BLOCKED; subjective rating **4.6 / 10**. Source: [rating](full-mode/RATING-20261012.md). Earlier statements of no VM/driver changes describe the earlier candidate-verification scope only.
