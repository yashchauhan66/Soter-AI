/**
 * GAP 5 — 162 commands is a liability when the user cannot navigate them.
 *
 * Three concrete defects, all visible in the palette:
 *
 * 1. Six duplicate pairs, both halves registered AND both palette-listed:
 *    `scanSelection`/`scanSelectedText`, `scanGitDiff`/`scanGitChanges`,
 *    `checkTerminalCommand`/`reviewTerminalCommand`,
 *    `scanClipboard`/`scanClipboardAICode`, `configurePolicy`/`choosePolicyPack`,
 *    `openSecurityPanel`/`openControlPanel`. Half of each pair is a thin alias
 *    that forwards to the other, so a user reading the palette picked between
 *    two rows that did the same thing.
 * 2. Eighteen `show*` commands, which means a user must already know which
 *    report they want before they can look at anything.
 * 3. The README advertised "162 commands" as a feature.
 *
 * The rule this suite enforces: an alias stays **registered forever** — another
 * extension's `executeCommand`, a user keybinding, or a task may reference it,
 * and removing it is a silent break — but it leaves the palette, so the palette
 * offers each workflow exactly once.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPORT_PICKS } from "../reports/reportCatalog";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

type Command = { command: string; title: string; category?: string };
const commands: Command[] = manifest.contributes.commands;
const declared = new Set(commands.map((c) => c.command));
const paletteEntries: { command: string; when?: string }[] = manifest.contributes.menus.commandPalette;
const paletteByCommand = new Map(paletteEntries.map((entry) => [entry.command, entry]));

/**
 * Canonical command ← deprecated alias. Every alias here forwards to its
 * canonical in `launchCommands.ts` or elsewhere; none of them is a distinct
 * behaviour, which is why one palette row is the correct number.
 */
const DUPLICATE_ALIASES: Record<string, string> = {
    "soterai.scanSelectedText": "soterai.scanSelection",
    "soterai.scanGitDiff": "soterai.scanGitChanges",
    "soterai.reviewTerminalCommand": "soterai.checkTerminalCommand",
    "soterai.choosePolicyPack": "soterai.applyPolicyPack",
    "soterai.openSecurityPanel": "soterai.openControlPanel",
    "soterai.scanMCPAgentTools": "soterai.scanMCPConfigs",
    "soterai.openAIActivityLedger": "soterai.openAILedger",
    "soterai.generateCanaryToken": "soterai.generateCanary",
};

/** `when: false` is how VS Code hides a command from the palette entirely. */
function hiddenFromPalette(id: string): boolean {
    const entry = paletteByCommand.get(id);
    return entry?.when === "false";
}

describe("deprecated aliases stay callable but leave the palette", () => {
    for (const [alias, canonical] of Object.entries(DUPLICATE_ALIASES)) {
        it(`${alias} is still declared and registered, so nothing that calls it breaks`, () => {
            assert.ok(declared.has(alias), `${alias} was removed; a keybinding or task referencing it now fails`);
            assert.ok(declared.has(canonical), `${canonical} (the canonical command) is missing`);
        });

        it(`${alias} is hidden from the palette in favour of ${canonical}`, () => {
            assert.ok(
                hiddenFromPalette(alias),
                `${alias} still appears in the palette alongside ${canonical}; ` +
                    `two rows that run the same handler make the user guess`,
            );
        });

        it(`${canonical} is the one the palette offers`, () => {
            assert.ok(!hiddenFromPalette(canonical), `${canonical} is hidden, leaving the workflow unreachable`);
        });
    }
});

describe("no two palette-visible commands describe the same workflow", () => {
    /** Title, normalised: case, punctuation and filler words removed. */
    function normalise(command: Command): string {
        return command.title
            .toLowerCase()
            .replace(/\([^)]*\)/g, "")
            .replace(/\b(the|a|an|for|before|as|of|my|all)\b/g, "")
            .replace(/[^a-z0-9]+/g, "");
    }

    it("gives every visible command a distinct normalised title", () => {
        const visible = commands.filter((c) => !hiddenFromPalette(c.command));
        const seen = new Map<string, string[]>();
        for (const command of visible) {
            const key = normalise(command);
            if (!seen.has(key)) seen.set(key, []);
            seen.get(key)!.push(command.command);
        }
        const collisions = [...seen.entries()]
            .filter(([, ids]) => ids.length > 1)
            .map(([key, ids]) => `"${key}" <- ${ids.join(", ")}`);
        assert.deepEqual(collisions, [], `near-identical palette rows:\n${collisions.join("\n")}`);
    });
});

describe("one Open Report entry point replaces eighteen show* rows", () => {
    it("offers a quick pick that lists the reports", () => {
        assert.ok(declared.has("soterai.openReport"), "soterai.openReport must be declared");
        assert.ok(REPORT_PICKS.length >= 10, `expected the report catalogue, saw ${REPORT_PICKS.length}`);
    });

    it("points every catalogue entry at a command that exists", () => {
        for (const pick of REPORT_PICKS) {
            assert.ok(declared.has(pick.command), `report catalogue lists undeclared ${pick.command}`);
        }
    });

    it("describes each report in one line, so the user can choose without guessing", () => {
        for (const pick of REPORT_PICKS) {
            assert.ok(pick.label.length > 0, `${pick.command} has no label`);
            assert.ok(pick.description.length > 0, `${pick.command} has no one-line description`);
            assert.ok(
                !pick.label.startsWith("Show "),
                `${pick.command} label "${pick.label}" still reads as a command name rather than a report`,
            );
        }
    });

    it("keeps every individual report command registered for automation", () => {
        // Collapsing the palette must not remove a command another extension, a
        // task, or a keybinding may already invoke.
        for (const pick of REPORT_PICKS) {
            assert.ok(declared.has(pick.command), `${pick.command} was removed rather than hidden`);
        }
    });

    it("lists no duplicate command in the catalogue", () => {
        const ids = REPORT_PICKS.map((pick) => pick.command);
        const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
        assert.deepEqual(dupes, [], `report catalogue lists ${dupes.join(", ")} twice`);
    });

    it("hides the individual report commands it replaces", () => {
        const stillVisible = REPORT_PICKS.filter((pick) => !hiddenFromPalette(pick.command)).map((p) => p.command);
        assert.deepEqual(
            stillVisible,
            [],
            `these reports are reachable from Open Report and still occupy their own palette row: ${stillVisible.join(", ")}`,
        );
    });
});

describe("the README stops advertising a command count", () => {
    const readme = readFileSync(join(extensionRoot, "README.md"), "utf8");

    it("does not sell the raw number of commands as a feature", () => {
        // "162 commands" reads to a reviewer as an unfinished product, and the
        // number is meaningless to a user who can reach ten of them.
        assert.doesNotMatch(
            readme,
            /\b\d{2,}\s+commands\b/,
            "the README still advertises a command count instead of the workflows a user performs",
        );
    });
});
