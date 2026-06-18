// SECURITY: AI Cost Firewall — budget management, cost tracking, anomaly detection,
// and automatic throttling for AI API usage.
//
// Uses existing CostBudget, UsageAnomaly, and ThrottleEvent models with enhanced
// logic for detecting cost spikes and enforcing hard/soft budget limits.

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "../db";

// ── Budget thresholds ─────────────────────────────────────────────────────────

export const DEFAULT_ALERT_THRESHOLD = 0.8; // 80%
export const CRITICAL_SPIKE_MULTIPLIER = 3.0; // 3x normal = critical
export const WARNING_SPIKE_MULTIPLIER = 1.5; // 1.5x normal = warning
export const ANOMALY_WINDOW_HOURS = 24;
export const ANOMALY_BASELINE_DAYS = 7;

// ── Budget management ─────────────────────────────────────────────────────────

export interface BudgetInput {
  organizationId: string;
  projectId?: string;
  monthlyLimitPaise: number;
  hardStop?: boolean;
  alertThreshold?: number;
}

export interface BudgetResult {
  id: string;
  projectId: string | null;
  monthlyLimitPaise: number;
  usedPaise: number;
  remainingPaise: number;
  usagePercent: number;
  hardStop: boolean;
  alertThreshold: number;
  exceeded: boolean;
  warning: boolean;
}

export async function setBudget(input: BudgetInput): Promise<BudgetResult> {
  const budget = await db.costBudget.upsert({
    where: {
      organizationId_projectId: {
        organizationId: input.organizationId,
        projectId: input.projectId ?? "__org__",
      },
    },
    create: {
      id: `budget_${randomUUID()}`,
      organizationId: input.organizationId,
      projectId: input.projectId,
      monthlyLimitPaise: input.monthlyLimitPaise,
      hardStop: input.hardStop ?? true,
      alertThreshold: input.alertThreshold ?? DEFAULT_ALERT_THRESHOLD,
    },
    update: {
      monthlyLimitPaise: input.monthlyLimitPaise,
      hardStop: input.hardStop ?? true,
      alertThreshold: input.alertThreshold ?? DEFAULT_ALERT_THRESHOLD,
    },
  });
  return computeBudgetResult(budget);
}

export async function getBudget(organizationId: string, projectId?: string): Promise<BudgetResult | null> {
  const budget = await db.costBudget.findUnique({
    where: {
      organizationId_projectId: {
        organizationId,
        projectId: projectId ?? "__org__",
      },
    },
  });
  if (!budget) return null;
  return computeBudgetResult(budget);
}

export async function listBudgets(organizationId: string): Promise<BudgetResult[]> {
  const budgets = await db.costBudget.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
  return Promise.all(budgets.map(computeBudgetResult));
}

async function computeBudgetResult(budget: { id: string; projectId: string | null; monthlyLimitPaise: number; usedPaise: number; hardStop: boolean; alertThreshold: number }): Promise<BudgetResult> {
  const usedPaise = await computeActualUsage(budget.id);
  const remainingPaise = Math.max(0, budget.monthlyLimitPaise - usedPaise);
  const usagePercent = budget.monthlyLimitPaise > 0 ? usedPaise / budget.monthlyLimitPaise : 0;
  return {
    id: budget.id,
    projectId: budget.projectId === "__org__" ? null : budget.projectId,
    monthlyLimitPaise: budget.monthlyLimitPaise,
    usedPaise,
    remainingPaise,
    usagePercent: Math.round(usagePercent * 10000) / 100,
    hardStop: budget.hardStop,
    alertThreshold: budget.alertThreshold,
    exceeded: usedPaise >= budget.monthlyLimitPaise,
    warning: usagePercent >= budget.alertThreshold && usedPaise < budget.monthlyLimitPaise,
  };
}

async function computeActualUsage(budgetId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const transactions = await db.costTransaction.aggregate({
    where: {
      budgetId,
      recordedAt: { gte: monthStart },
    },
    _sum: { amountPaise: true },
  });
  return transactions._sum.amountPaise ?? 0;
}

// ── Cost tracking ─────────────────────────────────────────────────────────────

export interface CostTransactionInput {
  organizationId: string;
  projectId?: string;
  amountPaise: number;
  currency?: string;
  category?: string;
  description?: string;
  providerName?: string;
  modelName?: string;
  metadata?: Record<string, unknown>;
}

export async function recordCostTransaction(input: CostTransactionInput): Promise<{
  accepted: boolean;
  budgetExceeded: boolean;
  warning: boolean;
  transactionId?: string;
  throttleAction?: string;
}> {
  // Check budgets
  const orgBudget = await getBudget(input.organizationId);
  const projectBudget = input.projectId ? await getBudget(input.organizationId, input.projectId) : null;
  const budget = projectBudget ?? orgBudget;

  if (budget?.exceeded && budget.hardStop) {
    // Record the attempt as a zero-cost transaction for audit
    await db.costTransaction.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        amountPaise: 0,
        currency: input.currency ?? "INR",
        category: input.category ?? "BLOCKED_BUDGET_EXCEEDED",
        description: `Blocked: budget exceeded. ${input.description ?? ""}`,
        providerName: input.providerName,
        modelName: input.modelName,
        metadata: { ...input.metadata, reason: "budget_exceeded", budgetId: budget.id } as Prisma.InputJsonValue,
      },
    });

    return {
      accepted: false,
      budgetExceeded: true,
      warning: false,
      throttleAction: "HARD_STOP",
    };
  }

  const transactionId = `cost_txn_${randomUUID()}`;
  let budgetId: string | undefined;
  if (budget) budgetId = budget.id;

  await db.costTransaction.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      amountPaise: input.amountPaise,
      currency: input.currency ?? "INR",
      category: input.category ?? "API_CALL",
      description: input.description,
      providerName: input.providerName,
      modelName: input.modelName,
      metadata: { ...input.metadata, budgetId } as Prisma.InputJsonValue,
      recordedAt: new Date(),
    },
  });

  const anomaly = await detectAnomaly(input.organizationId, input.projectId);
  if (anomaly.spike) {
    await db.usageAnomaly.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        metric: "cost_spike",
        baseline: anomaly.baseline,
        observed: anomaly.observed,
        severity: anomaly.severity,
        metadata: { transactionId, providerName: input.providerName, modelName: input.modelName } as Prisma.InputJsonValue,
      },
    });

    if (anomaly.severity === "CRITICAL") {
      await db.throttleEvent.create({
        data: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          reason: `Critical cost spike detected: ${anomaly.observed} vs baseline ${anomaly.baseline}`,
          mode: "AUTO_THROTTLE",
          expiresAt: new Date(Date.now() + 3600_000), // 1 hour throttle
          metadata: { transactionId } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return {
    accepted: true,
    budgetExceeded: false,
    warning: budget?.warning ?? false,
    transactionId,
    throttleAction: anomaly.severity === "CRITICAL" ? "THROTTLED" : undefined,
  };
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

export function detectUsageSpike(data: Array<{ timestamp: Date; count: number }>): {
  spike: boolean;
  baseline: number;
  observed: number;
  severity: string;
} {
  if (data.length < 3) return { spike: false, baseline: 0, observed: 0, severity: "NONE" };

  const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const latest = sorted[sorted.length - 1];
  const earlier = sorted.slice(0, -1);

  const avgCount = earlier.reduce((sum, d) => sum + d.count, 0) / earlier.length;
  if (avgCount === 0) {
    return latest.count > 0
      ? { spike: true, baseline: 0, observed: latest.count, severity: "HIGH" }
      : { spike: false, baseline: 0, observed: 0, severity: "NONE" };
  }

  const ratio = latest.count / avgCount;
  if (ratio >= CRITICAL_SPIKE_MULTIPLIER) {
    return { spike: true, baseline: Math.round(avgCount), observed: latest.count, severity: "CRITICAL" };
  }
  if (ratio >= WARNING_SPIKE_MULTIPLIER) {
    return { spike: true, baseline: Math.round(avgCount), observed: latest.count, severity: "WARNING" };
  }

  return { spike: false, baseline: Math.round(avgCount), observed: latest.count, severity: "NONE" };
}

export async function detectAnomaly(organizationId: string, projectId?: string): Promise<{
  spike: boolean;
  baseline: number;
  observed: number;
  severity: string;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ANOMALY_WINDOW_HOURS * 3600_000);
  const baselineStart = new Date(now.getTime() - ANOMALY_BASELINE_DAYS * 86400_000);

  const where = { organizationId, projectId: projectId ?? undefined };
  const [recentCount, baselineTransactions] = await Promise.all([
    db.costTransaction.count({
      where: { ...where, recordedAt: { gte: windowStart } },
    }),
    db.costTransaction.findMany({
      where: { ...where, recordedAt: { gte: baselineStart, lt: windowStart } },
      select: { recordedAt: true, amountPaise: true },
    }),
  ]);

  // Group baseline by day
  const dayBuckets = new Map<string, { count: number; total: number }>();
  for (const txn of baselineTransactions) {
    const day = txn.recordedAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(day) ?? { count: 0, total: 0 };
    bucket.count++;
    bucket.total += txn.amountPaise;
    dayBuckets.set(day, bucket);
  }

  const dailyData = Array.from(dayBuckets.entries()).map(([day, data]) => ({
    timestamp: new Date(day),
    count: data.count,
    totalPaise: data.total,
  }));

  if (dailyData.length === 0 && recentCount > 0) {
    return { spike: true, baseline: 0, observed: recentCount, severity: "HIGH" };
  }

  const avgDailyCount = dailyData.length > 0
    ? dailyData.reduce((sum, d) => sum + d.count, 0) / dailyData.length
    : 0;

  if (avgDailyCount === 0) {
    return recentCount > 0
      ? { spike: true, baseline: 0, observed: recentCount, severity: "HIGH" }
      : { spike: false, baseline: 0, observed: 0, severity: "NONE" };
  }

  // Project to hourly rate
  const hourlyRate = avgDailyCount / ANOMALY_WINDOW_HOURS * (ANOMALY_WINDOW_HOURS / 24);
  const ratio = hourlyRate > 0 ? recentCount / hourlyRate : recentCount;

  if (ratio >= CRITICAL_SPIKE_MULTIPLIER) {
    return { spike: true, baseline: Math.round(hourlyRate), observed: recentCount, severity: "CRITICAL" };
  }
  if (ratio >= WARNING_SPIKE_MULTIPLIER) {
    return { spike: true, baseline: Math.round(hourlyRate), observed: recentCount, severity: "WARNING" };
  }

  return { spike: false, baseline: Math.round(hourlyRate), observed: recentCount, severity: "NONE" };
}

// ── Cost summary ──────────────────────────────────────────────────────────────

export async function getCostSummary(organizationId: string, projectId?: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const where = { organizationId, projectId: projectId ?? undefined, recordedAt: { gte: monthStart } };

  const [transactions, byProvider, byModel, byCategory] = await Promise.all([
    db.costTransaction.aggregate({
      where,
      _sum: { amountPaise: true },
      _count: true,
    }),
    db.costTransaction.groupBy({
      by: ["providerName"],
      where,
      _sum: { amountPaise: true },
      _count: true,
      orderBy: { _sum: { amountPaise: "desc" } },
    }),
    db.costTransaction.groupBy({
      by: ["modelName"],
      where: { ...where, modelName: { not: null } },
      _sum: { amountPaise: true },
      _count: true,
      orderBy: { _sum: { amountPaise: "desc" } },
    }),
    db.costTransaction.groupBy({
      by: ["category"],
      where,
      _sum: { amountPaise: true },
      _count: true,
      orderBy: { _sum: { amountPaise: "desc" } },
    }),
  ]);

  return {
    totalPaise: transactions._sum.amountPaise ?? 0,
    totalTransactions: transactions._count,
    byProvider: byProvider.map((p) => ({
      name: p.providerName ?? "unknown",
      totalPaise: p._sum.amountPaise ?? 0,
      count: p._count,
    })),
    byModel: byModel.map((m) => ({
      name: m.modelName ?? "unknown",
      totalPaise: m._sum.amountPaise ?? 0,
      count: m._count,
    })),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      totalPaise: c._sum.amountPaise ?? 0,
      count: c._count,
    })),
  };
}

// ── Cost estimation ───────────────────────────────────────────────────────────

export interface CostModelRate {
  provider: string;
  model: string;
  inputPer1K: number; // paise per 1K input tokens
  outputPer1K: number; // paise per 1K output tokens
}

export const KNOWN_MODEL_RATES: CostModelRate[] = [
  { provider: "OpenAI", model: "gpt-4o", inputPer1K: 250, outputPer1K: 1000 },
  { provider: "OpenAI", model: "gpt-4o-mini", inputPer1K: 15, outputPer1K: 60 },
  { provider: "OpenAI", model: "gpt-3.5-turbo", inputPer1K: 50, outputPer1K: 150 },
  { provider: "OpenAI", model: "o1", inputPer1K: 1500, outputPer1K: 6000 },
  { provider: "OpenAI", model: "o1-mini", inputPer1K: 300, outputPer1K: 1200 },
  { provider: "Anthropic", model: "claude-3.5-sonnet", inputPer1K: 300, outputPer1K: 1500 },
  { provider: "Anthropic", model: "claude-3-haiku", inputPer1K: 25, outputPer1K: 125 },
  { provider: "Anthropic", model: "claude-opus", inputPer1K: 1500, outputPer1K: 7500 },
  { provider: "Google", model: "gemini-1.5-pro", inputPer1K: 125, outputPer1K: 500 },
  { provider: "Google", model: "gemini-1.5-flash", inputPer1K: 7, outputPer1K: 30 },
  { provider: "Mistral", model: "mistral-large", inputPer1K: 200, outputPer1K: 600 },
];

export function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const rate = KNOWN_MODEL_RATES.find(
    (r) => r.provider.toLowerCase() === provider.toLowerCase() && model.toLowerCase().includes(r.model.toLowerCase()),
  );
  if (!rate) return 0;
  return Math.ceil((inputTokens / 1000) * rate.inputPer1K + (outputTokens / 1000) * rate.outputPer1K);
}
