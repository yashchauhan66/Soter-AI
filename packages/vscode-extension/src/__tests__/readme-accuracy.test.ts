/**
 * The README is the marketplace page. A command or setting named there that
 * does not exist is a user typing into the palette and finding nothing.
 *
 * The 0.4.0 audit found `SoterAI: Open Privacy Guarantee` documented in two
 * places while the real command is `SoterAI: What Stays Local?`. Nothing
 * caught it because no test read the README.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const readme = readFileSync(join(extensionRoot, "README.md"), "utf8");

type Command = { command: string; title: string; category?: string };
const commands: Command[] = manifest.contributes.commands;
const settings = manifest.contributes.configuration.properties as Record<string, { default?: unknown }>;

/**
 * Titles as a user could reasonably write them. VS Code renders
 * "<category>: <title>"; several real titles carry a parenthetical suffix
 * ("Emergency Lockdown (Revoke All Capabilities)") that prose may shorten, so
 * a bare-title form is accepted too.
 */
const knownTitles = new Set<string>();
for (const c of commands) {
    const full = `${c.category ?? "SoterAI"}: ${c.title}`;
    knownTitles.add(full);
    knownTitles.add(full.replace(/\s*\([^)]*\)\s*$/, ""));
}

describe("README accuracy", () => {
    it("names only commands that exist", () => {
        const claimed = [...new Set([...readme.matchAll(/`(SoterAI: [^`]+)`/g)].map((m) => m[1]))];
        assert.ok(claimed.length > 10, `expected the README to document commands, found ${claimed.length}`);

        const missing = claimed.filter((t) => !knownTitles.has(t));
        assert.deepEqual(
            missing,
            [],
            "README documents a command title that is not in contributes.commands — a user typing it finds nothing",
        );
    });

    it("names only settings that exist, with the manifest's real defaults", () => {
        const rows = [...readme.matchAll(/^\| `(soterai\.[\w.]+)` \| ([^|]+) \|/gm)];
        assert.ok(rows.length > 5, `expected a settings table, found ${rows.length} rows`);

        const problems: string[] = [];
        for (const [, key, shownRaw] of rows) {
            if (!settings[key]) {
                problems.push(`${key} is documented but not declared in the manifest`);
                continue;
            }
            const shown = shownRaw.trim().replace(/^`|`$/g, "");
            const real = settings[key].default;
            // Prose descriptions are allowed for array defaults (e.g. exclude globs).
            if (Array.isArray(real)) continue;
            if (String(real) !== shown) {
                problems.push(`${key}: README shows "${shown}", manifest default is "${String(real)}"`);
            }
        }
        assert.deepEqual(problems, [], problems.join("\n"));
    });

    it("does not advertise a version other than the one being published", () => {
        const versions = [...new Set([...readme.matchAll(/\b\d+\.\d+\.\d+\b/g)].map((m) => m[0]))];
        const stale = versions.filter((v) => v !== manifest.version);
        assert.deepEqual(
            stale,
            [],
            `README mentions version(s) ${stale.join(", ")} while package.json is ${manifest.version}`,
        );
    });

    it("points at a license file that ships in the VSIX", () => {
        const referenced = [...readme.matchAll(/\]\(\.\/(LICENSE[\w.]*)\)/g)].map((m) => m[1]);
        assert.ok(referenced.length > 0, "README should link its license");
        for (const file of referenced) {
            assert.doesNotThrow(
                () => readFileSync(join(extensionRoot, file)),
                `README links ./${file} but that file does not exist`,
            );
        }
    });
});
