export type ControlActionLog = {
  decision: string;
  riskLevel: string;
};

export type ControlApproval = {
  status: string;
  expiresAt: Date | string;
};

export type ControlLedgerEntry = {
  reversalStatus: string;
  rollbackStatus: string;
  rollbackDeadline: Date | string | null;
  riskLevel: string;
};

export type ControlEvidence = {
  status: string;
  createdAt: Date | string;
};

export function buildAgentControlMetrics(input: {
  logs: ControlActionLog[];
  approvals: ControlApproval[];
  escrowApprovals: ControlApproval[];
  ledger: ControlLedgerEntry[];
  evidence: ControlEvidence[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const pendingApprovals = [...input.approvals, ...input.escrowApprovals]
    .filter((item) => item.status === "PENDING" && new Date(item.expiresAt).getTime() >= now.getTime()).length;
  const blockedActions = input.logs.filter((item) => item.decision === "BLOCK").length;
  const highRiskActions = input.logs.filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL").length;
  const reversibleActions = input.ledger.filter((item) => item.reversalStatus === "REVERSIBLE" || item.reversalStatus === "COMPENSATING_ACTION").length;
  const rollbackReady = input.ledger.filter((item) => item.rollbackStatus === "ROLLBACK_READY").length;
  const freshEvidence = input.evidence.filter((item) => {
    const age = now.getTime() - new Date(item.createdAt).getTime();
    return age >= 0 && age <= 30 * 86_400_000 && item.status !== "FAIL";
  }).length;

  return {
    pendingApprovals,
    blockedActions,
    highRiskActions,
    reversibleActions,
    rollbackReady,
    freshEvidence,
  };
}

export function rollbackWindowState(entry: Pick<ControlLedgerEntry, "reversalStatus" | "rollbackStatus" | "rollbackDeadline">, now = new Date()) {
  if (entry.reversalStatus === "IRREVERSIBLE") return "IRREVERSIBLE" as const;
  if (entry.rollbackStatus === "ROLLBACK_READY") return "READY" as const;
  if (entry.rollbackStatus === "ROLLBACK_BLOCKED") return "BLOCKED" as const;
  if (entry.rollbackDeadline && new Date(entry.rollbackDeadline).getTime() < now.getTime()) return "EXPIRED" as const;
  return "AVAILABLE" as const;
}
