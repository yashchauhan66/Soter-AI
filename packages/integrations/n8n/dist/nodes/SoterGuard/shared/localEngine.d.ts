/**
 * Local detection engine.
 *
 * Runs entirely inside the n8n process: no network, no credential, no telemetry,
 * no files. It exists because the single most common reason a self-hosted n8n
 * user will not install an AI-security node is that the node has to send every
 * prompt to somebody else's server. The Workflow Audit action already worked
 * that way; this makes the rest of the node work that way too.
 *
 * What this is honest about
 * -------------------------
 * This is the pattern tier and only the pattern tier. The SoterAI cloud engine
 * runs this class of rule *plus* an ONNX classifier, multi-turn/crescendo
 * correlation across a session, per-key attacker reputation, semantic egress
 * comparison against registered sources, and agent-passport enforcement. None of
 * those can run from a regex table inside a community node, so none of them are
 * claimed here. Every result this file produces carries `engine: "local"` and
 * `engineLimitations`, and the node surfaces both, because a user who believes
 * local mode equals cloud mode is worse off than one who knows exactly what they
 * have.
 *
 * Findings deliberately never carry the matched text. A finding is
 * type/label/severity only, so an audit trail of a leaked secret is not itself a
 * copy of the secret.
 */
export declare const LOCAL_ENGINE_VERSION = "1.0.0";
export type LocalSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type LocalDirection = "INPUT" | "OUTPUT";
export type LocalAction = "ALLOW" | "BLOCK" | "ALLOW_WITH_REDACTION" | "REVIEW";
export interface LocalFinding {
    type: string;
    label: string;
    severity: LocalSeverity;
    /** How many distinct rules of this type matched. Never the matched text. */
    matches: number;
}
export interface LocalAnalysis {
    allowed: boolean;
    action: LocalAction;
    riskScore: number;
    riskTypes: string[];
    findings: LocalFinding[];
    safeText: string;
    redactedText: string;
    reason: string;
    primaryRiskType: string | null;
    categoryConfidence: Record<string, number>;
    latencyMs: number;
    engine: "local";
    engineVersion: string;
    engineLimitations: string[];
}
export interface LocalRedaction {
    safeText: string;
    entities: Array<{
        type: string;
        label: string;
        severity: LocalSeverity;
    }>;
    count: number;
}
/**
 * The single source of truth for what local mode cannot do. Attached to every
 * local result rather than written once in the README, because the place a user
 * finds out what protection they actually have should be the run output.
 */
export declare const LOCAL_ENGINE_LIMITATIONS: string[];
/** The folded, whitespace-normalised form used for comparison and excerpting. */
export declare function foldText(text: string): string;
export declare const US_SSN_TOKEN = "[REDACTED_US_SSN]";
/**
 * US SSN redaction, shared by the local engine and by the cloud path's
 * client-side safety net.
 *
 * A deployment older than the server-side fix returns `123-45-6789` in
 * cleartext, so the node removes it itself rather than presenting text with a
 * social security number in it as redacted. The labelled form runs first so its
 * capture group can keep the label ("SSN: ") and replace only the digits.
 */
export declare function redactUsSsn(text: string): {
    text: string;
    count: number;
};
/**
 * Removes every identifier the local engine knows how to recognise.
 *
 * US SSN runs before the rule table because the dashed form overlaps the phone
 * shape, and the phone rule would otherwise consume it and report the wrong
 * category.
 */
export declare function redactLocal(text: string): LocalRedaction;
/**
 * Runs the rule table plus redaction over one string.
 *
 * Shaped to match the API's guard response on purpose — `allowed`, `action`,
 * `riskScore`, `riskTypes`, `findings`, `safeText`, `reason`, `primaryRiskType`
 * — so the same result builders, the same Safe/Flagged routing, and the same
 * downstream expressions work whichever engine answered. The only difference a
 * workflow sees is the added `engine` field.
 */
export declare function analyzeLocal(text: string, direction?: LocalDirection): LocalAnalysis;
/**
 * Local RAG document trust verdict.
 *
 * Carries the same invariant the server-side fix added: a document that is
 * *carrying* an attack cannot be scored above the quarantine floor, no matter
 * how much benign text surrounds it. Remediable personal data is different — it
 * gets REDACT_AND_INDEX, because redaction genuinely fixes it.
 */
export declare function scoreRagDocumentLocal(text: string, documentId: string, source: string): {
    documentId: string;
    trustScore: number;
    trustLevel: string;
    recommendedAction: string;
    findings: LocalFinding[];
    reason: string;
    engine: "local";
    engineVersion: string;
    engineLimitations: string[];
};
/** Rule count, so the node can report its own coverage rather than assert it. */
export declare const LOCAL_RULE_COUNT: number;
export interface LocalEgressSource {
    id: string;
    content?: string;
    sensitivity?: string;
}
export interface LocalEgressResult {
    decision: "ALLOW" | "REVIEW" | "BLOCK";
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    comparedSourceIds: string[];
    matchedSources: Array<{
        id: string;
        overlap: number;
        kind: "verbatim" | "paraphrase-window";
    }>;
    unresolvedSourceIds: string[];
    /**
     * Sources whose text was longer than the comparison limit, so only the first
     * EGRESS_COMPARE_MAX_CHARS characters of them were examined. Named for the same
     * reason unresolved sources are: a comparison that covered part of a document
     * must not be reported the same way as one that covered all of it.
     */
    partiallyComparedSourceIds: string[];
    engine: "local";
    engineNote: string;
}
/**
 * Compares the outgoing text against the inline content of each protected
 * source. Two signals, both conservative:
 *
 * - a verbatim run of at least 40 characters, which is hard to produce by
 *   coincidence and is what an actual copy-paste leak looks like;
 * - shared 8-word windows, which survive light rewording.
 *
 * Sources supplied as a bare id cannot be compared here at all — the content
 * lives in the project's fingerprint table — so they are returned in
 * `unresolvedSourceIds` rather than counted as "compared and clean". That was
 * the exact shape of the bug where the egress layer reported a clean result
 * while comparing against nothing.
 */
export declare function compareEgressLocal(content: string, sources: LocalEgressSource[]): LocalEgressResult;
export interface LocalToolCheck {
    decision: "ALLOW" | "REVIEW" | "ASK_APPROVAL" | "BLOCK";
    riskScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    findings: LocalFinding[];
    engine: "local";
    engineNote: string;
}
/**
 * Local tool-call risk.
 *
 * This is capability-and-content reasoning, not identity: it scans the payload
 * the model produced, then weighs it against how far the call reaches and what
 * the tool is able to do. Whether the *agent* is allowed to make the call at all
 * is passport enforcement, which is server-side, and the note says so rather
 * than letting a green verdict imply an authorisation check that never ran.
 */
export declare function checkToolCallLocal(input: {
    name: string;
    action: string;
    destination: string;
    target?: string;
    content?: string;
    riskContext?: Record<string, unknown>;
}): LocalToolCheck;
