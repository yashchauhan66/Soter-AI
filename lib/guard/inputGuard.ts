import { analyzeText } from "./analyze";

export function runInputGuard(message: string) {
  return analyzeText(message, "INPUT");
}
