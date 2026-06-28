import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentControlMetrics, rollbackWindowState } from "../lib/agent-control";

const now = new Date("2026-06-28T12:00:00.000Z");

test("control metrics exclude expired approval requests", () => {
  const metrics = buildAgentControlMetrics({
    now,
    logs: [
      { decision: "BLOCK", riskLevel: "CRITICAL" },
      { decision: "ALLOW", riskLevel: "LOW" },
    ],
    approvals: [
      { status: "PENDING", expiresAt: "2026-06-28T13:00:00.000Z" },
      { status: "PENDING", expiresAt: "2026-06-28T11:00:00.000Z" },
    ],
    escrowApprovals: [{ status: "PENDING", expiresAt: "2026-06-28T14:00:00.000Z" }],
    ledger: [
      { reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: "2026-06-28T13:00:00.000Z", riskLevel: "MEDIUM" },
      { reversalStatus: "COMPENSATING_ACTION", rollbackStatus: "ROLLBACK_READY", rollbackDeadline: "2026-06-28T13:00:00.000Z", riskLevel: "HIGH" },
    ],
    evidence: [{ status: "ACTIVE", createdAt: "2026-06-20T12:00:00.000Z" }],
  });

  assert.deepEqual(metrics, {
    pendingApprovals: 2,
    blockedActions: 1,
    highRiskActions: 1,
    reversibleActions: 2,
    rollbackReady: 1,
    freshEvidence: 1,
  });
});

test("rollback state never presents an irreversible action as available", () => {
  assert.equal(rollbackWindowState({ reversalStatus: "IRREVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: null }, now), "IRREVERSIBLE");
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: "2026-06-28T11:00:00.000Z" }, now), "EXPIRED");
  assert.equal(rollbackWindowState({ reversalStatus: "REVERSIBLE", rollbackStatus: "NOT_REQUESTED", rollbackDeadline: "2026-06-28T13:00:00.000Z" }, now), "AVAILABLE");
});
