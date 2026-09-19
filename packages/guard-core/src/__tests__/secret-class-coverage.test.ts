/**
 * Every credential class the detector can report must be a decision, not an
 * accident.
 *
 * There are two vocabularies in this package and they are not the same list.
 * Survivor patterns in `Redactor.ts` are named for what they REDACT; detector
 * specs in `SecretDetector.ts` are named for what they MATCHED. Scan categories
 * come from the second, and `soterai hook` blocks on the first. Anything in the
 * gap is a credential the scanner finds, reports, and the hook then allows.
 *
 * That gap was real and it was wide. Because `collapseOverlappingMatches` keeps
 * only the highest-scoring match for a span, a real OpenAI key was reported as
 * `openai_api_key` and never as the broader `ai_api_key` the vocabulary knew —
 * so the hook read a live key and let it through. Measured on synthetic keys of
 * each vendor's real shape: 4 of 17 formats actually blocked.
 *
 * The existing vocabulary test could not see this. It pins the ide-protocol
 * mirror to guard-core's list, which keeps two lists honest about each other
 * while both stay wrong about the detector. This test closes that by binding the
 * vocabulary to the DETECTOR's own class names.
 *
 * If this fails, do not widen the exception map to make it pass. Either the new
 * class is a credential — add it to the vocabulary in `Redactor.ts` and to the
 * mirror in `@soterai/ide-protocol` — or it is not, and it needs a reason here
 * that a reviewer can disagree with.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SECRET_DETECTOR_CLASSES } from "../detectors/SecretDetector";
import { HIGH_RISK_SECRET_CLASS_NAMES } from "../Redactor";

/**
 * Classes that are deliberately NOT blockable. Each entry costs a real
 * credential going unblocked, so each carries the reason it is worth that.
 */
const NOT_BLOCKABLE: Record<string, string> = {
    heroku_key:
        "the pattern is a bare UUID. Blocking every UUID would refuse ordinary source files, " +
        "which is a worse failure than missing a Heroku key — and a UUID under a credential-named " +
        "key is still caught by opaque_credential.",
    twilio_sid:
        "an Account SID is a public account identifier, not a secret. Twilio's secret is the " +
        "auth token, which IS blockable.",
    generic_api_key:
        "matches a 16+ character value after a credential keyword with no entropy gate, so it " +
        "fires on identifiers and slugs. Superseded for blocking by opaque_credential, which " +
        "gates on entropy, character classes and a key deny-list.",
    password_assignment:
        "matches any 8+ character value after password/passwd/pwd, including 'postgres' and " +
        "'changeme'. Superseded for blocking by opaque_credential.",
    high_entropy_token:
        "entropy alone, with no key deny-list, so a checksum or digest under a credential-named " +
        "key trips it. Superseded for blocking by opaque_credential.",
};

describe("secret class blocking coverage", () => {
    it("every detector class is blockable or has a written reason not to be", () => {
        const blockable = new Set(HIGH_RISK_SECRET_CLASS_NAMES);
        const unaccounted = SECRET_DETECTOR_CLASSES.filter(
            (t) => !blockable.has(t) && !(t in NOT_BLOCKABLE),
        );

        assert.deepEqual(
            unaccounted,
            [],
            `the secret detector reports ${unaccounted.join(", ")} as a scan category, but no ` +
                "consumer recognises it as high-risk — so `soterai hook` will read that credential " +
                "and allow it. Add it to HIGH_RISK_SECRET_CLASS_NAMES (and the ide-protocol mirror), " +
                "or give it a reason in NOT_BLOCKABLE.",
        );
    });

    it("the exception list has no stale entries", () => {
        // A stale exception is how a class quietly stays unblocked after the
        // reason for it stopped being true.
        const stale = Object.keys(NOT_BLOCKABLE).filter((t) => !SECRET_DETECTOR_CLASSES.includes(t));
        assert.deepEqual(
            stale,
            [],
            `NOT_BLOCKABLE explains ${stale.join(", ")}, which the detector no longer reports.`,
        );

        const contradicted = Object.keys(NOT_BLOCKABLE).filter((t) =>
            HIGH_RISK_SECRET_CLASS_NAMES.includes(t),
        );
        assert.deepEqual(
            contradicted,
            [],
            `${contradicted.join(", ")} is listed as not blockable but IS in the block vocabulary.`,
        );
    });

    it("the vocabulary names no class the detector cannot emit", () => {
        // The survivor patterns legitimately carry redaction-only names, so this
        // checks the added detector-class entries only.
        const detectorNamed = HIGH_RISK_SECRET_CLASS_NAMES.filter((n) =>
            SECRET_DETECTOR_CLASSES.includes(n),
        );
        assert.ok(
            detectorNamed.length >= 20,
            `only ${detectorNamed.length} vocabulary entries correspond to a real detector class; ` +
                "the two lists have drifted apart again.",
        );
    });
});
