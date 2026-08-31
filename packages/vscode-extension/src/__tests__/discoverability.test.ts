/**
 * Discoverability surfaces: the menus, keybindings and view-welcome content that
 * let a user reach SoterAI *inside* the risky action instead of remembering to
 * open the Command Palette.
 *
 * Written after the 0.5.0 discoverability audit found that `contributes.menus`
 * held exactly one key — `commandPalette` — and that there were zero
 * keybindings, zero `editor/context` items, zero `explorer/context` items, zero
 * `scm/*` items and zero `viewsWelcome` entries.
 *
 * The consequence was concrete: 162 working commands, of which a user could
 * reach 10, and only by recalling that they should be careful. The single most
 * valuable action in the product — check this text before it goes to an AI —
 * depended on the user's memory at exactly the moment users are careless.
 *
 * Every assertion here is about *reaching* a command. None of them permit a new
 * command: a menu that needs a new command id to exist is a menu in the wrong
 * place.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

const declared = new Set<string>(
    manifest.contributes.commands.map((c: { command: string }) => c.command),
);
const menus: Record<string, { command?: string; submenu?: string; when?: string; group?: string }[]> =
    manifest.contributes.menus ?? {};
const submenus: { id: string; label: string }[] = manifest.contributes.submenus ?? [];
const keybindings: { command: string; key: string; mac?: string; when?: string }[] =
    manifest.contributes.keybindings ?? [];
const viewsWelcome: { view: string; contents: string; when?: string }[] =
    manifest.contributes.viewsWelcome ?? [];

/** Every view id this extension contributes, across all containers. */
const viewIds = new Set<string>(
    Object.values(manifest.contributes.views as Record<string, { id: string }[]>)
        .flat()
        .map((view) => view.id),
);

describe("menu surfaces exist at all", () => {
    it("contributes more than just the Command Palette", () => {
        const nonPalette = Object.keys(menus).filter((key) => key !== "commandPalette");
        assert.ok(
            nonPalette.length >= 4,
            `only ${nonPalette.length} non-palette menu groups (${nonPalette.join(", ") || "none"}); ` +
                "a security guard the user must remember to open protects nothing",
        );
    });

    it("puts SoterAI in the editor context menu, where text is selected", () => {
        assert.ok(menus["editor/context"], "no editor/context entry — selecting a secret offers nothing");
    });

    it("puts SoterAI in the explorer context menu, where files are chosen", () => {
        assert.ok(menus["explorer/context"], "no explorer/context entry — right-clicking a .env offers nothing");
    });

    it("puts SoterAI in source control, where secrets get committed", () => {
        const scm = Object.keys(menus).filter((key) => key.startsWith("scm/"));
        assert.ok(scm.length > 0, "no scm/* entry — the last moment before a secret is committed is unguarded");
    });
});

describe("menu entries are wired to real commands", () => {
    it("references only declared commands", () => {
        const problems: string[] = [];
        for (const [group, entries] of Object.entries(menus)) {
            for (const entry of entries) {
                if (!entry.command) continue;
                if (!declared.has(entry.command)) {
                    problems.push(`${group} -> ${entry.command} is not in contributes.commands`);
                }
            }
        }
        assert.deepEqual(problems, [], problems.join("\n"));
    });

    it("references only declared submenus", () => {
        const ids = new Set(submenus.map((s) => s.id));
        const problems: string[] = [];
        for (const [group, entries] of Object.entries(menus)) {
            for (const entry of entries) {
                if (entry.submenu && !ids.has(entry.submenu)) {
                    problems.push(`${group} -> submenu ${entry.submenu} is not declared`);
                }
            }
        }
        assert.deepEqual(problems, [], problems.join("\n"));
    });

    it("gives every submenu at least one item, so it is never an empty arrow", () => {
        for (const submenu of submenus) {
            const items = menus[submenu.id] ?? [];
            assert.ok(items.length > 0, `submenu ${submenu.id} is declared but has no items`);
        }
    });

    it("gates every context-menu entry with a when clause", () => {
        // An ungated entry appears on every right-click in every file type. That
        // is how a security tool becomes the thing users disable.
        const problems: string[] = [];
        for (const [group, entries] of Object.entries(menus)) {
            if (group === "commandPalette") continue;
            for (const entry of entries) {
                const target = entry.command ?? entry.submenu ?? "(unknown)";
                if (!entry.when) problems.push(`${group} -> ${target} has no when clause`);
            }
        }
        assert.deepEqual(problems, [], problems.join("\n"));
    });

    it("gives every view/title command an icon", () => {
        // A `view/title` entry without an icon renders its full title as text in
        // the view toolbar, which overflows the sidebar at any normal width.
        const byId = new Map<string, { icon?: unknown }>(
            manifest.contributes.commands.map((c: { command: string }) => [c.command, c]),
        );
        for (const entry of menus["view/title"] ?? []) {
            if (!entry.command || entry.group !== "navigation" && !entry.group?.startsWith("navigation@")) continue;
            const command = byId.get(entry.command);
            assert.ok(command?.icon, `${entry.command} is in a view/title navigation group with no icon`);
        }
    });
});

describe("keybindings", () => {
    it("binds the two highest-frequency safe actions", () => {
        const bound = keybindings.map((binding) => binding.command);
        for (const required of ["soterai.safePaste", "soterai.checkBeforeSendingToAI"]) {
            assert.ok(bound.includes(required), `${required} has no keybinding`);
        }
    });

    it("stays small, because every binding is taken from the user's own budget", () => {
        assert.ok(
            keybindings.length <= 3,
            `${keybindings.length} keybindings — an extension that claims a chord per feature is a bad neighbour`,
        );
    });

    it("binds only declared commands, and offers a mac chord for each", () => {
        for (const binding of keybindings) {
            assert.ok(declared.has(binding.command), `${binding.command} is bound but not declared`);
            assert.ok(binding.mac, `${binding.command} has no mac binding — ctrl is the wrong modifier there`);
        }
    });

    it("avoids shallow chords that collide with core editor keys", () => {
        for (const binding of keybindings) {
            assert.match(
                binding.key,
                /^(ctrl|shift|alt)\+(ctrl|shift|alt)\+/,
                `${binding.command} uses "${binding.key}" — too shallow to be safe`,
            );
        }
    });
});

describe("view welcome content", () => {
    it("gives an empty view something to say", () => {
        assert.ok(
            viewsWelcome.length > 0,
            "an empty tree view with no welcome content is a dead end for a first-time user",
        );
    });

    it("targets views this extension actually contributes", () => {
        for (const welcome of viewsWelcome) {
            assert.ok(viewIds.has(welcome.view), `viewsWelcome targets unknown view ${welcome.view}`);
        }
    });

    it("offers a runnable command link, not just prose", () => {
        for (const welcome of viewsWelcome) {
            const links = [...welcome.contents.matchAll(/\(command:([\w.]+)\)/g)].map((m) => m[1]);
            assert.ok(links.length > 0, `viewsWelcome for ${welcome.view} has no command link`);
            for (const link of links) {
                // Built-in commands (workbench.*, vscode.*) are the host's to
                // guarantee; only our own ids can rot when a command is renamed.
                if (!link.startsWith("soterai.")) continue;
                assert.ok(declared.has(link), `viewsWelcome for ${welcome.view} links undeclared ${link}`);
            }
        }
    });
});

