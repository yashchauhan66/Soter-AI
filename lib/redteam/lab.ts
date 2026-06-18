// SECURITY: AI Red Team Lab — automated offensive security testing for AI applications.
// Runs non-destructive test prompts against a project's guard policies and reports results.
// All run data is stored with redacted prompts. Raw prompts are never logged.
//
// The lab uses safeRedTeamScenarios from ./scenarios.ts and extends them with
// automated execution, result analysis, and trend tracking.

import { randomUUID } from "crypto";
import { db } from "../db";
import { analyzeText } from "../guard/analyze";
import { applyPolicy } from "../guard/policy";
import { loadProjectPolicy } from "../guard/policy";
import { safeRedTeamScenarios, type RedTeamScenario } from "./scenarios";
import { sanitizeLogText } from "../guard/logSafety";

// ── Scenario management ───────────────────────────────────────────────────────

export interface LabScenario extends RedTeamScenario {
  id?: string;
  suiteId?: string;
  lastResult?: string | null;
  lastRunAt?: Date | null;
}

export async function getOrCreateSuite(organizationId: string, projectId: string): Promise<string> {
  const existing = await db.redTeamSuite.findFirst({
    where: { organizationId, projectId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.id;

  const suite = await db.redTeamSuite.create({
    data: {
      organizationId,
      projectId,
      name: "Default Red Team Suite",
      enabled: true,
      scenarios: {
        create: safeRedTeamScenarios.map((s) => ({
          key: s.key,
          category: s.category,
          severity: s.severity,
          promptTemplate: sanitizeLogText(s.prompt),
          expectedAction: s.expectedActions.join(","),
          owaspMapping: s.owaspMapping,
          enabled: true,
        })),
      },
    },
  });
  return suite.id;
}

export async function listLabScenarios(organizationId: string, projectId: string): Promise<LabScenario[]> {
  const suite = await db.redTeamSuite.findFirst({
    where: { organizationId, projectId },
    include: {
      scenarios: {
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
        include: {
          results: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!suite) return [];

  return suite.scenarios.map((s) => ({
    key: s.key,
    category: s.category as any,
    severity: s.severity as any,
    prompt: s.promptTemplate,
    direction: "INPUT" as const,
    expectedActions: s.expectedAction.split(","),
    recommendedFix: "",
    owaspMapping: s.owaspMapping,
    id: s.id,
    suiteId: suite.id,
    lastResult: s.results[0]?.observedAction ?? null,
    lastRunAt: s.results[0]?.createdAt ?? null,
  }));
}

// ── Run execution ─────────────────────────────────────────────────────────────

export interface RedTeamRunInput {
  organizationId: string;
  projectId: string;
  suiteId: string;
  confirmedByUserId: string;
  scenarioIds?: string[];
}

export interface RedTeamRunResult {
  runId: string;
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    scenarioKey: string;
    category: string;
    severity: string;
    passed: boolean;
    observedAction: string;
    riskTypes: string[];
    recommendation: string;
  }>;
}

export async function executeRedTeamRun(input: RedTeamRunInput): Promise<RedTeamRunResult> {
  const suite = await db.redTeamSuite.findUnique({
    where: { id: input.suiteId },
    include: {
      scenarios: {
        where: {
          enabled: true,
          ...(input.scenarioIds ? { id: { in: input.scenarioIds } } : {}),
        },
      },
    },
  });
  if (!suite) throw new Error("Suite not found.");

  const policy = await loadProjectPolicy(input.projectId);
  const runId = `redteam_run_${randomUUID()}`;

  const results: RedTeamRunResult["results"] = [];
  let passed = 0;
  let failed = 0;

  for (const scenario of suite.scenarios) {
    // Analyze the prompt against the guard
    const prompt = scenario.promptTemplate;
    const baseline = analyzeText(prompt, "INPUT");

    // Apply project policy
    const applied = applyPolicy(prompt, baseline, policy, "INPUT");

    // Check if the observed action matches expected
    const expectedActions = scenario.expectedAction.split(",").map((s) => s.trim());
    const observedAction = applied.action;

    // Custom check for system prompt leak variations
    const scenarioPassed = expectedActions.some(
      (expected) =>
        observedAction === expected ||
        (expected === "BLOCK" && (observedAction === "BLOCK" || observedAction === "HUMAN_REVIEW")) ||
        (expected === "REWRITE" && (observedAction === "REWRITE" || observedAction === "ALLOW_WITH_REDACTION")),
    );

    if (scenarioPassed) passed++;
    else failed++;

    const result = {
      scenarioKey: scenario.key,
      category: scenario.category,
      severity: scenario.severity,
      passed: scenarioPassed,
      observedAction,
      riskTypes: applied.riskTypes,
      recommendation: scenarioPassed
        ? "Test passed. No changes needed."
        : `Expected ${expectedActions.join(" or ")} but got ${observedAction}. Review policy configuration.`,
    };
    results.push(result);
  }

  // Persist the run
  await db.redTeamRun.create({
    data: {
      id: runId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      suiteId: input.suiteId,
      confirmedByUserId: input.confirmedByUserId,
      status: "COMPLETED",
      passed,
      failed,
      completedAt: new Date(),
      results: {
        create: results.map((r) => ({
          scenarioId: suite.scenarios.find((s) => s.key === r.scenarioKey)!.id,
          passed: r.passed,
          observedAction: r.observedAction,
          riskTypes: r.riskTypes,
          recommendation: r.recommendation,
        })),
      },
    },
  });

  return { runId, total: results.length, passed, failed, results };
}

// ── Trend analysis ────────────────────────────────────────────────────────────

export interface RedTeamTrend {
  totalRuns: number;
  averagePassRate: number;
  trend: "improving" | "stable" | "declining";
  recentRuns: Array<{
    runId: string;
    startedAt: Date;
    passed: number;
    failed: number;
    passRate: number;
  }>;
  weakestCategories: Array<{
    category: string;
    passRate: number;
    totalTests: number;
  }>;
}

export async function getRedTeamTrends(organizationId: string, projectId: string): Promise<RedTeamTrend> {
  const runs = await db.redTeamRun.findMany({
    where: { organizationId, projectId, status: "COMPLETED" },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      results: {
        include: { scenario: { select: { category: true } } },
      },
    },
  });

  if (runs.length === 0) {
    return {
      totalRuns: 0,
      averagePassRate: 0,
      trend: "stable",
      recentRuns: [],
      weakestCategories: [],
    };
  }

  const recentRuns = runs.slice(0, 5).map((r) => ({
    runId: r.id,
    startedAt: r.startedAt,
    passed: r.passed,
    failed: r.failed,
    passRate: r.passed + r.failed > 0 ? r.passed / (r.passed + r.failed) : 0,
  }));

  const totalTests = runs.reduce((sum, r) => sum + r.passed + r.failed, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.passed, 0);
  const averagePassRate = totalTests > 0 ? totalPassed / totalTests : 0;

  // Determine trend by comparing recent vs older runs
  const recentPassRate = recentRuns.length > 0
    ? recentRuns.reduce((sum, r) => sum + r.passRate, 0) / recentRuns.length
    : 0;
  const olderRuns = runs.slice(5);
  const olderPassRate = olderRuns.length > 0
    ? olderRuns.reduce((sum, r) => sum + (r.passed / (r.passed + r.failed || 1)), 0) / olderRuns.length
    : recentPassRate;

  let trend: "improving" | "stable" | "declining";
  const diff = recentPassRate - olderPassRate;
  if (diff > 0.05) trend = "improving";
  else if (diff < -0.05) trend = "declining";
  else trend = "stable";

  // Weakest categories
  const categoryStats = new Map<string, { passed: number; total: number }>();
  for (const run of runs) {
    for (const result of run.results) {
      const cat = result.scenario.category;
      const stat = categoryStats.get(cat) ?? { passed: 0, total: 0 };
      stat.total++;
      if (result.passed) stat.passed++;
      categoryStats.set(cat, stat);
    }
  }

  const weakestCategories: RedTeamTrend["weakestCategories"] = Array.from(categoryStats.entries())
    .map(([category, stats]) => ({
      category,
      passRate: stats.total > 0 ? stats.passed / stats.total : 0,
      totalTests: stats.total,
    }))
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 5);

  return {
    totalRuns: runs.length,
    averagePassRate,
    trend,
    recentRuns,
    weakestCategories,
  };
}

// ── Dashboard queries ─────────────────────────────────────────────────────────

export async function getRedTeamSummary(organizationId: string, projectId: string) {
  const [latestRun, suite, trends] = await Promise.all([
    db.redTeamRun.findFirst({
      where: { organizationId, projectId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    }),
    db.redTeamSuite.findFirst({
      where: { organizationId, projectId },
      include: { _count: { select: { scenarios: true } } },
    }),
    getRedTeamTrends(organizationId, projectId),
  ]);
  return { latestRun, suite, trends };
}
