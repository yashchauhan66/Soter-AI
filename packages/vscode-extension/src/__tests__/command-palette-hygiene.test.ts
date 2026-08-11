/**
 * Command Palette hygiene.
 *
 * Two defects found in the 0.4.0 pre-publish audit, both user-visible and both
 * invisible to every existing test because nothing asserted on titles:
 *
 * 1. 47 of 158 commands declared BOTH `category: "SoterAI"` and a title
 *    beginning with "SoterAI:". VS Code renders `category: title`, so those
 *    commands appeared in the palette as "SoterAI: SoterAI: Open Control Panel".
 * 2. `soterai.clearAIApprovals` and `soterai.clearApprovals` shared the title
 *    "Clear AI Approvals" — two identical palette rows doing different things
 *    (one clears broker-side approvals over HTTP, the other clears the local
 *    permission store), with no way for a user to tell them apart.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

type Command = { command: string; title: string; category?: string; enablement?: string };
const commands: Command[] = manifest.contributes.commands;

/** What VS Code actually shows in the Command Palette. */
function paletteText(c: Command): string {
    return c.category ? `${c.category}: ${c.title}` : c.title;
}

describe("Command Palette hygiene", () => {
    it("has commands to check", () => {
        assert.ok(commands.length > 100, `expected the full command surface, saw ${commands.length}`);
    });

    it("never renders the SoterAI prefix twice", () => {
        const doubled = commands.filter((c) => c.category && /^SoterAI:/i.test(c.title));
        assert.deepEqual(
            doubled.map(paletteText),
            [],
            "category + a prefixed title renders as 'SoterAI: SoterAI: …' in the palette",
        );
    });

    it("gives every command the SoterAI category so it is findable by typing 'soterai'", () => {
        const uncategorized = commands.filter((c) => c.category !== "SoterAI");
        assert.deepEqual(
            uncategorized.map((c) => c.command),
            [],
            "a command with no category is unbranded in the palette",
        );
    });

    it("gives no two commands the same palette text", () => {
        const seen = new Map<string, string[]>();
        for (const c of commands) {
            const text = paletteText(c);
            if (!seen.has(text)) seen.set(text, []);
            seen.get(text)!.push(c.command);
        }
        const collisions = [...seen.entries()]
            .filter(([, ids]) => ids.length > 1)
            .map(([text, ids]) => `"${text}" <- ${ids.join(", ")}`);
        assert.deepEqual(
            collisions,
            [],
            "identical palette rows leave the user guessing which one acts on what",
        );
    });

    it("keeps every title free of leading/trailing whitespace and empty titles", () => {
        for (const c of commands) {
            assert.ok(c.title.length > 0, `${c.command} has an empty title`);
            assert.equal(c.title, c.title.trim(), `${c.command} title has stray whitespace`);
        }
    });

    it("declares every command in contributes.commands exactly once", () => {
        const ids = commands.map((c) => c.command);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        assert.deepEqual(dupes, [], "a duplicated command id makes the later declaration silently win");
    });
});

/**
 * VS Code generates an `onCommand:` activation event for every contributed
 * command since 1.74, so listing them by hand is dead weight that drifts: the
 * manifest carried 27 of them for 158 commands, meaning 131 commands were
 * already relying on the generated behaviour and nobody noticed the other 27
 * were redundant. The floor this extension supports (`engines.vscode ^1.85.0`)
 * is above 1.74, so the generated events apply to every host we run on.
 */
describe("activationEvents stay minimal", () => {
    const events: string[] = manifest.activationEvents;

    it("lists no onCommand: events, because VS Code generates them", () => {
        assert.deepEqual(
            events.filter((e) => e.startsWith("onCommand:")),
            [],
            "hand-listed onCommand: events are redundant since VS Code 1.74",
        );
    });

    it("keeps the events that are NOT generated", () => {
        // These have no generated equivalent — dropping any of them silently
        // stops the extension from starting in that situation.
        for (const required of [
            "onStartupFinished",
            "workspaceContains:.soterai-policy.json",
            "onWalkthrough:soterai.gettingStarted",
        ]) {
            assert.ok(events.includes(required), `${required} has no generated equivalent and must stay`);
        }
    });

    it("still activates eagerly, because a lazily-activated security guard protects nothing", () => {
        assert.ok(
            events.includes("onStartupFinished"),
            "without eager activation, live scanning and the sentinel only start after a user runs a command",
        );
    });
});
