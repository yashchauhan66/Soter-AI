/**
 * Runs the AI-tool census over the extension ids really installed on this
 * machine, read straight off disk (no editor launch). It exists to answer the
 * one question a synthetic fixture cannot: what does the Control Panel now say
 * on the machine that reported "0 of 32 detected AI tools"?
 *
 * Usage: node --import tsx scripts/census-real-machine.ts [extensionsDir]
 */
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SELF_EXTENSION_ID, censusAiTools, classifyAiTool, type AiToolCandidate } from "../src/protection/AiToolRegistry";

/**
 * `vscode.extensions.all` includes the ~65 built-in extensions as well as the
 * user's own, so both roots are read here. Leaving the built-ins out would
 * flatter both classifiers: they are 65 extensions known not to be AI tools.
 */
const roots = process.argv.slice(2);
if (roots.length === 0) {
    roots.push(join(homedir(), ".vscode", "extensions"));
    roots.push(join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code", "resources", "app", "extensions"));
}

interface Installed extends AiToolCandidate {
    displayName: string;
    description: string;
    builtin: boolean;
}

const byId = new Map<string, Installed>();
for (const root of roots) {
    let entries;
    try {
        entries = readdirSync(root, { withFileTypes: true });
    } catch { console.log(`(skipped unreadable root ${root})`); continue; }
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        let packageJSON: any;
        try {
            packageJSON = JSON.parse(readFileSync(join(root, entry.name, "package.json"), "utf8"));
        } catch { continue; }
        const builtin = root.replace(/\\/g, "/").includes("/resources/app/extensions");
        const id = (packageJSON.publisher ? `${packageJSON.publisher}.${packageJSON.name}` : entry.name).toLowerCase();
        byId.set(id, {
            id,
            packageJSON,
            displayName: String(packageJSON.displayName ?? ""),
            description: String(packageJSON.description ?? ""),
            builtin,
        });
    }
}
const candidates = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

/** The exact pre-fix detector, recovered from git (ProtectionStateService@HEAD). */
const OLD_RULE = /ai|copilot|claude|cursor|codeium|continue|tabnine|windsurf/i;
const oldDetected = candidates.filter((c) => OLD_RULE.test(`${c.id} ${c.displayName} ${c.description}`));

const census = censusAiTools(candidates, SELF_EXTENSION_ID);
const newKind = (id: string) => classifyAiTool(byId.get(id)!, SELF_EXTENSION_ID).kind;

console.log(`extensions visible to the extension host: ${candidates.length} (${candidates.filter((c) => c.builtin).length} built-in)`);
console.log(`OLD detector counted: ${oldDetected.length}`);
console.log(`NEW routable (${census.routable.length}):`);
for (const item of census.routable) console.log(`  ${item.id} — ${item.reason}`);
console.log(`NEW unmanaged (${census.unmanaged.length}):`);
for (const item of census.unmanaged) console.log(`  ${item.id} — ${item.reason}`);

const falsePositives = oldDetected.filter((c) => newKind(c.id) === "none");
console.log(`\nold count that were NOT AI tools (${falsePositives.length}):`);
for (const item of falsePositives) console.log(`  ${item.id}${item.builtin ? " [built-in]" : ""}`);
const missedByOld = candidates.filter((c) => newKind(c.id) !== "none" && !oldDetected.includes(c));
console.log(`real AI tools the old detector MISSED (${missedByOld.length}): ${missedByOld.map((c) => c.id).join(", ") || "none"}`);
const builtinFlagged = candidates.filter((c) => c.builtin && newKind(c.id) !== "none");
console.log(`built-ins the NEW classifier flags (${builtinFlagged.length}): ${builtinFlagged.map((c) => c.id).join(", ") || "none"}`);
