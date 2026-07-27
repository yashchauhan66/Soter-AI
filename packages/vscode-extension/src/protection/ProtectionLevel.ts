/**
 * UI protection-level badges for every SoterAI status bar, webview, notification,
 * and report. These six levels are the display vocabulary.
 *
 * Canonical security claims use the eight-level CAPABILITY_REGISTRY vocabulary
 * from @soterai/guard-core (FULL_ENFORCEMENT … UNKNOWN_NOT_TESTED). Always map
 * through `toUiLevel()` / `capabilityUiBadge()` so badges cannot invent a
 * stronger claim than the registry allows.
 *
 * Non-negotiable: never display ENFORCED or VERIFIED for a path SoterAI does
 * not technically control or cannot prove. If we merely observed something,
 * say MONITORED. If we can't observe it, say UNKNOWN.
 */

import {
    CAPABILITY_REGISTRY,
    type ProtectionCapability,
    type ProtectionLevelName,
} from "@soterai/guard-core";

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

/**
 * Map the eight-level CAPABILITY_REGISTRY claim → UI badge.
 * Never upgrades: STRONG/FULL → ENFORCED only; detection/visibility → MONITORED.
 */
export function toUiLevel(registryLevel: ProtectionLevelName): ProtectionLevel {
    switch (registryLevel) {
        case "FULL_ENFORCEMENT":
        case "STRONG_ENFORCEMENT":
            return "ENFORCED";
        case "PARTIAL_ENFORCEMENT":
            return "REDACTED";
        case "ADVISORY_ONLY":
        case "DETECTION_ONLY":
        case "VISIBILITY_ONLY":
            return "MONITORED";
        case "UNSUPPORTED":
        case "UNKNOWN_NOT_TESTED":
            return "UNKNOWN";
        default: {
            const _exhaustive: never = registryLevel;
            void _exhaustive;
            return "UNKNOWN";
        }
    }
}

/** Look up a capability by id from the shared registry (single source of truth). */
export function getCapability(id: string): ProtectionCapability | undefined {
    return CAPABILITY_REGISTRY.find((c) => c.id === id);
}

/**
 * Honest UI badge + registry-level label for a capability id.
 * Prefer this over hardcoding "ENFORCED"/"MONITORED" in webviews.
 */
export function capabilityUiBadge(id: string): {
    uiLevel: ProtectionLevel;
    registryLevel: ProtectionLevelName;
    label: string;
    meaning: string;
    preExecutionBlock: boolean;
    wiredInRuntime: boolean;
} | undefined {
    const cap = getCapability(id);
    if (!cap) return undefined;
    const uiLevel = toUiLevel(cap.level);
    return {
        uiLevel,
        registryLevel: cap.level,
        label: PROTECTION[uiLevel].label,
        meaning: `${cap.name}: ${cap.level.replace(/_/g, " ").toLowerCase()}. ${PROTECTION[uiLevel].meaning}`,
        preExecutionBlock: cap.preExecutionBlock,
        wiredInRuntime: cap.wiredInRuntime,
    };
}

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
