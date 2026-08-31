/**
 * GAP 6 — the claims/evidence gap in the docs tree.
 *
 * `docs/` holds 150+ hand-maintained reports.
 * `docs/vscode-extension-marketplace-readiness.md` still said v0.1.0, "all 100
 * commands" and "License: MIT" while the shipped package was 0.5.0 with 162
 * commands and `SEE LICENSE IN LICENSE.md`.
 * `SOTERAI-EXTENSION-TESTING-AND-MARKET-ANALYSIS.md` claimed "400+ Detection
 * Rules" and "18 risk types" against 12 bundled detectors and no ML.
 *
 * Those files are in the public repo the marketplace listing links to, so a
 * reviewer finds the contradiction before a customer does — and every honest
 * claim beside them loses its credibility.
 *
 * The fix is structural, not editorial: one canonical readiness document,
 * generated from the manifest and from guard-core source, and this suite fails
 * the moment it drifts. A number produced by a script cannot go stale silently;
 * a number typed by a human always does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const repoRoot = join(extensionRoot, "..", "..");
const generator = join(extensionRoot, "scripts", "generate-readiness.mjs");
const readinessPath = join(repoRoot, "docs", "vscode-extension-readiness.md");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

describe("the canonical readiness doc is generated, not maintained", () => {
    it("exists", () => {
        assert.ok(existsSync(readinessPath), `${readinessPath} is missing; run scripts/generate-readiness.mjs`);
    });

    it("matches what the generator produces from source right now", () => {
        // This is the whole point of Gap 6: drift is caught by a test rather than
        // by a reviewer reading a stale number in a public file.
        assert.doesNotThrow(
            () => execFileSync(process.execPath, [generator, "--check"], { cwd: extensionRoot, stdio: "pipe" }),
            "the readiness doc has drifted from the manifest/source; run: node scripts/generate-readiness.mjs",
        );
    });

    it("says out loud that it is generated", () => {
        const doc = readFileSync(readinessPath, "utf8");
        assert.match(doc, /GENERATED FILE/, "a generated doc that does not say so invites a hand-edit");
        assert.match(doc, /generate-readiness\.mjs/, "the doc must name the script that produces it");
    });
});

describe("the readiness doc states the real, current numbers", () => {
    const doc = readFileSync(readinessPath, "utf8");

    it("names the version being published", () => {
        assert.match(doc, new RegExp(`v${manifest.version.replace(/\./g, "\\.")}`));
    });

    it("names the license that actually ships", () => {
        assert.ok(doc.includes(manifest.license), `doc must state the real license (${manifest.license})`);
        // The old doc said MIT while the manifest said otherwise — the single
        // most quotable contradiction in the repo.
        if (manifest.license !== "MIT") {
            assert.doesNotMatch(doc, /\bMIT\b/, "doc claims MIT while the manifest does not");
        }
    });

    it("states the command count the manifest actually declares", () => {
        const count = manifest.contributes.commands.length;
        assert.match(doc, new RegExp(`\\|\\s*${count}\\s*\\|`), `doc must state ${count} commands`);
    });

    it("states the setting and policy counts the manifest actually declares", () => {
        const properties = manifest.contributes.configuration.properties as Record<
            string,
            { policy?: unknown }
        >;
        const total = Object.keys(properties).length;
        const pinnable = Object.values(properties).filter((property) => property.policy).length;
        assert.match(doc, new RegExp(`Settings declared \\| ${total}`));
        assert.match(doc, new RegExp(`Pinnable by an administrator \\(\`policy\`\\) \\| ${pinnable}`));
    });

    it("claims no ML in the packaged extension", () => {
        assert.match(doc, /No ML model ships in the VSIX/);
    });

    it("keeps the permanent limitations in the document, not just in the code", () => {
        assert.match(doc, /cannot intercept another extension's network calls/);
        assert.match(doc, /only the broker's controlled terminal blocks before execution/i);
    });
});

describe("stale documents do not contradict the shipped product", () => {
    /**
     * Files that were verifiably wrong about this extension. Each is either
     * deleted or archived with a pointer to the generated doc; if one comes back
     * carrying a number, this fails.
     */
    const RETIRED = [
        join(repoRoot, "docs", "vscode-extension-marketplace-readiness.md"),
    ];

    for (const path of RETIRED) {
        it(`${path.split(/[\\/]/).pop()} no longer states a contradicted number`, () => {
            if (!existsSync(path)) return; // deleted is the strongest outcome
            const text = readFileSync(path, "utf8");
            assert.doesNotMatch(text, /\b100 commands\b/, "still claims 100 commands");
            assert.doesNotMatch(text, /License file present \| ✅ \| MIT/, "still claims the license is MIT");
            assert.match(
                text,
                /vscode-extension-readiness\.md/,
                "an archived document must point at the generated one",
            );
        });
    }

    it("no extension-facing document advertises a detection-rule count the source does not back", () => {
        // "400+ Detection Rules" was the specific claim. The generated doc states
        // the real per-detector totals; nothing else may state a bigger number.
        const suspects = [
            join(repoRoot, "SOTERAI-EXTENSION-TESTING-AND-MARKET-ANALYSIS.md"),
        ].filter((path) => existsSync(path));

        for (const path of suspects) {
            const text = readFileSync(path, "utf8");
            // Blockquoted lines are the correction note that *names* the retired
            // claim in order to retract it. Quoting a wrong number to disown it is
            // the opposite of advertising it, so those lines are excluded.
            const advertised = text
                .split(/\r?\n/)
                .filter((line) => !line.trimStart().startsWith(">"))
                .join("\n");
            const claims = [...advertised.matchAll(/\b(\d{3,})\+\s*(?:explicit\s+)?(?:detection\s+)?rules\b/gi)];
            assert.deepEqual(
                claims.map((match) => match[0]),
                [],
                `${path.split(/[\\/]/).pop()} advertises a rule count the source does not back`,
            );
        }
    });
});
