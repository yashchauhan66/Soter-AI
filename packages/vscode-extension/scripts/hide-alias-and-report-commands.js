// One-shot manifest edit for Gap 5 (kept in scripts/ so the change is reviewable
// and repeatable rather than a hand-edit across ~30 palette entries).
//
// It sets `when: "false"` — VS Code's way of hiding a command from the Command
// Palette — on every deprecated alias and every individual report command, while
// leaving `contributes.commands` untouched so all of them stay registered and
// callable by keybindings, tasks and other extensions.
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "package.json");
const raw = fs.readFileSync(manifestPath, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const manifest = JSON.parse(raw);

const ALIASES = [
    "soterai.scanSelectedText",
    "soterai.scanGitDiff",
    "soterai.reviewTerminalCommand",
    "soterai.choosePolicyPack",
    "soterai.openSecurityPanel",
    "soterai.scanMCPAgentTools",
    "soterai.openAIActivityLedger",
    "soterai.generateCanaryToken",
];

const REPORTS = [
    "soterai.showCoverageMatrix",
    "soterai.showWhatAISaw",
    "soterai.showWhatAISawLastSession",
    "soterai.showAITimeline",
    "soterai.showFileReadLog",
    "soterai.showBlockedAIContext",
    "soterai.showProtectedFiles",
    "soterai.showWorkspaceRiskScore",
    "soterai.showAIExtensions",
    "soterai.showMCPToolPermissions",
    "soterai.showActiveAIApprovals",
    "soterai.showBrokerStatus",
    "soterai.showRuntimeCapabilitySummary",
    "soterai.showAISafeModeRules",
    "soterai.showEgressFirewallStatus",
    "soterai.showMemoryPoisoningFindings",
    "soterai.showExtensionIsolationSummary",
    "soterai.verifyNoCanaryInLogs",
];

const hide = new Set([...ALIASES, ...REPORTS]);
const palette = manifest.contributes.menus.commandPalette;
const declared = new Set(manifest.contributes.commands.map((c) => c.command));

const missing = [...hide].filter((id) => !declared.has(id));
if (missing.length) {
    console.error(`Refusing to edit: not declared in contributes.commands: ${missing.join(", ")}`);
    process.exit(1);
}

let changed = 0;
for (const id of hide) {
    const entry = palette.find((e) => e.command === id);
    if (entry) {
        if (entry.when !== "false") {
            entry.when = "false";
            changed++;
        }
    } else {
        palette.push({ command: id, when: "false" });
        changed++;
    }
}

// `soterai.openReport` is the one row that replaces them, so it must be visible
// by default rather than gated behind the advanced-commands context key. The same
// applies to any canonical command whose alias used to hold the visible slot:
// hiding the alias without promoting the canonical would remove the workflow from
// the default palette entirely.
const PROMOTE_TO_DEFAULT = ["soterai.openReport", "soterai.scanGitChanges"];
for (const id of PROMOTE_TO_DEFAULT) {
    if (!declared.has(id)) continue;
    const index = palette.findIndex((e) => e.command === id);
    if (index >= 0) {
        palette.splice(index, 1);
        changed++;
    }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4).replace(/\n/g, eol) + eol, "utf8");
console.log(`palette entries updated: ${changed}`);
