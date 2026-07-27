// ─── Route Coverage Matrix (Scenario B — unsupported-extension honesty) ──────
//
// The non-negotiable truth: SoterAI must NEVER claim to prevent something it
// cannot technically control. This module maps each outbound/observed surface
// to an honest coverage level and a plain-language explanation of what SoterAI
// can and cannot do on that surface.
//
// Pure and deterministic — no VS Code, no I/O. The extension renders these rows
// in the coverage webview and uses `plaintextSecretCoverage` for the inlay/
// hover on a plaintext secret that only a broker path could truly protect.

/** Honest coverage level. Mirrors the extension's ProtectionLevel vocabulary. */
export type CoverageLevel = "ENFORCED" | "REDACTED" | "MONITORED" | "UNKNOWN";

export interface RouteCoverage {
    /** Stable id, e.g. "soterai-broker". */
    id: string;
    /** Human label, e.g. "SoterAI Local Broker". */
    route: string;
    /** What SoterAI can technically do on this route. */
    level: CoverageLevel;
    /** Can SoterAI observe traffic/content on this route at all? */
    observable: boolean;
    /** Can SoterAI transform (redact/tokenize) before it leaves? */
    transformable: boolean;
    /** Can SoterAI block/prevent plaintext exposure on this route? */
    enforceable: boolean;
    /** Honest one-line explanation, including the limitation. */
    note: string;
}

/**
 * The canonical coverage matrix. Order is stable for display. This is the
 * single source of truth for "what can SoterAI actually do here" — every badge
 * and marketing claim must be consistent with it.
 */
export const ROUTE_COVERAGE: RouteCoverage[] = [
    {
        id: "soterai-broker",
        route: "SoterAI Local Broker",
        level: "ENFORCED",
        observable: true,
        transformable: true,
        enforceable: true,
        note: "Requests originate in the broker, so SoterAI injects/signs credentials locally and can prevent plaintext exposure for this route.",
    },
    {
        id: "safe-context",
        route: "SoterAI-built AI context / prompts",
        level: "REDACTED",
        observable: true,
        transformable: true,
        enforceable: false,
        note: "SoterAI redacts secrets and quarantines injection before you paste, but cannot control what you do with the text afterward.",
    },
    {
        id: "clipboard",
        route: "Clipboard (SoterAI scan-then-paste)",
        level: "REDACTED",
        observable: true,
        transformable: true,
        enforceable: false,
        note: "Only paths routed through SoterAI's guarded paste are scanned; ordinary OS copy/paste is not intercepted.",
    },
    {
        id: "copilot-chat",
        route: "GitHub Copilot / VS Code Chat",
        level: "MONITORED",
        observable: false,
        transformable: false,
        enforceable: false,
        note: "SoterAI cannot intercept another extension's model calls. It can warn and build safe context, but cannot prove what Copilot sent.",
    },
    {
        id: "unknown-extension",
        route: "Other extensions / processes reading files",
        level: "MONITORED",
        observable: false,
        transformable: false,
        enforceable: false,
        note: "A VS Code extension cannot stop another extension or process from reading a file on disk. Migrate secrets to the vault/broker for real protection.",
    },
    {
        id: "terminal-agent",
        route: "Terminal / external agent processes",
        level: "UNKNOWN",
        observable: false,
        transformable: false,
        enforceable: false,
        note: "SoterAI can review a command you paste, but cannot observe arbitrary subprocess behavior or network egress.",
    },
];

/**
 * Coverage for a plaintext secret sitting in a workspace file, given whether
 * the user has migrated it to the vault/broker. This is the exact honesty
 * decision behind Scenario B: an un-migrated plaintext secret is MONITORED
 * (never ENFORCED), because any extension/process can read the file directly.
 */
export function plaintextSecretCoverage(opts: { migratedToVault: boolean; brokered: boolean }): RouteCoverage {
    if (opts.brokered) {
        return {
            id: "plaintext-secret",
            route: "Secret value",
            level: "ENFORCED",
            observable: true,
            transformable: true,
            enforceable: true,
            note: "The value is behind a scoped broker capability — the AI receives a handle, not the secret.",
        };
    }
    if (opts.migratedToVault) {
        return {
            id: "plaintext-secret",
            route: "Secret value",
            level: "REDACTED",
            observable: true,
            transformable: true,
            enforceable: false,
            note: "The value was moved to the encrypted vault and replaced with a placeholder. Any tool still reading a restored copy is not covered.",
        };
    }
    return {
        id: "plaintext-secret",
        route: "Secret value",
        level: "MONITORED",
        observable: true,
        transformable: false,
        enforceable: false,
        note: "This secret is still plaintext on disk. SoterAI cannot prevent another extension or process from reading it — migrate it to the vault or an enforced broker path.",
    };
}
