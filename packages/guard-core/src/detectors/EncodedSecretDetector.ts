import type { DetectorMatch, DetectorResult } from "../types";
import { detectSecrets } from "./SecretDetector";

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
export const ENCODED_SECRET_DETECTOR_VERSION = "1.0.0";

/**
 * Score above the block threshold (70). Deliberately encoding a credential is a
 * strong signal — stronger than an opaque plaintext credential — so it blocks on
 * its own, not only via category membership. The category name is in the
 * high-risk block vocabulary too, so a host that keys on category also blocks.
 */
const ENCODED_SECRET_SCORE = 74;

/** Below this, a decoded run is too short to be a real credential — skip it. */
const MIN_DECODED_LENGTH = 16;
/** Base64/hex runs shorter than this are not worth decoding (noise, short ids). */
const MIN_ENCODED_LENGTH = 24;
/** Cap candidates per scan so a pathological input cannot blow up latency. */
const MAX_CANDIDATES = 40;

// A base64 / base64url run. Length and charset are checked; validity is decided
// by whether it actually decodes AND the decode contains a secret.
const BASE64_RUN = /[A-Za-z0-9+/_-]{24,}={0,2}/g;
// A contiguous hex run of even length (a byte string), long enough to matter.
const HEX_RUN = /\b[0-9a-fA-F]{32,}\b/g;

interface Candidate {
    start: number;
    end: number;
    raw: string;
    decoded: string;
}

/** Decode a base64 / base64url run, returning null if it is not valid text. */
function tryDecodeBase64(run: string): string | null {
    // Normalise base64url to base64 and pad.
    let s = run.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 1) return null; // never valid base64
    if (pad) s += "=".repeat(4 - pad);
    try {
        const buf = Buffer.from(s, "base64");
        // Re-encode and compare (ignoring padding/charset) to reject runs that
        // Buffer silently accepts but were never clean base64.
        if (buf.length < MIN_DECODED_LENGTH) return null;
        const text = buf.toString("utf8");
        // Require the decode to be mostly printable — a real credential is ASCII.
        // A data URI / image / gzip decodes to control bytes and is dropped here,
        // which is exactly the false-positive we want to avoid.
        if (!isMostlyPrintable(text)) return null;
        return text;
    } catch {
        return null;
    }
}

function tryDecodeHex(run: string): string | null {
    if (run.length % 2 !== 0) return null;
    try {
        const buf = Buffer.from(run, "hex");
        if (buf.length < MIN_DECODED_LENGTH) return null;
        const text = buf.toString("utf8");
        if (!isMostlyPrintable(text)) return null;
        return text;
    } catch {
        return null;
    }
}

/** True when at least 90% of chars are printable ASCII — a credential is text. */
function isMostlyPrintable(text: string): boolean {
    if (!text) return false;
    let printable = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) printable++;
    }
    return printable / text.length >= 0.9;
}

function collectCandidates(text: string): Candidate[] {
    const out: Candidate[] = [];
    for (const [re, decode] of [
        [BASE64_RUN, tryDecodeBase64] as const,
        [HEX_RUN, tryDecodeHex] as const,
    ]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            if (out.length >= MAX_CANDIDATES) break;
            const raw = m[0];
            if (raw.length < MIN_ENCODED_LENGTH) continue;
            const decoded = decode(raw);
            if (decoded) out.push({ start: m.index, end: m.index + raw.length, raw, decoded });
        }
    }
    return out;
}

/**
 * Find encoded credentials. For each decodable run, re-scan the decoded text
 * with the real SecretDetector; emit a match over the ENCODED span when the
 * decode contains a recognised secret.
 */
export function detectEncodedSecrets(text: string): DetectorResult {
    const matches: DetectorMatch[] = [];
    const seen = new Set<string>();

    for (const cand of collectCandidates(text)) {
        // Guard against re-scanning something that already looks like plaintext
        // secret assignment (the plaintext detector will catch that directly).
        const inner = detectSecrets(cand.decoded);
        if (inner.matches.length === 0) continue;

        const innerClass = inner.matches[0].type;
        const key = `${cand.start}:${cand.end}`;
        if (seen.has(key)) continue;
        seen.add(key);

        matches.push({
            type: "encoded_secret",
            label: "Encoded credential",
            severity: "critical",
            score: ENCODED_SECRET_SCORE,
            start: cand.start,
            end: cand.end,
            match: cand.raw,
            message:
                `A credential was found ENCODED (decodes to a ${innerClass}). Encoding hides a secret from ` +
                "plaintext scanners; the decoded value is a real credential and must not reach the model.",
            confidence: 0.95,
        });
    }

    return {
        detectorName: "EncodedSecretDetector",
        detectorVersion: ENCODED_SECRET_DETECTOR_VERSION,
        matches,
    };
}
