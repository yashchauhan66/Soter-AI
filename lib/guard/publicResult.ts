import type { GuardResult } from "./types";

export function toPublicGuardResult(result: GuardResult): GuardResult {
  const { originalText: _originalText, ...publicResult } = result;
  return publicResult;
}
