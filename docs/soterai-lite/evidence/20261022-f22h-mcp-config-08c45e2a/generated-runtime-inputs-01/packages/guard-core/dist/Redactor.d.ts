import type { DetectorMatch } from "./types";
/**
 * The names a consumer may block on: every survivor-verified class above, plus
 * the detector-reported credential classes that are redacted under a different
 * name. `scanBrokerRequest` reports these as scan categories and consumers key
 * their block/allow policy on them — see `HIGH_RISK_SECRET_CLASSES` in
 * @soterai/ide-protocol, which mirrors this list for dependency-free consumers
 * and is pinned to it by a test in the broker.
 *
 * This is a SUPERSET of the survivor patterns, not a mirror of them. Every
 * class the secret detector can report is either in here or carries a written
 * reason for being unblockable — pinned by `secret-class-coverage.test.ts`, so
 * a new detector cannot be added without deciding which.
 */
export declare const HIGH_RISK_SECRET_CLASS_NAMES: readonly string[];
/**
 * Redact sensitive content. Detector findings (when supplied) are masked by
 * position first, then a pattern safety-net pass ALWAYS runs so undetected
 * secrets are still removed. The result is guaranteed free of the high-risk
 * secret classes in {@link HIGH_RISK_SECRET_PATTERNS}.
 */
export declare function redactText(text: string, findings?: DetectorMatch[]): string;
/**
 * Returns the list of high-risk secret classes that still appear in `text`.
 * Used by DecisionEngine and tests to assert redaction actually worked.
 */
export declare function findSurvivingSecrets(text: string): string[];
/** True if any high-risk secret pattern survives in `text`. */
export declare function containsRawSecret(text: string): boolean;
/**
 * Guaranteed-safe redaction for content leaving the machine (clipboard, AI
 * prompt, remote escalation). Runs the full safety net and hard-fails closed:
 * if any secret still survives, returns a fully scrubbed placeholder rather
 * than risk leaking raw material.
 */
export declare function redactForSharing(text: string, findings?: DetectorMatch[]): string;
export declare function redactMatch(match: string, type: string): string;
//# sourceMappingURL=Redactor.d.ts.map