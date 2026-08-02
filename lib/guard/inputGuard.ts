import { analyzeText } from "./analyze";
import type { DecisionContext } from "./decisionEngine";

/**
 * `context` is optional and defaults to first-party (USER) provenance. Pass it when
 * the message did not come from the operator typing — a retrieved document, a tool
 * result, an MCP tool description, a replayed memory entry — so an instruction found
 * inside it is held rather than rewritten.
 */
export function runInputGuard(message: string, context?: DecisionContext) {
  return analyzeText(message, "INPUT", context);
}
