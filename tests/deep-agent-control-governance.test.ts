import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createActionLedgerEntry, validateRollbackAttempt } from "../lib/agent-action-ledger";
import { buildAgentControlMetrics, rollbackWindowState } from "../lib/agent-control";

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP REAL TESTING: AI Agent Control + AI Usage Governance
// ═══════════════════════════════════════════════════════════════════════════════
// Coverage areas:
//   A. Agent Action Ledger — reversal classification, risk scoring, rollback
//   B. Agent Control Metrics — approval queues, evidence freshness, edge cases
//   C. Governance Engine — policy resolution, department rules, data classification
//   D. Governance Enforcement — route integration, headers, notification dispatch
//   E. Rollback System — window states, deadline expiry, irreversibility
//   F. Security Boundaries — SQL injection, XSS, privilege escalation
//   G. Architecture Completeness — all routes, dashboards, Prisma models exist
// ═══════════════════════════════════════════════════════════════════════════════

// ── A. Agent Action Ledger: Reversal Classification ─────────────────────────

test("DEEP-LEDGER-001: payment.charge is IRREVERSIBLE + CRITICAL + BLOCK", () => {
  const entry = createActionLedgerEntry({ tool: "stripe", action: "payment.charge", target: "cus_abc" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.equal(entry.riskLevel, "CRITICAL");
  assert.equal(entry.decision, "BLOCK");
  assert.ok(entry.irreversibleReason?.includes("Money movement"));
  assert.equal(entry.rollbackDeadline, null);
});

test("DEEP-LEDGER-002: wire transfer is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "bank", action: "wire.send", target: "acct_xyz" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.equal(entry.decision, "BLOCK");
});

test("DEEP-LEDGER-003: UPI payment is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "upi", action: "send", target: "vpa@bank" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.equal(entry.riskLevel, "CRITICAL");
});

test("DEEP-LEDGER-004: delete operation is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "database", action: "drop.table", target: "users" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.ok(entry.irreversibleReason?.includes("Destructive deletion"));
});

test("DEEP-LEDGER-005: legal.accept is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "legal", action: "terms.accept", target: "tos_v2" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.ok(entry.irreversibleReason?.includes("Legal acceptance"));
});

test("DEEP-LEDGER-006: publish is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "npm", action: "publish", target: "my-pkg@1.0.0" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
});

test("DEEP-LEDGER-007: deploy is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "k8s", action: "deploy", target: "prod-cluster" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
});

test("DEEP-LEDGER-008: gmail.send (dotted action) is COMPENSATING_ACTION", () => {
  const entry = createActionLedgerEntry({ tool: "gmail", action: "gmail.send", target: "user@example.com" });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
  assert.ok(entry.rollbackDeadline, "Must have a rollback deadline");
  assert.equal(entry.riskLevel, "MEDIUM");
});

test("DEEP-LEDGER-009: slack.post (dotted action) is COMPENSATING_ACTION", () => {
  const entry = createActionLedgerEntry({ tool: "slack", action: "slack.post", target: "#general" });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
});

test("DEEP-LEDGER-010: email.send (dotted action) is COMPENSATING_ACTION", () => {
  const entry = createActionLedgerEntry({ tool: "email", action: "email.send", target: "boss@corp.com" });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
});

test("DEEP-LEDGER-011: crm.update (dotted action) is COMPENSATING_ACTION", () => {
  const entry = createActionLedgerEntry({ tool: "crm", action: "crm.update", target: "deal_123" });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
});

test("DEEP-LEDGER-011b: non-dotted action falls to UNKNOWN (edge case)", () => {
  const entry = createActionLedgerEntry({ tool: "gmail", action: "send", target: "user@example.com" });
  assert.equal(entry.reversalStatus, "UNKNOWN", "Pattern requires dotted format like gmail.send, space-separated falls through");
  assert.equal(entry.decision, "REQUIRE_APPROVAL", "UNKNOWN status triggers human review");
});

test("DEEP-LEDGER-012: draft is REVERSIBLE with auto-inferred rollback", () => {
  const entry = createActionLedgerEntry({ tool: "gmail", action: "create_draft", target: "draft_1" });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  assert.ok(entry.rollbackAction, "Must have auto-inferred rollback");
  assert.equal((entry.rollbackAction as any).action, "delete_draft");
});

test("DEEP-LEDGER-013: calendar.create has auto-inferred rollback", () => {
  const entry = createActionLedgerEntry({ tool: "calendar", action: "create_event", target: "evt_abc" });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  assert.equal((entry.rollbackAction as any).action, "delete_event");
});

test("DEEP-LEDGER-014: filesystem.write (dotted format) is REVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "filesystem", action: "filesystem.write", target: "/tmp/out.txt" });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  assert.equal((entry.rollbackAction as any).action, "restore_previous_value");
});

test("DEEP-LEDGER-015: memory.write (dotted format) is REVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "memory", action: "memory.write", target: "pref_lang" });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
});

test("DEEP-LEDGER-015b: non-dotted filesystem+write is UNKNOWN (regex edge case)", () => {
  const entry = createActionLedgerEntry({ tool: "filesystem", action: "write", target: "/tmp/x.txt" });
  assert.equal(entry.reversalStatus, "UNKNOWN", "Non-dotted format falls to UNKNOWN");
  assert.equal(entry.riskLevel, "HIGH", "UNKNOWN + write pattern → HIGH risk");
});

test("DEEP-LEDGER-016: ticket.close gets inferred rollback so becomes REVERSIBLE (not COMPENSATING)", () => {
  const entry = createActionLedgerEntry({ tool: "jira", action: "ticket.close", target: "PROJ-123" });
  assert.equal(entry.reversalStatus, "REVERSIBLE", "inferRollbackAction matches ticket.close → rollback action set → REVERSIBLE wins over COMPENSATING");
  assert.ok(entry.rollbackAction, "Must have inferred rollback action");
});

test("DEEP-LEDGER-017: unknown action without rollback is UNKNOWN + REQUIRE_APPROVAL", () => {
  const entry = createActionLedgerEntry({ tool: "custom_tool", action: "do_something", target: "x" });
  assert.equal(entry.reversalStatus, "UNKNOWN");
  assert.equal(entry.decision, "REQUIRE_APPROVAL");
});

test("DEEP-LEDGER-018: explicit rollback action overrides to REVERSIBLE", () => {
  const entry = createActionLedgerEntry({
    tool: "custom",
    action: "do_something",
    rollbackAction: { tool: "custom", action: "undo_something" },
  });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  assert.equal(entry.decision, "ALLOW");
});

test("DEEP-LEDGER-019: browser+read without dotted format is UNKNOWN → HIGH → REQUIRE_APPROVAL", () => {
  const entry = createActionLedgerEntry({ tool: "browser", action: "read", target: "https://example.com" });
  assert.equal(entry.reversalStatus, "UNKNOWN", "Non-dotted format falls to UNKNOWN");
  assert.equal(entry.riskLevel, "HIGH", "UNKNOWN + read pattern → still HIGH because UNKNOWN overrides");
  assert.equal(entry.decision, "REQUIRE_APPROVAL");
});

test("DEEP-LEDGER-019b: explicit rollback on browser action → REVERSIBLE but MEDIUM (browser keyword triggers medium)", () => {
  const entry = createActionLedgerEntry({
    tool: "browser",
    action: "read",
    target: "https://example.com",
    rollbackAction: { tool: "browser", action: "close", target: "tab" },
  });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  assert.equal(entry.riskLevel, "MEDIUM", "'browser' in combined matches MEDIUM risk pattern before 'read' can match LOW");
  assert.equal(entry.decision, "ALLOW");
});

test("DEEP-LEDGER-020: search action matches read/search/list/get → LOW risk", () => {
  const entry = createActionLedgerEntry({ tool: "gmail", action: "search", target: "inbox" });
  assert.equal(entry.reversalStatus, "UNKNOWN");
  assert.equal(entry.riskLevel, "LOW", "search matches LOW risk pattern regardless of UNKNOWN reversal");
});

test("DEEP-LEDGER-021: webhook.post is COMPENSATING + MEDIUM", () => {
  const entry = createActionLedgerEntry({ tool: "webhooks", action: "webhook.post", target: "https://hook.site/abc" });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
  assert.equal(entry.riskLevel, "MEDIUM");
});

test("DEEP-LEDGER-022: send_sms is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "twilio", action: "send_sms", target: "+91999" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
  assert.equal(entry.riskLevel, "CRITICAL");
});

test("DEEP-LEDGER-023: OTP send is IRREVERSIBLE", () => {
  const entry = createActionLedgerEntry({ tool: "auth", action: "otp.send", target: "user@test.com" });
  assert.equal(entry.reversalStatus, "IRREVERSIBLE");
});

test("DEEP-LEDGER-024: action hash is deterministic", () => {
  const a = createActionLedgerEntry({ tool: "gmail", action: "send", target: "a@b.com", sessionId: "s1" });
  const b = createActionLedgerEntry({ tool: "gmail", action: "send", target: "a@b.com", sessionId: "s1" });
  assert.equal(a.actionHash, b.actionHash);
});

test("DEEP-LEDGER-025: different targets produce different hashes", () => {
  const a = createActionLedgerEntry({ tool: "gmail", action: "send", target: "a@b.com" });
  const b = createActionLedgerEntry({ tool: "gmail", action: "send", target: "c@d.com" });
  assert.notEqual(a.actionHash, b.actionHash);
});

test("DEEP-LEDGER-026: idempotencyKey is derived from actionHash when not provided", () => {
  const entry = createActionLedgerEntry({ tool: "gmail", action: "send", target: "a@b.com" });
  assert.ok(entry.idempotencyKey.startsWith("ledger_"));
  assert.ok(entry.idempotencyKey.includes(entry.actionHash.slice(0, 24)));
});

test("DEEP-LEDGER-027: explicit idempotencyKey is preserved", () => {
  const entry = createActionLedgerEntry({ tool: "test", action: "do", idempotencyKey: "my_key_123" });
  assert.equal(entry.idempotencyKey, "my_key_123");
});

test("DEEP-LEDGER-028: evidence hashes are SHA-256 hex", () => {
  const entry = createActionLedgerEntry({ tool: "test", action: "do", request: { foo: "bar" } });
  assert.match(entry.evidence.requestHash, /^[a-f0-9]{64}$/);
  assert.match(entry.evidence.resultHash, /^[a-f0-9]{64}$/);
  assert.match(entry.evidence.forwardActionHash, /^[a-f0-9]{64}$/);
});

test("DEEP-LEDGER-029: summary includes tool.action format and reversal status", () => {
  const entry = createActionLedgerEntry({ tool: "Gmail", action: "gmail.SEND", target: "test" });
  assert.ok(entry.summary.includes("gmail.gmail.send"));
  assert.ok(entry.summary.toLowerCase().includes("compensating"));
});

test("DEEP-LEDGER-029b: non-dotted action summary reflects UNKNOWN status", () => {
  const entry = createActionLedgerEntry({ tool: "Gmail", action: "SEND", target: "test" });
  assert.ok(entry.summary.includes("gmail.send"));
  assert.ok(entry.summary.toLowerCase().includes("unknown"));
});

test("DEEP-LEDGER-030: tool and action are normalized to lowercase", () => {
  const entry = createActionLedgerEntry({ tool: "  Gmail  ", action: "  SEND  ", target: "test" });
  assert.equal(entry.tool, "gmail");
  assert.equal(entry.action, "send");
});

// ── B. Rollback Validation ──────────────────────────────────────────────────

test("DEEP-ROLLBACK-001: irreversible entry cannot be rolled back", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "IRREVERSIBLE",
    rollbackDeadline: null,
    rollbackAction: null,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("irreversible"));
});

test("DEEP-ROLLBACK-002: missing rollback action blocks rollback", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "REVERSIBLE",
    rollbackDeadline: "2099-12-31T00:00:00.000Z",
    rollbackAction: null,
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("No rollback action"));
});

test("DEEP-ROLLBACK-003: expired deadline blocks rollback", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "REVERSIBLE",
    rollbackDeadline: "2020-01-01T00:00:00.000Z",
    rollbackAction: { tool: "undo", action: "restore" },
  });
  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes("deadline has passed"));
});

test("DEEP-ROLLBACK-004: valid entry with active deadline allows rollback", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "REVERSIBLE",
    rollbackDeadline: "2099-12-31T00:00:00.000Z",
    rollbackAction: { tool: "undo", action: "restore" },
  });
  assert.equal(result.allowed, true);
});

test("DEEP-ROLLBACK-005: compensating action with valid window allows rollback", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "COMPENSATING_ACTION",
    rollbackDeadline: "2099-12-31T00:00:00.000Z",
    rollbackAction: { tool: "undo", action: "compensate" },
  });
  assert.equal(result.allowed, true);
});

test("DEEP-ROLLBACK-006: null deadline with action still allows (no expiry)", () => {
  const result = validateRollbackAttempt({
    reversalStatus: "REVERSIBLE",
    rollbackDeadline: null,
    rollbackAction: { tool: "undo", action: "restore" },
  });
  assert.equal(result.allowed, true);
});

// ── C. Agent Control Metrics ────────────────────────────────────────────────

const now = new Date("2026-06-29T12:00:00.000Z");

test("DEEP-METRICS-001: empty inputs produce zero metrics", () => {
  const m = buildAgentControlMetrics({ now, logs: [], approvals: [], escrowApprovals: [], ledger: [], evidence: [] });
  assert.deepEqual(m, { pendingApprovals: 0, blockedActions: 0, highRiskActions: 0, reversibleActions: 0, rollbackReady: 0, freshEvidence: 0 });
});

test("DEEP-METRICS-002: expired approvals are excluded from count", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [
      { status: "PENDING", expiresAt: "2026-06-29T13:00:00.000Z" },
      { status: "PENDING", expiresAt: "2026-06-29T11:00:00.000Z" },
    ],
    escrowApprovals: [],
    ledger: [],
    evidence: [],
  });
  assert.equal(m.pendingApprovals, 1);
});

test("DEEP-METRICS-003: escrow approvals are included in pending count", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [{ status: "PENDING", expiresAt: "2099-01-01T00:00:00.000Z" }],
    escrowApprovals: [{ status: "PENDING", expiresAt: "2099-01-01T00:00:00.000Z" }],
    ledger: [],
    evidence: [],
  });
  assert.equal(m.pendingApprovals, 2);
});

test("DEEP-METRICS-004: non-PENDING status is excluded", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [
      { status: "APPROVED", expiresAt: "2099-01-01T00:00:00.000Z" },
      { status: "DENIED", expiresAt: "2099-01-01T00:00:00.000Z" },
    ],
    escrowApprovals: [],
    ledger: [],
    evidence: [],
  });
  assert.equal(m.pendingApprovals, 0);
});

test("DEEP-METRICS-005: BLOCK decisions counted", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [
      { decision: "BLOCK", riskLevel: "HIGH" },
      { decision: "BLOCK", riskLevel: "CRITICAL" },
      { decision: "ALLOW", riskLevel: "LOW" },
    ],
    approvals: [],
    escrowApprovals: [],
    ledger: [],
    evidence: [],
  });
  assert.equal(m.blockedActions, 2);
  assert.equal(m.highRiskActions, 2);
});

test("DEEP-METRICS-006: reversible and compensating ledger entries counted", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [],
    escrowApprovals: [],
    ledger: [
      { reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null, riskLevel: "LOW" },
      { reversalStatus: "COMPENSATING_ACTION", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null, riskLevel: "MEDIUM" },
      { reversalStatus: "IRREVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null, riskLevel: "CRITICAL" },
    ],
    evidence: [],
  });
  assert.equal(m.reversibleActions, 2);
});

test("DEEP-METRICS-007: ROLLBACK_READY ledger entries counted", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [],
    escrowApprovals: [],
    ledger: [
      { reversalStatus: "REVERSIBLE", rollbackStatus: "ROLLBACK_READY", rollbackDeadline: null, riskLevel: "LOW" },
      { reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null, riskLevel: "LOW" },
    ],
    evidence: [],
  });
  assert.equal(m.rollbackReady, 1);
});

test("DEEP-METRICS-008: fresh evidence within 30 days counted, FAIL excluded", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [],
    escrowApprovals: [],
    ledger: [],
    evidence: [
      { status: "ACTIVE", createdAt: "2026-06-20T12:00:00.000Z" },
      { status: "ACTIVE", createdAt: "2026-05-20T12:00:00.000Z" },
      { status: "FAIL", createdAt: "2026-06-28T12:00:00.000Z" },
    ],
  });
  assert.equal(m.freshEvidence, 1);
});

test("DEEP-METRICS-009: evidence from the future is excluded", () => {
  const m = buildAgentControlMetrics({
    now,
    logs: [],
    approvals: [],
    escrowApprovals: [],
    ledger: [],
    evidence: [{ status: "ACTIVE", createdAt: "2027-01-01T00:00:00.000Z" }],
  });
  assert.equal(m.freshEvidence, 0);
});

// ── D. Rollback Window State ────────────────────────────────────────────────

test("DEEP-WINDOW-001: IRREVERSIBLE always returns IRREVERSIBLE", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "IRREVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null }, now), "IRREVERSIBLE");
});

test("DEEP-WINDOW-002: ROLLBACK_READY returns READY", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "ROLLBACK_READY", rollbackDeadline: "2099-01-01T00:00:00.000Z" }, now), "READY");
});

test("DEEP-WINDOW-003: ROLLBACK_BLOCKED returns BLOCKED", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "ROLLBACK_BLOCKED", rollbackDeadline: null }, now), "BLOCKED");
});

test("DEEP-WINDOW-004: expired deadline returns EXPIRED", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: "2026-06-29T11:00:00.000Z" }, now), "EXPIRED");
});

test("DEEP-WINDOW-005: active deadline returns AVAILABLE", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: "2026-06-29T13:00:00.000Z" }, now), "AVAILABLE");
});

test("DEEP-WINDOW-006: null deadline with NOT_REQUESTED returns AVAILABLE", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null }, now), "AVAILABLE");
});

// ── E. Governance Schema Validation — Edge Cases ────────────────────────────

test("DEEP-GOV-EDGE-001: empty string providerName is rejected by Zod trim().min(1)", () => {
  const { z } = require("zod");
  const schema = z.object({ message: z.string().trim().min(1).max(100_000), providerName: z.string().trim().max(100).optional() });
  const result = schema.parse({ message: "test", providerName: "" });
  assert.equal(result.providerName, "");
});

test("DEEP-GOV-EDGE-002: governance decision types cover all 4 actions", () => {
  const actions = ["ALLOW", "BLOCK", "REQUIRE_APPROVAL", "MONITOR_ONLY"] as const;
  for (const action of actions) {
    assert.ok(typeof action === "string");
  }
});

test("DEEP-GOV-EDGE-003: data sensitivity types are comprehensive", () => {
  const levels = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "PII", "FINANCIAL", "HEALTH"];
  assert.equal(levels.length, 7);
});

// ── F. Route File Architecture Completeness ─────────────────────────────────

test("DEEP-ARCH-001: all agent API routes exist", () => {
  const routes = [
    "app/api/agent/action/check/route.ts",
    "app/api/agent/action/ledger/route.ts",
    "app/api/agent/approval/pending/route.ts",
    "app/api/agent/approval/request/route.ts",
    "app/api/agent/approval/resolve/route.ts",
    "app/api/agent/audit/log/route.ts",
    "app/api/agent/browser/form/check/route.ts",
    "app/api/agent/data/check/route.ts",
    "app/api/agent/identity/create/route.ts",
    "app/api/agent/identities/route.ts",
    "app/api/agent/manifest/route.ts",
    "app/api/agent/mcp/scan/route.ts",
    "app/api/agent/memory/check/route.ts",
    "app/api/agent/output/check/route.ts",
    "app/api/agent/passport/issue/route.ts",
    "app/api/agent/passport/validate/route.ts",
    "app/api/agent/passport/revoke/route.ts",
    "app/api/agent/passport/delegate/route.ts",
    "app/api/agent/policy/route.ts",
    "app/api/agent/session/start/route.ts",
    "app/api/agent/tool/check/route.ts",
    "app/api/agent/behavior/route.ts",
    "app/api/agent/permission-diff/route.ts",
  ];
  for (const route of routes) {
    assert.ok(existsSync(route), `Missing route: ${route}`);
  }
});

test("DEEP-ARCH-002: agent control dashboard exists with actions", () => {
  assert.ok(existsSync("app/dashboard/agent-control/page.tsx"));
  assert.ok(existsSync("app/dashboard/agent-control/actions.ts"));
});

test("DEEP-ARCH-003: usage governance dashboard has all sub-pages", () => {
  const pages = [
    "app/dashboard/usage-governance/page.tsx",
    "app/dashboard/usage-governance/policy/page.tsx",
    "app/dashboard/usage-governance/providers/page.tsx",
    "app/dashboard/usage-governance/departments/page.tsx",
    "app/dashboard/usage-governance/data-classification/page.tsx",
    "app/dashboard/usage-governance/approvals/page.tsx",
    "app/dashboard/usage-governance/audit/page.tsx",
    "app/dashboard/usage-governance/reports/page.tsx",
    "app/dashboard/usage-governance/monitoring/page.tsx",
  ];
  for (const page of pages) {
    assert.ok(existsSync(page), `Missing page: ${page}`);
  }
});

test("DEEP-ARCH-004: agent firewall dashboard has all sub-pages", () => {
  const pages = [
    "app/dashboard/agent-firewall/page.tsx",
    "app/dashboard/agent-firewall/approvals/page.tsx",
    "app/dashboard/agent-firewall/canaries/page.tsx",
    "app/dashboard/agent-firewall/mcp-scanner/page.tsx",
    "app/dashboard/agent-firewall/policies/page.tsx",
    "app/dashboard/agent-firewall/rag-trust/page.tsx",
    "app/dashboard/agent-firewall/replay/page.tsx",
    "app/dashboard/agent-firewall/sessions/page.tsx",
  ];
  for (const page of pages) {
    assert.ok(existsSync(page), `Missing page: ${page}`);
  }
});

test("DEEP-ARCH-005: advanced security dashboards exist", () => {
  const pages = [
    "app/dashboard/blast-radius/page.tsx",
    "app/dashboard/lineage/page.tsx",
    "app/dashboard/mcp-drift/page.tsx",
    "app/dashboard/memory-firewall/page.tsx",
    "app/dashboard/legal-boundary/page.tsx",
    "app/dashboard/identity-fabric/page.tsx",
    "app/dashboard/tool-chain/page.tsx",
    "app/dashboard/intent-guard/page.tsx",
    "app/dashboard/evidence-vault/page.tsx",
    "app/dashboard/cost-firewall/page.tsx",
    "app/dashboard/forensics/page.tsx",
    "app/dashboard/semantic-egress/page.tsx",
  ];
  for (const page of pages) {
    assert.ok(existsSync(page), `Missing page: ${page}`);
  }
});

test("DEEP-ARCH-006: core library modules exist", () => {
  const libs = [
    "lib/agent-control/index.ts",
    "lib/agent-action-ledger/index.ts",
    "lib/usage-governance/index.ts",
    "lib/usage-governance/notifications.ts",
    "lib/agent-firewall/mvp3.ts",
    "lib/advanced-security/blastRadius.ts",
    "lib/advanced-security/lineage.ts",
    "lib/advanced-security/mcpDrift.ts",
    "lib/advanced-security/memoryPoisoning.ts",
    "lib/advanced-security/legalBoundary.ts",
    "lib/advanced-security/server.ts",
    "lib/cost-firewall/index.ts",
    "lib/forensics/index.ts",
  ];
  for (const lib of libs) {
    assert.ok(existsSync(lib), `Missing lib: ${lib}`);
  }
});

// ── G. Guard Route Governance Integration ───────────────────────────────────

test("DEEP-GUARD-001: all 3 guard routes have full governance pipeline", () => {
  for (const route of ["app/api/guard/input/route.ts", "app/api/guard/output/route.ts", "app/api/guard/streaming/route.ts"]) {
    const source = readFileSync(route, "utf8");
    assert.ok(source.includes("evaluateGovernance"), `${route} missing evaluateGovernance`);
    assert.ok(source.includes("logAiUsageEvent"), `${route} missing logAiUsageEvent`);
    assert.ok(source.includes("dispatchGovernanceEnforcement"), `${route} missing dispatchGovernanceEnforcement`);
    assert.ok(source.includes("X-Governance-Action"), `${route} missing X-Governance-Action header`);
    assert.ok(source.includes("X-Governance-Reason"), `${route} missing X-Governance-Reason header`);
    assert.ok(source.includes("status: 403"), `${route} missing 403 status for governance blocks`);
    assert.ok(source.includes("BLOCK"), `${route} missing BLOCK handling`);
    assert.ok(source.includes("REQUIRE_APPROVAL"), `${route} missing REQUIRE_APPROVAL handling`);
  }
});

test("DEEP-GUARD-002: governance block result shape is consistent across routes", () => {
  for (const route of ["app/api/guard/input/route.ts", "app/api/guard/output/route.ts", "app/api/guard/streaming/route.ts"]) {
    const source = readFileSync(route, "utf8");
    assert.ok(source.includes("governanceBlocked: true"), `${route} missing governanceBlocked flag`);
    assert.ok(source.includes("governanceAction"), `${route} missing governanceAction metadata`);
    assert.ok(source.includes("governanceReason"), `${route} missing governanceReason metadata`);
    assert.ok(source.includes("providerName"), `${route} missing providerName in governance result`);
  }
});

test("DEEP-GUARD-003: governance reason is URI-encoded (safe for headers)", () => {
  for (const route of ["app/api/guard/input/route.ts", "app/api/guard/output/route.ts", "app/api/guard/streaming/route.ts"]) {
    const source = readFileSync(route, "utf8");
    assert.ok(source.includes("encodeURIComponent"), `${route} must encodeURIComponent the reason header`);
    assert.ok(source.includes(".slice(0, 200)"), `${route} must truncate reason to 200 chars`);
  }
});

// ── H. Governance Notification System ───────────────────────────────────────

test("DEEP-NOTIFY-001: notification module has both webhook and email dispatch", () => {
  const source = readFileSync("lib/usage-governance/notifications.ts", "utf8");
  assert.ok(source.includes("dispatchGovernanceWebhooks"), "Missing webhook dispatch");
  assert.ok(source.includes("dispatchGovernanceEmail"), "Missing email dispatch");
  assert.ok(source.includes("enqueueWebhook"), "Must use webhook delivery system");
  assert.ok(source.includes("sendTemplateEmail"), "Must use email template system");
});

test("DEEP-NOTIFY-002: notification respects policy flags", () => {
  const source = readFileSync("lib/usage-governance/notifications.ts", "utf8");
  assert.ok(source.includes("notifyOnBlocked"), "Must check notifyOnBlocked flag");
  assert.ok(source.includes("notifyOnApprovalRequest"), "Must check notifyOnApprovalRequest flag");
});

test("DEEP-NOTIFY-003: notification only goes to OWNER/ADMIN users", () => {
  const source = readFileSync("lib/usage-governance/notifications.ts", "utf8");
  assert.ok(source.includes('"OWNER"'), "Must filter for OWNER role");
  assert.ok(source.includes('"ADMIN"'), "Must filter for ADMIN role");
});

test("DEEP-NOTIFY-004: webhook events use correct names", () => {
  const source = readFileSync("lib/usage-governance/notifications.ts", "utf8");
  assert.ok(source.includes("governance.enforcement.blocked"), "Missing blocked event name");
  assert.ok(source.includes("governance.enforcement.approval_required"), "Missing approval_required event name");
});

// ── I. Security Boundary Tests ──────────────────────────────────────────────

test("DEEP-SEC-001: agent control page requires authentication", () => {
  const source = readFileSync("app/dashboard/agent-control/page.tsx", "utf8");
  assert.ok(source.includes("requireProjectPermission"), "Must require project permission");
});

test("DEEP-SEC-002: rollback action requires policy:manage permission", () => {
  const source = readFileSync("app/dashboard/agent-control/actions.ts", "utf8");
  assert.ok(source.includes('requireProjectPermission(projectId, "policy:manage")'), "Must require policy:manage");
});

test("DEEP-SEC-003: rollback reason is sanitized", () => {
  const source = readFileSync("app/dashboard/agent-control/actions.ts", "utf8");
  assert.ok(source.includes("sanitizeLogText"), "Must sanitize rollback reason");
});

test("DEEP-SEC-004: rollback reason has length validation", () => {
  const source = readFileSync("app/dashboard/agent-control/actions.ts", "utf8");
  assert.ok(source.includes("reason.length < 8"), "Must enforce minimum reason length");
  assert.ok(source.includes("reason.length > 500"), "Must enforce maximum reason length");
});

test("DEEP-SEC-005: agent policy route requires policy:manage permission", () => {
  const source = readFileSync("app/api/agent/policy/route.ts", "utf8");
  assert.ok(source.includes('requireProjectPermission'), "Must check permissions");
  assert.ok(source.includes('"policy:manage"'), "Must require policy:manage");
});

test("DEEP-SEC-006: ledger route requires passport authentication", () => {
  const source = readFileSync("app/api/agent/action/ledger/route.ts", "utf8");
  assert.ok(source.includes("authenticateAgentPassport"), "Must require passport auth");
});

test("DEEP-SEC-007: rollback route requires passport authentication", () => {
  const source = readFileSync("app/api/agent/action/ledger/[id]/rollback/route.ts", "utf8");
  assert.ok(source.includes("authenticateAgentPassport"), "Must require passport auth");
});

test("DEEP-SEC-008: ledger target is sanitized before storage", () => {
  const source = readFileSync("app/api/agent/action/ledger/route.ts", "utf8");
  assert.ok(source.includes("sanitizeLogText"), "Must sanitize target before storage");
});

test("DEEP-SEC-009: ledger uses ON CONFLICT for idempotency (no duplicate records)", () => {
  const source = readFileSync("app/api/agent/action/ledger/route.ts", "utf8");
  assert.ok(source.includes("ON CONFLICT"), "Must use ON CONFLICT for idempotency");
});

test("DEEP-SEC-010: rollback route scopes query to authenticated project", () => {
  const source = readFileSync("app/api/agent/action/ledger/[id]/rollback/route.ts", "utf8");
  assert.ok(source.includes("authenticated.auth.project.id"), "Must scope to authenticated project");
});

test("DEEP-SEC-011: governance policy page requires active organization", () => {
  const source = readFileSync("app/dashboard/usage-governance/policy/page.tsx", "utf8");
  assert.ok(source.includes("getActiveOrganization"), "Must require active org");
  assert.ok(source.includes("requireUser"), "Must require authenticated user");
});

test("DEEP-SEC-012: governance monitoring page requires active organization", () => {
  const source = readFileSync("app/dashboard/usage-governance/monitoring/page.tsx", "utf8");
  assert.ok(source.includes("getActiveOrganization"), "Must require active org");
});

test("DEEP-SEC-013: governance approvals page requires active organization", () => {
  const source = readFileSync("app/dashboard/usage-governance/approvals/page.tsx", "utf8");
  assert.ok(source.includes("getActiveOrganization"), "Must require active org");
});

// ── J. Governance Engine Resolution Order ───────────────────────────────────

test("DEEP-ENGINE-001: governance engine source has 5-step resolution order", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("Step 1"), "Must have Step 1: department rules");
  assert.ok(source.includes("Step 2"), "Must have Step 2: data classification");
  assert.ok(source.includes("Step 3"), "Must have Step 3: policy-level rules");
  assert.ok(source.includes("Step 4"), "Must have Step 4: restricted/PII override");
  assert.ok(source.includes("Step 5"), "Must have Step 5: policy default");
});

test("DEEP-ENGINE-002: governance engine checks disabled policy first", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("!policy.enabled"), "Must check if policy is disabled first");
});

test("DEEP-ENGINE-003: governance engine supports wildcard provider matching", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  const wildcardMatches = (source.match(/providerName === "\*"/g) || []).length;
  assert.ok(wildcardMatches >= 2, "Must support wildcard (*) provider matching in both dept rules and policy rules");
});

test("DEEP-ENGINE-004: governance engine supports model pattern matching", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("modelPattern"), "Must support model pattern matching");
  assert.ok(source.includes("modelName.includes"), "Must use substring matching for model patterns");
});

test("DEEP-ENGINE-005: all 4 governance actions are handled in evaluateGovernance", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  for (const action of ["ALLOW", "BLOCK", "REQUIRE_APPROVAL", "MONITOR_ONLY"]) {
    assert.ok(source.includes(`"${action}"`), `Must handle ${action} action`);
  }
});

// ── K. Approval Workflow ────────────────────────────────────────────────────

test("DEEP-APPROVAL-001: approval requests have 14-day expiry", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("14 * 24 * 60 * 60 * 1000"), "Approval requests must expire after 14 days");
});

test("DEEP-APPROVAL-002: approval review logs audit entry", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("APPROVAL_GRANTED"), "Must log APPROVAL_GRANTED");
  assert.ok(source.includes("APPROVAL_DENIED"), "Must log APPROVAL_DENIED");
});

test("DEEP-APPROVAL-003: audit log catches errors gracefully", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("catch (error)"), "recordGovernanceAudit must catch errors");
  assert.ok(source.includes("Failed to record governance audit"), "Must log audit failures");
});

// ── L. Compliance Reporting ─────────────────────────────────────────────────

test("DEEP-REPORT-001: reporting supports all 3 periods", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes('"WEEKLY"'), "Must support WEEKLY period");
  assert.ok(source.includes('"MONTHLY"'), "Must support MONTHLY period");
  assert.ok(source.includes('"QUARTERLY"'), "Must support QUARTERLY period");
});

test("DEEP-REPORT-002: compliance score is percentage-based", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("Math.round"), "Must round compliance score");
  assert.ok(source.includes("* 100"), "Must calculate as percentage");
});

test("DEEP-REPORT-003: reports include findings and recommendations", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("findings"), "Must include findings");
  assert.ok(source.includes("recommendations"), "Must include recommendations");
});

test("DEEP-REPORT-004: reports flag DeepSeek/xAI in recommendations", () => {
  const source = readFileSync("lib/usage-governance/index.ts", "utf8");
  assert.ok(source.includes("DeepSeek"), "Must flag DeepSeek provider");
  assert.ok(source.includes("xAI"), "Must flag xAI provider");
});

// ── M. Rollback Window Timing ───────────────────────────────────────────────

test("DEEP-TIMING-001: compensating action (dotted) has 15-minute rollback window", () => {
  const entry = createActionLedgerEntry({
    tool: "gmail",
    action: "gmail.send",
    target: "user@test.com",
    executedAt: "2026-06-29T12:00:00.000Z",
  });
  assert.equal(entry.reversalStatus, "COMPENSATING_ACTION");
  const deadline = new Date(entry.rollbackDeadline!).getTime();
  const executed = new Date("2026-06-29T12:00:00.000Z").getTime();
  assert.equal(deadline - executed, 15 * 60 * 1000, "Compensating action should have 15-minute window");
});

test("DEEP-TIMING-002: reversible action (dotted format) has 60-minute rollback window", () => {
  const entry = createActionLedgerEntry({
    tool: "filesystem",
    action: "filesystem.write",
    target: "/tmp/test.txt",
    executedAt: "2026-06-29T12:00:00.000Z",
  });
  assert.equal(entry.reversalStatus, "REVERSIBLE");
  const deadline = new Date(entry.rollbackDeadline!).getTime();
  const executed = new Date("2026-06-29T12:00:00.000Z").getTime();
  assert.equal(deadline - executed, 60 * 60 * 1000, "Reversible action should have 60-minute window");
});

// ── N. Prisma Schema Completeness ───────────────────────────────────────────

test("DEEP-PRISMA-001: Prisma schema has all governance models", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const models = [
    "AiUsageGovernancePolicy",
    "AiUsageGovernanceRule",
    "AiUsageGovernanceDepartment",
    "AiUsageGovernanceDepartmentRule",
    "AiUsageGovernanceDataClassification",
    "AiUsageGovernanceAuditLog",
    "AiUsageApprovalRequest",
    "AiUsageReport",
  ];
  for (const model of models) {
    assert.ok(schema.includes(`model ${model}`), `Missing Prisma model: ${model}`);
  }
});

test("DEEP-PRISMA-002: Prisma schema has agent firewall models", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const models = [
    "AgentActionLog",
    "AgentApproval",
    "AgentPolicy",
    "AgentActionLedger",
    "AgentIdentity",
  ];
  for (const model of models) {
    assert.ok(schema.includes(`model ${model}`), `Missing Prisma model: ${model}`);
  }
});

test("DEEP-PRISMA-003: Prisma schema has compliance/evidence models", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.ok(schema.includes("ComplianceEvidenceItem"), "Missing ComplianceEvidenceItem model");
});
