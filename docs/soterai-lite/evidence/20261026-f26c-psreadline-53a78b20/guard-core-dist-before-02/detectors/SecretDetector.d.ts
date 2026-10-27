import type { DetectorResult } from "../types";
export declare const SECRET_DETECTOR_VERSION = "1.5.0";
/**
 * The keyword→value bridge shared by every keyword-anchored rule below.
 *
 * Credentials reach us in two shapes, and the rules used to see only one:
 *
 *   .env / shell   AGENTROUTER_TOKEN=<value>
 *   JSON / YAML    "AGENTROUTER_TOKEN": "<value>"
 *
 * The old bridge was `\b(?:token|…)\b\s*[:=]`, which is blind to both halves of
 * the JSON form. `\b` cannot match between `AGENTROUTER` and `TOKEN` because `_`
 * is a word character, so a keyword used as an identifier SUFFIX never matched;
 * and in JSON a closing quote sits between the key and the colon, so `\s*[:=]`
 * never reached it either.
 *
 * Measured before this change: `api_key=<48 chars>` was detected, while
 * `AGENTROUTER_TOKEN=<the same 48 chars>` and EVERY JSON form — including a
 * plain `{ "token": "<48 high-entropy chars>" }` — were missed entirely. That
 * gap is load-bearing, because every agent credential file on disk is JSON
 * (`.claude/settings.json`, `.cursor/mcp.json`, `.codex/auth.json`,
 * `.docker/config.json`).
 *
 * Widening the KEY side does not widen what is reported: the value side still
 * has to clear `isFalsePositive()` (placeholder allowlist, entropy, repeated
 * characters), which is where a documentation stub is actually suppressed.
 */
export declare const KEY_PREFIX: string;
/**
 * `= value`, `: value`, `": "value"`, `:value` — with optional quoting on both
 * sides. Deliberately a flat, bounded sequence with no nested quantifier: this
 * fragment is interpolated into rules that run over whole files, so it must not
 * be able to backtrack.
 */
export declare const ASSIGN: string;
/**
 * The keyword set and value shape for an UNKNOWN-VENDOR credential.
 *
 * Exported because `Redactor` must redact exactly what this detects. The two
 * are load-bearing on each other: `opaque_credential` is a high-risk class, and
 * `redactForSharing` hard-fails closed — it replaces the WHOLE message with a
 * placeholder when a high-risk class survives redaction. So a detector that can
 * find a shape the redactor cannot remove does not fail safe, it fails useless.
 */
export declare const OPAQUE_CREDENTIAL_KEYWORDS: string;
export declare const OPAQUE_CREDENTIAL_VALUE: string;
/**
 * A database connection string carrying an inline password.
 *
 * Shared with `Redactor` for the same reason as the shape above: it is a
 * high-risk class, so its redaction rule and its survivor check must move
 * together or `redactForSharing` starts scrubbing lines it cannot clean.
 *
 * The middle is `[^\n]{0,200}?` and not `[^;\n]*` because a connection string
 * has more than two fields. `[^;\n]*` cannot cross a semicolon, so the rule only
 * ever matched `Server=…;Password=…` — the shape in the test fixtures, and not
 * the shape anyone writes. Measured: every realistic form missed, including the
 * ADO.NET `Data Source=…;Initial Catalog=…;User ID=…;Password=…`, which meant a
 * live database password reached the model reported only as a generic
 * `password_assignment`, a class the hook does not block.
 *
 * Bounded and lazy, with no nested quantifier: this runs over whole files.
 */
export declare const CONNECTION_STRING_PASSWORD: string;
/**
 * Every class this detector can report, in declaration order.
 *
 * Exported so `secret-class-coverage.test.ts` can hold the block vocabulary to
 * account. A scan category that no consumer recognises is a credential the hook
 * silently allows, and that is invisible from inside either list on its own.
 */
export declare const SECRET_DETECTOR_CLASSES: readonly string[];
export declare function detectSecrets(text: string): DetectorResult;
//# sourceMappingURL=SecretDetector.d.ts.map