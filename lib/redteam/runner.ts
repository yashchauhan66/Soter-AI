import { analyzeText } from "../guard/analyze";
import { safeRedTeamScenarios, type RedTeamScenario } from "./scenarios";

export interface RedTeamResult { scenario: RedTeamScenario; passed: boolean; observedAction: string; riskTypes: string[]; recommendation: string }

export async function runRedTeamSuite(input: { projectId: string; authorizedProjectId: string; confirmed: boolean; scenarios?: RedTeamScenario[] }) {
  if (!input.confirmed) throw new Error("Explicit confirmation is required before running an authorized red-team suite.");
  if (!input.projectId || input.projectId !== input.authorizedProjectId) throw new Error("Red-team suites may run only against the user's authorized project.");
  const scenarios = input.scenarios ?? safeRedTeamScenarios;
  const results: RedTeamResult[] = scenarios.map((scenario) => {
    const observed = analyzeText(scenario.prompt, scenario.direction);
    const passed = scenario.expectedActions.includes(observed.action);
    return { scenario, passed, observedAction: observed.action, riskTypes: observed.riskTypes, recommendation: scenario.recommendedFix };
  });
  return { projectId: input.projectId, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length, results };
}
