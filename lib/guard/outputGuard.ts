import { analyzeText } from "./analyze";

export function runOutputGuard(aiResponse: string) {
  return analyzeText(aiResponse, "OUTPUT");
}
