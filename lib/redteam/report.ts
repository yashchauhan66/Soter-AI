import type { AwaitedReturn } from "./types";

export function createRedTeamReport(run: AwaitedReturn) {
  return {
    title: "SoterAI authorized red-team report",
    scope: `Owned project ${run.projectId}`,
    defensiveOnly: true,
    summary: { passed: run.passed, failed: run.failed, total: run.results.length },
    findings: run.results.map((result) => ({ key: result.scenario.key, category: result.scenario.category, severity: result.scenario.severity, passed: result.passed, observedAction: result.observedAction, owaspMapping: result.scenario.owaspMapping, recommendedFix: result.recommendation })),
  };
}
