/**
 * Plain-language content model for the SoterAI Control Panel.
 *
 * This module is deliberately pure — it does not import `vscode` — for the same
 * reason ProtectionState.ts is pure: the wording a new user reads is the part
 * most likely to be wrong, and it should be unit-testable without a VS Code
 * host.
 *
 * The rule that shapes every string here: a first-time user should be able to
 * read one line and know what a control does. The honest caveat is NOT deleted
 * to achieve that — it moves into `detail`, which the panel renders inside a
 * collapsed <details> block. Demoting a caveat is allowed; softening one is
 * not. No `level` here is ever stronger than what CAPABILITY_REGISTRY permits,
 * because every level is resolved through capabilityUiBadge().
 */

import { capabilityUiBadge, type ProtectionLevel } from "../protection/ProtectionLevel";
import type { ProtectionStateName } from "../protection/ProtectionState";

/** Runtime facts the panel has actually verified. Never secrets or content. */
export interface PanelFacts {
    safeMode: boolean;
    safeModeLevel?: string;
    protectedWorkspace: boolean;
    liveScan: boolean;
    sentinel: boolean;
    mcpFirewall: boolean;
    brokerRunning: boolean;
    trusted: boolean;
}

export type ControlId =
    | "safeMode"
    | "protectedWorkspace"
    | "liveScan"
    | "sentinel"
    | "mcpFirewall";

export interface PlainControl {
    id: ControlId;
    /** What the user gets, in their words. */
    label: string;
    /** One short line, always visible. Must carry no internal vocabulary. */
    summary: string;
    /** The full honest caveat, shown when the user expands the row. */
    detail: string;
    on: boolean;
    level?: ProtectionLevel;
}

export interface PanelTask {
    /** Message type; must be a member of the provider's ALLOWED set. */
    action: string;
    label: string;
    hint: string;
    /** Inline SVG line icon (16×16 grid, currentColor) — never an emoji. */
    icon: string;
    /** Lower-frequency workflows stay available without crowding first use. */
    group: "start" | "more";
}

export interface PrimaryCta {
    action: string;
    label: string;
    hint: string;
    tone: "go" | "fix" | "calm";
}

/**
 * Words that mean something inside this codebase and nothing to a new user.
 * Enforced by test against every `summary`, `label` and task string. `detail`
 * is exempt on purpose: that is where the precise, jargon-carrying truth lives.
 */
export const INTERNAL_VOCABULARY: readonly RegExp[] = [
    /registry level/i,
    /VISIBILITY_ONLY|DETECTION_ONLY|ADVISORY_ONLY|FULL_ENFORCEMENT|STRONG_ENFORCEMENT|PARTIAL_ENFORCEMENT|UNSUPPORTED|UNKNOWN_NOT_TESTED/,
    /\bpipeline \d/i,
    /\bun-?brokered\b/i,
    /\bpreflight\b/i,
    /\bMCP\b(?! server)/,
    /\bsoterai\.[a-z]/i,
    /\bwebview\b/i,
    /\bALLOW_[A-Z_]+|\bQUARANTINE\b/,
];

/** Short, honest level word for a control that is on. */
function levelFor(on: boolean, level: ProtectionLevel | undefined): ProtectionLevel | undefined {
    return on ? level : undefined;
}

/**
 * The five controls, in the order a new user benefits from them: the thing
 * that blocks first, then the things that reduce exposure, then the things
 * that only watch.
 */
export function plainControls(facts: PanelFacts): PlainControl[] {
    const liveScanLevel = capabilityUiBadge("live-scan")?.uiLevel ?? "MONITORED";
    const liveScanRegistry = capabilityUiBadge("live-scan")?.registryLevel ?? "VISIBILITY_ONLY";
    const mcpLevel = capabilityUiBadge("mcp-config-scan")?.uiLevel ?? "MONITORED";
    const mcpRegistry = capabilityUiBadge("mcp-config-scan")?.registryLevel ?? "DETECTION_ONLY";

    return [
        {
            id: "safeMode",
            label: "Block risky AI requests",
            summary: facts.safeMode
                ? facts.brokerRunning
                    ? "On — risky requests through SoterAI are blocked before they leave your machine."
                    : "On — SoterAI-routed checks warn, but direct AI traffic is not blocked."
                : "Off — AI requests leave your machine without a safety check.",
            detail: facts.safeMode
                ? facts.brokerRunning
                    ? `Fully enforced on brokered AI traffic${facts.safeModeLevel ? ` (${facts.safeModeLevel})` : ""}. Traffic that bypasses the broker is scanned and warned — SoterAI cannot intercept another extension's own network calls.`
                    : "Safe Mode is on. Without the local broker, SoterAI scans every prompt you send through SoterAI commands and warns on secrets/injection. Start the broker for full pre-send blocking on routed traffic."
                : "AI Safe Mode is off. No scanning or blocking on any AI request path.",
            on: facts.safeMode,
            level: levelFor(facts.safeMode, facts.brokerRunning ? "ENFORCED" : "MONITORED"),
        },
        {
            id: "protectedWorkspace",
            label: "Keep chosen files out of AI",
            summary: facts.protectedWorkspace
                ? "On — files you mark as private are stripped from anything SoterAI sends."
                : "Off — every file in this project can be included when AI asks for context.",
            detail: facts.protectedWorkspace
                ? "Protected files are excluded from SoterAI-built AI context. Direct reads by other extensions or tools are not intercepted."
                : "Listed files are not excluded from AI context bundles.",
            on: facts.protectedWorkspace,
            level: levelFor(facts.protectedWorkspace, "REDACTED"),
        },
        {
            id: "liveScan",
            label: "Warn me about secrets as I type",
            summary: facts.liveScan
                ? "On — you get a warning in the editor. It warns, it does not block."
                : "Off — no editor warnings for secrets or injected instructions.",
            detail: `Files are scanned as you type and save (secrets, personal data, prompt injection, jailbreak wording). Registry level: ${liveScanRegistry} — diagnostics only. It does not block a send to AI and does not stop other extensions.`,
            on: facts.liveScan,
            level: levelFor(facts.liveScan, liveScanLevel),
        },
        {
            id: "sentinel",
            label: "Keep a record of AI activity",
            summary: facts.sentinel
                ? "On — a private, redacted history you can review later. Watching only."
                : "Off — no history of what AI tools did in this project.",
            detail: facts.sentinel
                ? "Records a redacted timeline of observed AI activity. Observes only — it does not block, and raw secret values are never stored."
                : "AI activity is not being recorded.",
            on: facts.sentinel,
            level: levelFor(facts.sentinel, "MONITORED"),
        },
        {
            id: "mcpFirewall",
            label: "Check AI agent tools strictly",
            summary: facts.mcpFirewall
                ? "On — risky agent tool settings get flagged for you."
                : "Off — agent tool settings get the standard check only.",
            detail: `MCP configs are scanned strictly and risky tools are flagged (${mcpRegistry}). The optional broker preflight is detection-only unless the calling tool respects the decision; other MCP clients stay unenforced.`,
            on: facts.mcpFirewall,
            level: levelFor(facts.mcpFirewall, mcpLevel),
        },
    ];
}

/**
 * Things a user came here to do, named as goals rather than as the modules
 * behind them. The first three solve the security problems users encounter
 * immediately; specialised checks are rendered under a disclosure below them.
 */
export function panelTasks(): PanelTask[] {
    return [
        {
            action: "action:checkBeforeAI",
            label: "Scan before sending to AI",
            hint: "Checks selected text or your clipboard locally and offers a safe copy.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="3.25" y="3" width="9.5" height="11.5" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="M5.5 1.5h5v2.25h-5z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="m5.75 9.25 1.75 1.75 2.75-3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            group: "start",
        },
        {
            action: "action:protectSecrets",
            label: "Protect workspace secrets",
            hint: "Finds raw secrets and, after review, replaces them with safe placeholders on disk.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5 13 3.5v3.75c0 3.2-1.9 5.7-5 7.25-3.1-1.55-5-4.05-5-7.25V3.5l5-2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="m5.5 8 1.5 1.5 3.5-3.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            group: "start",
        },
        {
            action: "action:secureAI",
            label: "Secure installed AI tools",
            hint: "Finds supported AI tools, shows every proposed change, and keeps encrypted backups.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.25" y="5" width="11.5" height="8.5" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="M5 5V3.75A3 3 0 0 1 8 1a3 3 0 0 1 3 2.75V5M5.25 9.25h.01M10.75 9.25h.01M6.5 11.25h3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>`,
            group: "start",
        },
        {
            action: "action:controlledTerminal",
            label: "Run a command safely",
            hint: "Reviews a terminal command for damage before it runs.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="m4.5 6.25 2.5 2.5-2.5 2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.75 11.25H11.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>`,
            group: "more",
        },
        {
            action: "action:depGuard",
            label: "Check a package before installing",
            hint: "Looks for typo-squatting and known-bad packages.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5 13.75 4v8L8 14.5 2.25 12V4L8 1.5Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M2.25 4 8 6.75 13.75 4M8 6.75V14.5" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>`,
            group: "more",
        },
        {
            action: "action:mcpPreflight",
            label: "Check an agent tool before it runs",
            hint: "Reviews one AI agent tool call and reports what it would do.",
            icon: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.75" y="5.5" width="10.5" height="7.5" rx="1.75" stroke="currentColor" stroke-width="1.25"/><path d="M8 3v2.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><circle cx="4" cy="3" r="1.25" fill="currentColor"/><circle cx="12" cy="3" r="1.25" fill="currentColor"/><rect x="5.25" y="8.25" width="1.75" height="2" rx=".5" fill="currentColor"/><rect x="9" y="8.25" width="1.75" height="2" rx=".5" fill="currentColor"/></svg>`,
            group: "more",
        },
    ];
}

/**
 * The single next step, derived from the state the extension actually verified.
 *
 * There is exactly one primary button because a new user reading five equally
 * weighted buttons has to make a decision they have no basis for. The old panel
 * showed "Enable Full Protection" unconditionally — including while locked
 * down, where it is the wrong move, and while already fully enforced, where it
 * is a no-op that implies something is still missing.
 */
export function primaryCta(state: ProtectionStateName, facts: PanelFacts): PrimaryCta {
    if (state === "LOCKDOWN") {
        // Previously unreachable from this panel: lockdown replaced the whole
        // body and left no way back except the command palette.
        return {
            action: "action:unlock",
            label: "Unlock protection",
            hint: "Review what happened first — unlocking restores normal AI access.",
            tone: "fix",
        };
    }
    if (state === "ERROR" || state === "POLICY_UNAVAILABLE") {
        return {
            action: "action:openCoverage",
            label: "See what is wrong",
            hint: "Opens the details of which parts are working and which are not.",
            tone: "fix",
        };
    }
    if (!facts.brokerRunning) {
        return {
            action: "action:setupBroker",
            label: "Turn on local checking",
            hint: "One-time setup. Until this is done, SoterAI can warn you but cannot block anything.",
            tone: "go",
        };
    }
    if (state === "FULLY_ENFORCED") {
        return {
            action: "action:openCoverage",
            label: "See what is covered",
            hint: "Everything supported is on. This shows exactly what that does and does not cover.",
            tone: "calm",
        };
    }
    return {
        action: "action:fullProtection",
        label: "Turn on everything",
        hint: "Switches on every supported control in one step. You can turn any of them off after.",
        tone: "go",
    };
}
