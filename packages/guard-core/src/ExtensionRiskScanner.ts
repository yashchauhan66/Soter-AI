// ─── LLM Extension Risk Scanner (Phase 8) ────────────────────────────────────
//
// Heuristic risk assessment for installed VS Code extensions, with a focus on AI
// coding assistants that can read workspace files, selections, terminal output,
// and secrets. This is HEURISTIC risk scoring from local extension metadata only.
// It is NOT malware detection and must never claim an extension is malicious
// without evidence.

export const EXTENSION_RISK_SCANNER_VERSION = "1.0.0";

/** Minimal, provider-agnostic view of an installed extension's metadata. */
export interface ExtensionMetadata {
    /** Fully-qualified id, e.g. "anthropic.claude-code". */
    id: string;
    displayName?: string;
    publisher?: string;
    /** Whether VS Code ships this extension (built-in). Built-ins are trusted. */
    isBuiltin?: boolean;
    version?: string;
    /** Relevant fields pulled from the extension's package.json manifest. */
    packageJSON?: {
        displayName?: string;
        description?: string;
        publisher?: string;
        categories?: string[];
        activationEvents?: string[];
        main?: string;
        browser?: string;
        extensionDependencies?: string[];
        extensionPack?: string[];
        contributes?: Record<string, unknown>;
        repository?: unknown;
        // Some marketplace metadata VS Code exposes on installed extensions.
        __metadata?: { isVerified?: boolean; publisherDisplayName?: string };
    };
}

export type ExtensionRiskLevel = "info" | "low" | "medium" | "high";

export interface ExtensionRiskSignal {
    code: string;
    label: string;
    weight: number;
}

export interface ExtensionRiskAssessment {
    id: string;
    displayName: string;
    publisher: string;
    isAI: boolean;
    isBuiltin: boolean;
    riskScore: number;
    level: ExtensionRiskLevel;
    signals: ExtensionRiskSignal[];
    /** Practical, non-accusatory recommendation for the user. */
    recommendation: string;
}

export interface ExtensionScanReport {
    scannerVersion: string;
    total: number;
    aiExtensions: number;
    highRisk: number;
    assessments: ExtensionRiskAssessment[];
}

// AI coding-assistant signals — publisher/id/name fragments and marketplace categories.
const AI_ID_FRAGMENTS = [
    "copilot",
    "claude",
    "anthropic",
    "openai",
    "chatgpt",
    "gpt",
    "codeium",
    "codewhisperer",
    "tabnine",
    "cursor",
    "continue",
    "cody",
    "sourcegraph",
    "aws.codewhisperer",
    "sourcery",
    "bito",
    "codegpt",
    "genie",
    "aider",
    "supermaven",
    "ollama",
    "llm",
    "ai-assistant",
    "askcodi",
    "blackbox",
];

const AI_CATEGORY_FRAGMENTS = ["ai", "machine learning", "chat"];

/** Activation events that imply the extension runs broadly / on any workspace. */
const BROAD_ACTIVATION = ["*", "onStartupFinished"];

function frag(haystack: string, needles: string[]): string | undefined {
    const h = haystack.toLowerCase();
    return needles.find((n) => h.includes(n));
}

function looksLikeAI(meta: ExtensionMetadata): boolean {
    const hay = `${meta.id} ${meta.displayName ?? ""} ${meta.packageJSON?.description ?? ""}`;
    if (frag(hay, AI_ID_FRAGMENTS)) return true;
    const cats = (meta.packageJSON?.categories ?? []).map((c) => c.toLowerCase());
    return cats.some((c) => AI_CATEGORY_FRAGMENTS.some((f) => c.includes(f)));
}

/** Assess a single extension. Built-ins short-circuit to info-level. */
export function assessExtension(meta: ExtensionMetadata): ExtensionRiskAssessment {
    const pkg = meta.packageJSON ?? {};
    const displayName = meta.displayName ?? pkg.displayName ?? meta.id;
    const publisher = meta.publisher ?? pkg.publisher ?? meta.id.split(".")[0] ?? "unknown";
    const isAI = looksLikeAI(meta);
    const isBuiltin = meta.isBuiltin === true || publisher === "vscode" || meta.id.startsWith("vscode.");

    const signals: ExtensionRiskSignal[] = [];
    const add = (code: string, label: string, weight: number) => signals.push({ code, label, weight });

    if (isBuiltin) {
        return {
            id: meta.id,
            displayName,
            publisher,
            isAI,
            isBuiltin: true,
            riskScore: 0,
            level: "info",
            signals: [{ code: "builtin", label: "Built-in / bundled extension (trusted)", weight: 0 }],
            recommendation: "Built-in extension — no action needed.",
        };
    }

    // AI assistants read code/context by design — flag for awareness, not as a fault.
    if (isAI) add("ai_assistant", "AI coding assistant — can read workspace code & context", 25);

    // Broad activation → runs on every workspace, can read files eagerly.
    const activation = pkg.activationEvents ?? [];
    if (activation.some((a) => BROAD_ACTIVATION.includes(a))) {
        add("broad_activation", "Activates on any workspace (broad activation event)", 15);
    }
    if (activation.some((a) => a === "*")) {
        add("wildcard_activation", "Wildcard '*' activation — starts unconditionally", 10);
    }

    // Terminal contribution → can read/inject terminal content.
    const contributes = pkg.contributes ?? {};
    if ("terminal" in contributes || activation.some((a) => a.startsWith("onTerminalProfile"))) {
        add("terminal_access", "Contributes/uses terminal integration", 10);
    }

    // Depends on other extensions / ships an extension pack → expanded surface.
    if ((pkg.extensionDependencies ?? []).length > 0) {
        add("extension_deps", "Pulls in other extensions as dependencies", 8);
    }
    if ((pkg.extensionPack ?? []).length > 0) {
        add("extension_pack", "Installs an extension pack (multiple extensions)", 8);
    }

    // Unverified / unknown publisher heuristics.
    const verified = pkg.__metadata?.isVerified === true;
    if (!verified) add("unverified_publisher", "Publisher not marketplace-verified (heuristic)", 12);
    if (!pkg.repository) add("no_repository", "No source repository declared", 6);

    // Duplicate / impersonation heuristic: display name mentions a well-known AI
    // brand but an *unverified* publisher is not that brand. Verified publishers
    // (e.g. GitHub Copilot) are not impersonators.
    const brand = frag(displayName, ["copilot", "claude", "openai", "chatgpt", "cursor", "codeium"]);
    if (brand && !verified && !publisher.toLowerCase().includes(brand)) {
        add("possible_impersonation", `Name references "${brand}" but publisher is "${publisher}" — verify authenticity`, 20);
    }

    const riskScore = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
    const level: ExtensionRiskLevel = riskScore >= 45 ? "high" : riskScore >= 20 ? "medium" : riskScore > 0 ? "low" : "info";

    let recommendation: string;
    if (level === "high") {
        recommendation = isAI
            ? "AI tool with a broad footprint. Review its file/terminal access, keep secrets in the SoterAI vault, and share only SoterAI-built safe context."
            : "Broad-footprint extension from an unverified source. Confirm you trust the publisher and disable it in workspaces with sensitive code.";
    } else if (level === "medium") {
        recommendation = "Moderate footprint. Prefer sharing SoterAI-built safe context and keep secrets vaulted.";
    } else {
        recommendation = "Low heuristic risk. No specific action required.";
    }

    return { id: meta.id, displayName, publisher, isAI, isBuiltin: false, riskScore, level, signals, recommendation };
}

/** Assess every installed extension and roll up totals. */
export function scanExtensions(metas: ExtensionMetadata[]): ExtensionScanReport {
    const assessments = metas
        .map(assessExtension)
        .sort((a, b) => b.riskScore - a.riskScore || a.id.localeCompare(b.id));
    return {
        scannerVersion: EXTENSION_RISK_SCANNER_VERSION,
        total: assessments.length,
        aiExtensions: assessments.filter((a) => a.isAI).length,
        highRisk: assessments.filter((a) => a.level === "high").length,
        assessments,
    };
}
