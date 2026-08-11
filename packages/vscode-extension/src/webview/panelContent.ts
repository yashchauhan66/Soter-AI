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
    icon: string;
    /** True when the task cannot work until the local broker is set up. */
    needsBroker?: boolean;
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
                    : "Rules are set, but nothing is being blocked yet. Turn on local checking below."
                : "Off — AI requests leave your machine without a safety check.",
            detail: facts.safeMode
                ? facts.brokerRunning
                    ? `Enforced on brokered AI traffic${facts.safeModeLevel ? ` (${facts.safeModeLevel})` : ""}. Traffic that bypasses the broker is not covered — SoterAI cannot intercept another extension's own network calls.`
                    : "The policy is stored, but the local broker is stopped, so un-brokered AI traffic is not blocked. Start the broker for enforcement."
                : "AI Safe Mode rules are not applied to any path.",
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
 * behind them. Ordered by effort: the zero-setup win is first and the one that
 * needs installation is last. The old panel numbered these 1-5 with setup
 * first, which read as a five-step chore before any value arrived.
 */
export function panelTasks(): PanelTask[] {
    return [
        {
            action: "action:scanClipboard",
            label: "Check what I copied",
            hint: "Nothing to set up. Checks the clipboard for secrets before you paste it into AI.",
            icon: "📋",
        },
        {
            action: "action:controlledTerminal",
            label: "Run a command safely",
            hint: "Reviews a terminal command for damage before it runs.",
            icon: "⌨️",
        },
        {
            action: "action:depGuard",
            label: "Check a package before installing",
            hint: "Looks for typo-squatting and known-bad packages.",
            icon: "📦",
        },
        {
            action: "action:mcpPreflight",
            label: "Check an agent tool before it runs",
            hint: "Reviews one AI agent tool call and reports what it would do.",
            icon: "🤖",
            needsBroker: true,
        },
        {
            action: "action:setupBroker",
            label: "Set up local checking",
            hint: "One-time setup. Needed before SoterAI can block anything.",
            icon: "🔌",
            needsBroker: false,
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
