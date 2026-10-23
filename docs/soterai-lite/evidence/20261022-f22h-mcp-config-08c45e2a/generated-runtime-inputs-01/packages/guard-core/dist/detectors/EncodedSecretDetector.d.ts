import type { DetectorResult } from "../types";
/**
 * EncodedSecretDetector — catches a secret that has been ENCODED to slip past a
 * byte-pattern scanner.
 *
 * The gap this closes, measured by the Leak Range harness: a real key blocks,
 * but `base64(key)` or `hex(key)` did not — the encoded form is not the key's
 * byte pattern, so no vendor rule matched, and the credential reached the model.
 * An agent (or a user pasting from a tool) hits this constantly:
 * `echo $OPENAI_API_KEY | base64`, a token embedded in a data URI, a value
 * stored base64 in a config.
 *
 * How it stays honest and low-false-positive: it does not guess. It finds
 * candidate encoded runs, DECODES them, and re-runs the REAL secret detector on
 * the decoded bytes. It fires only when a decoded blob actually contains a
 * credential the detector recognises. Random base64 — a lockfile integrity
 * hash, a data-URI image, a JWT body — decodes to bytes that match no secret
 * rule, so it stays clean. The decision is delegated to the same detector that
 * guards the plaintext path, so the two can never disagree about what a secret is.
 *
 * The emitted match spans the ENCODED text in the original input, so redaction
 * blanks the blob (not the decoded secret) and the redaction invariant holds:
 * the plaintext secret never enters the redacted copy.
 */
export declare const ENCODED_SECRET_DETECTOR_VERSION = "1.0.0";
/**
 * Find encoded credentials. For each decodable run, re-scan the decoded text
 * with the real SecretDetector; emit a match over the ENCODED span when the
 * decode contains a recognised secret.
 */
export declare function detectEncodedSecrets(text: string): DetectorResult;
//# sourceMappingURL=EncodedSecretDetector.d.ts.map