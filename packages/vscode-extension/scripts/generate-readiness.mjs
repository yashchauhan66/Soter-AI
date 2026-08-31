// GAP 6 — every quantitative claim in the readiness doc is produced here, from
// source, and asserted by `readiness-doc.test.ts`.
//
// The defect this replaces: `docs/vscode-extension-marketplace-readiness.md` was
// hand-maintained and said v0.1.0, "all 100 commands" and "License: MIT" while
// the shipped package was 0.5.0 with 162 commands and
// `SEE LICENSE IN LICENSE.md`. It is in the public repo the marketplace listing
// links to, so a reviewer finds the contradiction before a customer does — and it
// invalidates the honest claims that ARE true.
//
// Usage:
//   node scripts/generate-readiness.mjs          # write the doc
//   node scripts/generate-readiness.mjs --check  # exit 1 if the doc has drifted
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(extensionRoot, "..", "..");
const guardCoreDetectors = join(repoRoot, "packages", "guard-core", "src", "detectors");
const outputPath = join(repoRoot, "docs", "vscode-extension-readiness.md");

const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

/** Every fact in the document, each traceable to the file it was read from. */
export function collectFacts() {
    const contributes = manifest.contributes;
    const settings = contributes.configuration.properties;
    const palette = contributes.menus.commandPalette ?? [];
    const paletteByCommand = new Map(palette.map((entry) => [entry.command, entry]));

    const commandIds = contributes.commands.map((command) => command.command);
    const hidden = commandIds.filter((id) => paletteByCommand.get(id)?.when === "false");
    const gated = commandIds.filter((id) => paletteByCommand.get(id)?.when === "soterai.advancedCommands");
    const defaultVisible = commandIds.filter((id) => !paletteByCommand.has(id));

    // Detector modules and their declared rule count. `pattern:` is the shape
    // every rule table in guard-core uses, so counting it counts rules rather
    // than counting regex literals used for other purposes.
    const detectorFiles = readdirSync(guardCoreDetectors)
        .filter((name) => name.endsWith("Detector.ts"))
        .sort();
    const detectors = detectorFiles.map((name) => {
        const source = readFileSync(join(guardCoreDetectors, name), "utf8");
        return { name: name.replace(/\.ts$/, ""), rules: (source.match(/pattern:\s*\//g) ?? []).length };
    });

    const restricted = manifest.capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
    const settingEntries = Object.entries(settings);

    return {
        name: manifest.name,
        version: manifest.version,
        publisher: manifest.publisher,
        license: manifest.license,
        engine: manifest.engines.vscode,
        main: manifest.main,
        activationEvents: manifest.activationEvents,
        commandCount: commandIds.length,
        paletteDefaultVisible: defaultVisible.length,
        paletteGated: gated.length,
        paletteHidden: hidden.length,
        settingCount: settingEntries.length,
        machineScoped: settingEntries.filter(([, value]) => value.scope === "machine").length,
        policyPinnable: settingEntries.filter(([, value]) => Boolean(value.policy)).length,
        restrictedCount: restricted.length,
        keybindings: (contributes.keybindings ?? []).length,
        menuGroups: Object.keys(contributes.menus ?? {}).filter((key) => key !== "commandPalette"),
        viewsWelcome: (contributes.viewsWelcome ?? []).length,
        languageModelTools: (contributes.languageModelTools ?? []).map((tool) => tool.name),
        mcpProviders: (contributes.mcpServerDefinitionProviders ?? []).map((provider) => provider.id),
        walkthroughSteps: (contributes.walkthroughs?.[0]?.steps ?? []).length,
        detectors,
        detectorTotal: detectors.reduce((sum, detector) => sum + detector.rules, 0),
    };
}

/** Render the document. Nothing here is typed by hand except the prose. */
export function renderReadiness(facts) {
    const lines = [];
    const push = (...text) => lines.push(...text);

    push(
        "<!-- GENERATED FILE — do not edit.",
        "     Produced by packages/vscode-extension/scripts/generate-readiness.mjs and",
        "     asserted by src/__tests__/readiness-doc.test.ts. Every number below was",
        "     read from the manifest or from guard-core source at generation time.",
        "     Run `node scripts/generate-readiness.mjs` after changing either. -->",
        "",
        "# SoterAI IDE Guard — readiness",
        "",
        `**Package:** \`${facts.name}\` v${facts.version} · publisher \`${facts.publisher}\``,
        `**License:** \`${facts.license}\``,
        `**Editor floor:** \`${facts.engine}\` — kept deliberately low so Cursor, Windsurf, Kiro and Antigravity stay supported.`,
        `**Entry point:** \`${facts.main}\` (single esbuild bundle; no \`node_modules\` in the VSIX)`,
        "",
        "## Command surface",
        "",
        "| Measure | Count |",
        "| --- | --- |",
        `| Commands declared and registered | ${facts.commandCount} |`,
        `| Visible in the palette by default | ${facts.paletteDefaultVisible} |`,
        `| Behind \`soterai.showAllCommands\` | ${facts.paletteGated} |`,
        `| Hidden from the palette (aliases, reports, internal) | ${facts.paletteHidden} |`,
        "",
        "Hidden commands remain **registered**: a keybinding, task or another",
        "extension's `executeCommand` that references one keeps working. They are",
        "hidden because a second palette row for the same workflow makes the user",
        "guess which one acts.",
        "",
        "## Where the product meets the user",
        "",
        "| Surface | Detail |",
        "| --- | --- |",
        `| Non-palette menu groups | ${facts.menuGroups.join(", ")} |`,
        `| Keybindings | ${facts.keybindings} |`,
        `| View welcome messages | ${facts.viewsWelcome} |`,
        `| Walkthrough steps | ${facts.walkthroughSteps} |`,
        `| Activation | ${facts.activationEvents.join(", ")} |`,
        "",
        "## Agent-facing surfaces",
        "",
        `- Language model tools: ${facts.languageModelTools.map((name) => `\`${name}\``).join(", ") || "none"}`,
        `- MCP server definition providers: ${facts.mcpProviders.map((id) => `\`${id}\``).join(", ") || "none"}`,
        "",
        "Both are feature-detected. On an editor without `vscode.lm` they register",
        "nothing rather than throwing. **They are advisory:** they answer questions an",
        "agent chooses to ask, and no extension API can force the call or intercept",
        "what an agent does on its own.",
        "",
        "## Settings and central management",
        "",
        "| Measure | Count |",
        "| --- | --- |",
        `| Settings declared | ${facts.settingCount} |`,
        `| \`machine\`-scoped (a repo cannot set them) | ${facts.machineScoped} |`,
        `| Restricted in untrusted workspaces | ${facts.restrictedCount} |`,
        `| Pinnable by an administrator (\`policy\`) | ${facts.policyPinnable} |`,
        "",
        "## Detection engine",
        "",
        "| Detector | Rules |",
        "| --- | --- |",
        ...facts.detectors.map((detector) => `| \`${detector.name}\` | ${detector.rules} |`),
        `| **Total** | **${facts.detectorTotal}** |`,
        "",
        `All ${facts.detectors.length} detectors are deterministic regex/heuristic rules, bundled inline.`,
        "**No ML model ships in the VSIX.** `onnxruntime` appears zero times in",
        "`dist/extension.js`; the ONNX classifier is server-side only. Any extension-",
        "facing claim of ML capability is a defect.",
        "",
        "## What this product does not do",
        "",
        "- It cannot intercept another extension's network calls. VS Code exposes no",
        "  such API, so GitHub Copilot is classified `unmanaged` and stays that way.",
        "- Terminal commands are detected **after** the shell starts them. That path is",
        "  `MONITORED`; only the broker's controlled terminal blocks before execution.",
        "- Anything not routed through the local broker is advisory, and every surface",
        "  says so rather than showing `ENFORCED`.",
        "",
    );
    return lines.join("\n") + "\n";
}

const facts = collectFacts();
const rendered = renderReadiness(facts);

if (process.argv.includes("--check")) {
    let current = "";
    try {
        current = readFileSync(outputPath, "utf8");
    } catch {
        console.error(`Missing ${outputPath}. Run: node scripts/generate-readiness.mjs`);
        process.exit(1);
    }
    if (current.replace(/\r\n/g, "\n") !== rendered) {
        console.error(`${outputPath} has drifted from the source. Run: node scripts/generate-readiness.mjs`);
        process.exit(1);
    }
    console.log("readiness doc is in sync");
} else {
    writeFileSync(outputPath, rendered, "utf8");
    console.log(`wrote ${outputPath}`);
}
