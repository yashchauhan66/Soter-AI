/**
 * There must be exactly ONE sensitive-file list, in guard-core.
 *
 * This list lived in SEVEN places across the extension and they had drifted —
 * different coverage each, and none included an agent's own credential config
 * (`.claude/settings.json`, `.cursor/mcp.json`). They are now all wired to
 * `@soterai/guard-core`'s canonical `SENSITIVE_FILE_GLOBS` / `isSensitiveFilePath`.
 *
 * This test fails the build if a module re-introduces a local copy. It looks for
 * the telltale shapes — a `**\/`-prefixed secret glob, or a secret-file basename
 * regex — anywhere in the extension source outside the deliberate exceptions:
 *
 *   - PolicyPacks.ts: per-compliance-pack `protectedPatterns` are intentionally
 *     DIFFERENT lists (a feature — a PCI pack guards different files than a
 *     HIPAA pack). They use the unprefixed `.env*` form, not `**\/.env`.
 *   - AISentinel.ts: keeps instruction/manifest globs (CLAUDE.md, package.json)
 *     — a poisoning/dependency concern, not secrets. Those contain no secret
 *     glob, so they do not trip the patterns below.
 *
 * If this fails, do not add your file to the allowlist — import the canonical
 * list from guard-core instead.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const srcRoot = join(__dirname, "..");

function allSourceFiles(): string[] {
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                if (entry === "__tests__") continue; // tests may reference literals
                walk(full);
            } else if (entry.endsWith(".ts")) {
                files.push(full);
            }
        }
    };
    walk(srcRoot);
    return files;
}

// The canonical list is authored with `**/`-prefixed globs. A copy anywhere else
// is drift. PolicyPacks uses the unprefixed `.env*` form, so it does not match.
const SECRET_GLOB_COPY = /["'`]\*\*\/(?:\.env|\*\.pem|\*\.key|id_rsa|\.aws\/cred|\.npmrc)/;

describe("sensitive-file list has not been re-forked", () => {
    it("no extension module re-declares the secret-file globs", () => {
        const offenders: string[] = [];
        for (const file of allSourceFiles()) {
            const text = readFileSync(file, "utf8");
            if (SECRET_GLOB_COPY.test(text)) {
                offenders.push(file.slice(srcRoot.length + 1).replace(/\\/g, "/"));
            }
        }
        assert.deepEqual(
            offenders,
            [],
            `these files hardcode a secret-file glob instead of importing SENSITIVE_FILE_GLOBS ` +
                `from @soterai/guard-core:\n${offenders.join("\n")}`,
        );
    });

    it("the proactive guards import the canonical list", () => {
        // Each of these once had its own list; each must now import from guard-core.
        const consumers: Array<[string, RegExp]> = [
            ["secret-shield/AutoVaultMigration.ts", /SENSITIVE_FILE_GLOBS/],
            ["secret-shield/SecretFileInterceptor.ts", /isSensitiveFilePath/],
            ["secret-shield/FileReadSentinel.ts", /isSensitiveFilePath/],
            ["workspace-guard/WorkspaceGuard.ts", /SENSITIVE_FILE_GLOBS/],
            ["sentinel/AISentinel.ts", /isSensitiveFilePath|SENSITIVE_FILE_GLOBS/],
            ["commands.ts", /isSensitiveFilePath/],
        ];
        for (const [rel, symbol] of consumers) {
            const text = readFileSync(join(srcRoot, rel), "utf8");
            assert.ok(
                /from ["']@soterai\/guard-core["']/.test(text) && symbol.test(text),
                `${rel} no longer imports the canonical sensitive-file API from guard-core`,
            );
        }
    });
});
