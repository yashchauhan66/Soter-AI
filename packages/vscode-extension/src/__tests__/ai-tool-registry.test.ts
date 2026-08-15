import assert from "node:assert/strict";
import { test } from "node:test";
import { SELF_EXTENSION_ID, censusAiTools, classifyAiTool } from "../protection/AiToolRegistry";

/**
 * Real extension ids taken off the machine that reported "0 of 32 detected AI
 * tools". Every one of these was counted as an AI tool by the old substring
 * classifier, and every one of them fed the red "Bypass detected" headline.
 *
 * These are regression cases, not examples: if the classifier ever counts one
 * of them again, the product goes back to alarming about nothing.
 */
const REAL_FALSE_POSITIVES = [
    "bracketpaircolordlw.bracket-pair-color-dlw", // "p-ai-r"
    "formulahendry.auto-rename-tag",              // "p-ai-red"
    "mechatroner.rainbow-csv",                    // "r-ai-nbow"
    "ms-azuretools.vscode-containers",            // "cont-ai-ners"
    "ms-vscode-remote.remote-containers",         // "cont-ai-ners"
];

test("the extensions that produced the inflated count are not AI tools", () => {
    for (const id of REAL_FALSE_POSITIVES) {
        const result = classifyAiTool(id, SELF_EXTENSION_ID);
        assert.equal(result.kind, "none", `${id} was classified as ${result.kind}: ${result.reason}`);
    }
});

test("SoterAI does not count itself as an unprotected AI tool", () => {
    assert.equal(classifyAiTool(SELF_EXTENSION_ID, SELF_EXTENSION_ID).kind, "none");
    // Also holds when the caller does not pass its own id, via the denylist.
    assert.equal(classifyAiTool(SELF_EXTENSION_ID).kind, "none");
});

test("\"ai\" counts as a signal only when it is a whole id segment", () => {
    // A distinct segment is a real signal...
    assert.notEqual(classifyAiTool("sourcegraph.cody-ai").kind, "none");
    // ...but the same letters inside an ordinary word are not.
    for (const id of ["someone.pair-programming", "someone.rainbow-brackets", "someone.detail-view"]) {
        assert.equal(classifyAiTool(id).kind, "none", `${id} must not match on a bare "ai" substring`);
    }
});

test("routable and unmanaged AI tools are separated, not lumped together", () => {
    // Continue exposes a configurable base URL, so SoterAI can route it.
    assert.equal(classifyAiTool("continue.continue").kind, "routable");
    // Copilot talks to GitHub directly; no setting makes it use a local broker.
    assert.equal(classifyAiTool("github.copilot").kind, "unmanaged");
    assert.equal(classifyAiTool("github.copilot-chat").kind, "unmanaged");
});

test("a real AI tool is still detected even when its exact id is unknown", () => {
    // Unknown extension from a known AI vendor.
    assert.equal(classifyAiTool("codeium.some-future-product").kind, "unmanaged");
    // Unknown vendor, but a distinctive AI tool name in the id.
    assert.equal(classifyAiTool("someone.claude-helper").kind, "unmanaged");
    assert.equal(classifyAiTool("someone.chatgpt-sidebar").kind, "unmanaged");
});

test("an unroutable tool is never reported as routable", () => {
    // This is the honesty invariant: claiming SoterAI can route Copilot would
    // promise enforcement that no code path can deliver.
    for (const id of ["github.copilot", "tabnine.tabnine-vscode", "visualstudioexptteam.vscodeintellicode"]) {
        assert.notEqual(classifyAiTool(id).kind, "routable", `${id} must not be advertised as routable`);
    }
});

test("the census over a realistic machine reports a defensible count", () => {
    // A plausible install: two real AI tools, one routable, plus noise.
    const installed = [
        SELF_EXTENSION_ID,
        "github.copilot",
        "github.copilot-chat",
        "continue.continue",
        ...REAL_FALSE_POSITIVES,
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint",
        "ms-python.python",
    ];
    const census = censusAiTools(installed, SELF_EXTENSION_ID);
    assert.deepEqual(census.routable.map((c) => c.id), ["continue.continue"]);
    assert.deepEqual(census.unmanaged.map((c) => c.id), ["github.copilot", "github.copilot-chat"]);
    // The old classifier scored 8 of these 11 as AI tools; the honest answer is 3.
    assert.equal(census.routable.length + census.unmanaged.length, 3);
});

test("every classification carries a reason a user could be shown", () => {
    for (const id of ["github.copilot", "continue.continue", "esbenp.prettier-vscode"]) {
        const result = classifyAiTool(id, SELF_EXTENSION_ID);
        assert.ok(result.reason.length > 0, `${id} has no reason`);
    }
});

// ── Under-detection found by running the census on a real machine ────────────
//
// The first version of this registry was checked against synthetic ids and
// looked fine. Run over the 73 extensions actually installed on the machine that
// filed the report, it missed five real AI tools — and two of those had only
// ever been caught by accident, because their publisher names end in the letters
// "ai" (`verdentai`, `hidenobunagai`). For a coverage line, under-counting AI
// tools is the dangerous direction to be wrong in: it understates exposure.

test("real AI tools found on a real machine are all detected", () => {
    const missed = [
        "verdentai.verdent",
        "sst-dev.opencode",
        "tanishqkancharla.opencode-vscode",
        "qwenlm.qwen-code-vscode-ide-companion",
        "moonshot-ai.kimi-code",
    ];
    for (const id of missed) {
        assert.notEqual(classifyAiTool(id, SELF_EXTENSION_ID).kind, "none", `${id} is a real AI tool and was missed`);
    }
});

test("an extension's own manifest can identify it when the id cannot", () => {
    // NVIDIA NIM provider: nothing in the id says AI, but the manifest declares
    // both the AI category and a language-model provider.
    const nim = classifyAiTool({
        id: "hidenobunagai.nvidia-nim-provider",
        packageJSON: { categories: ["AI", "Chat"], contributes: { languageModelChatProviders: [], languageModelTools: [] } },
    }, SELF_EXTENSION_ID);
    assert.equal(nim.kind, "unmanaged");
    assert.match(nim.reason, /manifest declares category "AI"/i);

    // A chat participant is an AI surface even with no AI category declared.
    const chatAgent = classifyAiTool({
        id: "someone.database-client",
        packageJSON: { categories: ["Programming Languages"], contributes: { chatParticipants: [] } },
    });
    assert.equal(chatAgent.kind, "unmanaged");
    assert.match(chatAgent.reason, /chat participant/i);
});

test("exposing tools TO an AI does not make an extension an AI tool", () => {
    // This is the guard against rebuilding the original false-positive problem
    // from the other direction. All four shapes are taken verbatim from real
    // manifests on the reporting machine.
    const notAiTools = [
        { id: "ms-python.python", packageJSON: { categories: ["Programming Languages", "Data Science", "Machine Learning"], contributes: { languageModelTools: [] } } },
        { id: "ms-azuretools.vscode-containers", packageJSON: { categories: ["Programming Languages", "Azure"], contributes: { languageModelTools: [] } } },
        { id: "ms-python.vscode-pylance", packageJSON: { categories: ["Programming Languages"], contributes: { mcpServerDefinitionProviders: [] } } },
        { id: "vscjava.vscode-java-dependency", packageJSON: { categories: [], contributes: { languageModelTools: [] } } },
    ];
    for (const candidate of notAiTools) {
        const result = classifyAiTool(candidate, SELF_EXTENSION_ID);
        assert.equal(result.kind, "none", `${candidate.id} was classified ${result.kind}: ${result.reason}`);
    }
});

test("a routable tool stays routable even though its manifest declares AI", () => {
    // Continue declares categories ["AI", …]. If the manifest rule ran first it
    // would be demoted to unmanaged, and SoterAI would stop claiming the one
    // path it can actually enforce.
    const result = classifyAiTool(
        { id: "continue.continue", packageJSON: { categories: ["AI", "Chat"] } },
        SELF_EXTENSION_ID,
    );
    assert.equal(result.kind, "routable");
});

test("SoterAI declares category AI itself and still must not count", () => {
    const result = classifyAiTool(
        { id: SELF_EXTENSION_ID, packageJSON: { categories: ["AI", "Linters", "Other"] } },
        SELF_EXTENSION_ID,
    );
    assert.equal(result.kind, "none");
});

