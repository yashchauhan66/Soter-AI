/**
 * Canonical protection-level semantics for every SoterAI badge, status bar,
 * webview, notification, and report. These six levels are the ONLY vocabulary
 * allowed for describing what SoterAI does about a risk.
 *
 * The non-negotiable truth: never display ENFORCED or VERIFIED for a path
 * SoterAI does not technically control or cannot prove. If we merely observed
 * something, say MONITORED. If we can't observe it, say UNKNOWN.
 */

export type ProtectionLevel =
    /** SoterAI controls the relevant path and technically prevented plaintext exposure. */
    | "ENFORCED"
    /** A reproducible test or local evidence proves the protected transformation for this event. */
    | "VERIFIED"
    /** SoterAI removed/tokenized detected sensitive values but cannot prove control over every path. */
    | "REDACTED"
    /** SoterAI observed risk but could not enforce prevention. */
    | "MONITORED"
    /** Coverage cannot be established. */
    | "UNKNOWN"
    /** Plaintext exposure was detected, or an unsafe operation was stopped. */
    | "EXPOSED";

export interface ProtectionDescriptor {
    level: ProtectionLevel;
    /** Codicon id (no $() wrapper). Never rely on color alone. */
    icon: string;
    /** Short badge label. */
    label: string;
    /** One-line honest explanation shown in hovers/cards. */
    meaning: string;
}

export const PROTECTION: Record<ProtectionLevel, ProtectionDescriptor> = {
    ENFORCED: {
        level: "ENFORCED",
        icon: "shield",
        label: "Enforced",
        meaning: "SoterAI controls this path and technically prevented plaintext exposure.",
    },
    VERIFIED: {
        level: "VERIFIED",
        icon: "verified-filled",
        label: "Verified protected",
        meaning: "A reproducible local test proved the protected transformation for this event.",
    },
    REDACTED: {
        level: "REDACTED",
        icon: "eye-closed",
        label: "Redacted",
        meaning: "Detected sensitive values were removed or tokenized for supported routes. Other paths are not proven.",
    },
    MONITORED: {
        level: "MONITORED",
        icon: "warning",
        label: "Monitoring only",
        meaning: "SoterAI observed this risk but cannot technically prevent it in this environment.",
    },
    UNKNOWN: {
        level: "UNKNOWN",
        icon: "question",
        label: "Unknown coverage",
        meaning: "SoterAI cannot establish whether this path is protected.",
    },
    EXPOSED: {
        level: "EXPOSED",
        icon: "error",
        label: "Exposed",
        meaning: "Plaintext exposure was detected or an unsafe operation was stopped.",
    },
};

/** `$(icon) Label` — for status bar / markdown strings. */
export function badge(level: ProtectionLevel): string {
    const d = PROTECTION[level];
    return `$(${d.icon}) ${d.label}`;
}

/**
 * Honest coverage statement for a named surface. Use this instead of ad-hoc
 * "blocked"/"protected" wording when the surface is advisory.
 */
export function advisoryNotice(surface: string): string {
    return `${surface} is advisory: SoterAI records your decision and warns on drift, but cannot technically intercept other extensions or processes. Status: ${PROTECTION.MONITORED.label}.`;
}
