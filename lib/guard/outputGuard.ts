import { analyzeText } from "./analyze";
import type { DecisionContext } from "./decisionEngine";

/**
 * Output text is the model's own, so the default provenance (USER) is wrong in
 * spirit but harmless in effect: MODEL_OUTPUT only escalates instruction-bearing
 * signals, and the OUTPUT direction already gives those the stronger `outputFloor`.
 * Callers that relay a third party's text through this path should say so.
 */
export function runOutputGuard(aiResponse: string, context?: DecisionContext) {
  return analyzeText(aiResponse, "OUTPUT", context);
}
