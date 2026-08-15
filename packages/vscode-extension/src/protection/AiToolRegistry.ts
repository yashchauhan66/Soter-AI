/**
 * Which installed extensions are AI tools, and which of those SoterAI can
 * actually route through its own broker.
 *
 * The previous classifier tested `/ai|copilot|claude|cursor|codeium|continue|
 * tabnine|windsurf/i` against each extension's id + displayName + description.
 * Every one of those alternatives is an unanchored substring, and "ai" is a
 * substring of ordinary English. On a real machine it counted
 * `bracket-pair-color-dlw` ("p-ai-r"), `auto-rename-tag` ("p-ai-red"),
 * `rainbow-csv` ("r-ai-nbow"), `remote-containers` ("cont-ai-ners") — and
 * SoterAI itself. It reported 32 AI tools on a machine with roughly six.
 *
 * That count then fed `bypassDetected = detected > routed`, so the product
 * showed a red "Bypass detected" for extensions that are not AI tools and that
 * SoterAI had never claimed to cover. This module exists so the number behind
 * that claim is a defensible list rather than a substring accident.
 *
 * Two separate questions are answered here, and conflating them was the second
 * half of the bug:
 *
 *   1. Is this an AI tool?      → `classifyAiTool` returns a kind
 *   2. Can SoterAI route it?    → `routable`
 *
 * A tool SoterAI cannot route is NOT a bypass. It is a documented limitation:
 * SoterAI has no way to make GitHub Copilot talk to a local broker, so
 * reporting Copilot as a bypass blames the user for something no setting can
 * fix. Unroutable tools are counted separately and surfaced as monitoring-only
 * coverage, never as an enforcement failure.
 */

/** How SoterAI relates to a detected AI tool. */
export type AiToolKind =
    /** Not an AI tool at all. */
    | "none"
    /** An AI tool whose endpoint SoterAI can point at its broker. */
    | "routable"
    /** A real AI tool with no SoterAI routing path: monitoring only. */
    | "unmanaged";

export interface AiToolClassification {
    id: string;
    kind: AiToolKind;
    /** Why it was classified this way, for the coverage report. */
    reason: string;
}

/**
 * Extensions that accept a custom OpenAI-compatible base URL, which is the
 * mechanism SoterAI's IntegrationAdapter rewrites. Keep this list aligned with
 * DEFAULT_INTEGRATION_CANDIDATES — an entry here is a claim that pointing the
 * tool at the broker actually works.
 */
const ROUTABLE_IDS = new Set<string>([
    "continue.continue",
    "saoudrizwan.claude-dev",        // Cline — custom base URL supported
    "rooveterinaryinc.roo-cline",    // Roo Code — fork of Cline
    "kilocode.kilo-code",
    "danielsanmedium.dscodegpt",     // CodeGPT — configurable endpoint
    "genieai.chatgpt-vscode",
    "openai.openai-vscode",
]);

/**
 * Real AI tools SoterAI cannot re-route. Listed explicitly so the coverage
 * report can name them instead of silently dropping them from the count.
 */
const UNMANAGED_IDS = new Set<string>([
    "github.copilot",
    "github.copilot-chat",
    "visualstudioexptteam.vscodeintellicode",
    "visualstudioexptteam.intellicode-api-usage-examples",
    "amazonwebservices.amazon-q-vscode",
    "amazonwebservices.aws-toolkit-vscode",
    "google.gemini-code-assist",
    "googlecloudtools.cloudcode",
    "sourcegraph.cody-ai",
    "codeium.codeium",
    "codeium.windsurfpyright",
    "tabnine.tabnine-vscode",
    "supermaven.supermaven",
    "blackboxapp.blackbox",
    "bito.bito",
    "codiumai.codiumai-vscode",
    "sourcery.sourcery",
    "augment.vscode-augment",
    "anthropic.claude-code",
]);

/**
 * Publishers whose entire catalogue is AI tooling. Used only when the exact id
 * is unknown, so a newly released extension from a known AI vendor is still
 * counted rather than missed.
 */
const AI_PUBLISHERS = new Set<string>([
    "codeium", "tabnine", "continue", "anthropic", "openai", "codiumai",
    "supermaven", "blackboxapp", "bito", "augment", "kilocode",
]);

/**
 * Distinctive id tokens that identify an AI tool on their own. Every token here
 * must be a word that does not occur inside unrelated English identifiers —
 * that is precisely the property the old `ai` alternative lacked. `ai` itself is
 * accepted only as a whole delimited segment (see `segments` below), so
 * `cody-ai` matches while `bracket-pair` does not.
 */
const AI_ID_TOKENS = [
    "copilot", "claude", "codeium", "tabnine", "cody", "chatgpt", "gpt",
    "gemini", "llm", "genai", "aider", "cline", "windsurf", "codewhisperer",
    "intellicode", "supermaven", "ollama", "anthropic",
    // Added after running the census over a real 73-extension machine, which
    // found five AI tools this list missed. Two of them (verdent, nvidia-nim)
    // had been caught only by accident before, because their publisher names
    // happen to end in the letters "ai".
    "opencode", "qwen", "kimi", "moonshot", "verdent", "deepseek", "mistral",
    "perplexity", "tabby",
];

/** This extension's own id (publisher.name from package.json). */
export const SELF_EXTENSION_ID = "soterai.soterai-ide-guard";

/**
 * Extensions that a token rule would otherwise catch by accident. A denylist
 * entry is a permanent regression test: if a future token change starts
 * matching one of these again, the entry keeps the count honest.
 */
const NOT_AI_IDS = new Set<string>([
    SELF_EXTENSION_ID,
    "coenraads.bracket-pair-colorizer-2",
    "bracketpaircolordlw.bracket-pair-color-dlw",
    "formulahendry.auto-rename-tag",
    "mechatroner.rainbow-csv",
    "ms-azuretools.vscode-containers",
    "ms-vscode-remote.remote-containers",
]);

/** Split an extension id into its identifier segments (`a.b-c_d` → a,b,c,d). */
function segments(id: string): string[] {
    return id.toLowerCase().split(/[.\-_]+/).filter(Boolean);
}

/**
 * An installed extension as seen by the classifier. `packageJSON` is optional so
 * an id alone can still be classified, but passing it is strictly better: the
 * manifest is the extension author's own declaration of what their extension is,
 * which no curated list can keep up with.
 */
export interface AiToolCandidate {
    id: string;
    packageJSON?: { categories?: unknown; contributes?: unknown } | undefined;
}

/**
 * Does the extension's own manifest declare it to be an AI tool?
 *
 * Chosen by dumping these fields for all 73 extensions on a real machine and
 * comparing against the curated verdicts. Two signals separate cleanly:
 *
 *   `categories: ["AI"]`            — VS Code's official AI category. Declared by
 *                                     every AI assistant checked, and by none of
 *                                     the ordinary extensions.
 *   `contributes.chatParticipants`  — the extension answers as a chat agent.
 *   `…languageModelChatProviders`   — the extension supplies a model.
 *
 * `contributes.languageModelTools` is deliberately NOT a signal, even though it
 * sounds like the strongest one. On the same machine it is declared by
 * `ms-python.python`, `ms-azuretools.vscode-containers`, `vscode-java-debug`,
 * `vscode-dotnet-runtime` and a MySQL client: those expose tools *to* an AI, they
 * are not AI tools themselves, and counting them would rebuild the false-positive
 * problem this module was written to remove. Same for
 * `mcpServerDefinitionProviders` (declared by Pylance).
 *
 * Nor is the `Machine Learning` category, which data-science extensions such as
 * `ms-python.python` declare.
 */
function manifestDeclaresAi(packageJSON: AiToolCandidate["packageJSON"]): string | undefined {
    if (!packageJSON || typeof packageJSON !== "object") return undefined;
    const categories = Array.isArray(packageJSON.categories) ? packageJSON.categories : [];
    if (categories.some((category) => typeof category === "string" && category.trim().toLowerCase() === "ai")) {
        return "the extension's own manifest declares category \"AI\"";
    }
    const contributes = packageJSON.contributes;
    if (contributes && typeof contributes === "object") {
        const keys = Object.keys(contributes as Record<string, unknown>);
        if (keys.includes("chatParticipants")) return "the extension contributes a chat participant";
        if (keys.some((key) => /^languageModel(Chat)?Providers$/.test(key))) {
            return "the extension contributes a language model provider";
        }
    }
    return undefined;
}

/**
 * Classify one extension.
 *
 * `selfId` is passed in rather than hardcoded so the running extension can
 * exclude itself by its real id: SoterAI counting SoterAI as an unprotected AI
 * tool was one of the reproduced false positives.
 */
export function classifyAiTool(candidate: string | AiToolCandidate, selfId?: string): AiToolClassification {
    const extensionId = typeof candidate === "string" ? candidate : candidate.id;
    const packageJSON = typeof candidate === "string" ? undefined : candidate.packageJSON;
    const id = extensionId.toLowerCase();
    if (selfId && id === selfId.toLowerCase()) {
        return { id: extensionId, kind: "none", reason: "SoterAI itself" };
    }
    if (NOT_AI_IDS.has(id)) {
        return { id: extensionId, kind: "none", reason: "known non-AI extension" };
    }
    if (ROUTABLE_IDS.has(id)) {
        return { id: extensionId, kind: "routable", reason: "supports a custom broker base URL" };
    }
    if (UNMANAGED_IDS.has(id)) {
        return { id: extensionId, kind: "unmanaged", reason: "AI tool with no SoterAI routing path" };
    }

    const parts = segments(id);
    const publisher = parts[0] ?? "";
    if (AI_PUBLISHERS.has(publisher)) {
        return { id: extensionId, kind: "unmanaged", reason: `published by known AI vendor "${publisher}"` };
    }
    // `ai` counts only as a whole segment; as a substring it matches ordinary
    // words ("pair", "rainbow", "containers") and caused the inflated count.
    if (parts.includes("ai")) {
        return { id: extensionId, kind: "unmanaged", reason: "id contains a distinct \"ai\" segment" };
    }
    for (const token of AI_ID_TOKENS) {
        if (parts.some((part) => part === token || part.startsWith(token))) {
            return { id: extensionId, kind: "unmanaged", reason: `id contains AI tool name "${token}"` };
        }
    }
    // Last, and least likely to go stale: what the author says it is. A curated
    // list cannot know about an AI extension published tomorrow; the manifest
    // can. It is checked after the routable list so a tool SoterAI can route is
    // never demoted to unmanaged by its own categories.
    const declared = manifestDeclaresAi(packageJSON);
    if (declared) {
        return { id: extensionId, kind: "unmanaged", reason: declared };
    }
    return { id: extensionId, kind: "none", reason: "no AI tool signal in the extension id or manifest" };
}

export interface AiToolCensus {
    /** AI tools SoterAI can point at its broker. */
    routable: AiToolClassification[];
    /** Real AI tools SoterAI has no routing path for (monitoring only). */
    unmanaged: AiToolClassification[];
}

/** Classify every installed extension into the two coverage buckets. */
export function censusAiTools(
    candidates: readonly (string | AiToolCandidate)[],
    selfId?: string,
): AiToolCensus {
    const routable: AiToolClassification[] = [];
    const unmanaged: AiToolClassification[] = [];
    for (const candidate of candidates) {
        const classification = classifyAiTool(candidate, selfId);
        if (classification.kind === "routable") routable.push(classification);
        else if (classification.kind === "unmanaged") unmanaged.push(classification);
    }
    return { routable, unmanaged };
}
