/**
 * Guards for two defects found in the pre-publish audit of 0.4.0, both of which
 * were invisible because nothing tested them.
 *
 * 1. The live-scan glob matcher compiled every default exclude into a regex
 *    that matched nothing, so `node_modules`, `dist` and vendored bundles were
 *    scanned on every keystroke.
 * 2. Every `soterai.*` setting was `window`-scoped, letting a repository's own
 *    `.vscode/settings.json` disable protection or repoint the broker upstream.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const liveScannerSrc = readFileSync(join(extensionRoot, "src", "diagnostics", "LiveScanner.ts"), "utf8");

/**
 * Mirror of `matchesGlob` in LiveScanner.ts. The real one is module-private and
 * the module imports `vscode`, so it cannot be loaded outside an extension
 * host. The copy is kept honest by `stays in sync with LiveScanner.ts` below.
 */
function globToRegExp(glob: string): RegExp {
    const normalized = glob.replace(/\\/g, "/");
    let out = "^";
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === "*") {
            if (normalized[i + 1] === "*") {
                if (normalized[i + 2] === "/") {
                    out += "(?:.*/)?";
                    i += 2;
                } else {
                    out += ".*";
                    i += 1;
                }
            } else {
                out += "[^/]*";
            }
        } else if (ch === "?") {
            out += "[^/]";
        } else {
            out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(out + "$");
}

function matchesGlob(path: string, glob: string): boolean {
    try {
        return globToRegExp(glob).test(path.replace(/\\/g, "/"));
    } catch {
        return false;
    }
}

describe("LiveScanner exclude globs actually exclude", () => {
    it("matches every shipped default exclude against a path it must skip", () => {
        const defaults: string[] =
            manifest.contributes.configuration.properties["soterai.scan.excludeGlobs"].default;
        // One representative path per shipped pattern. If a default is added
        // without a case here, this test fails rather than silently skipping it.
        const samples: Record<string, string> = {
            "**/node_modules/**": "packages/app/node_modules/left-pad/index.js",
            "**/.git/**": ".git/config",
            "**/dist/**": "packages/app/dist/bundle.js",
            "**/build/**": "build/output.js",
            "**/*.bin": "assets/model.bin",
            "**/*.exe": "tools/setup.exe",
            "**/*.zip": "release/archive.zip",
            "**/*.png": "media/icon.png",
            "**/*.jpg": "media/photo.jpg",
        };
        assert.deepEqual(
            Object.keys(samples).sort(),
            [...defaults].sort(),
            "every default exclude glob needs a sample path in this test",
        );
        for (const [glob, path] of Object.entries(samples)) {
            assert.equal(matchesGlob(path, glob), true, `glob ${glob} failed to match ${path}`);
        }
    });

    it("matches a top-level path with the leading **/ segment absent", () => {
        // `**/` means "zero or more leading segments" — the zero case is the
        // one the previous implementation got wrong.
        assert.equal(matchesGlob("node_modules/pkg/index.js", "**/node_modules/**"), true);
        assert.equal(matchesGlob("dist/main.js", "**/dist/**"), true);
    });

    it("does not over-match source files that must still be scanned", () => {
        assert.equal(matchesGlob("src/index.ts", "**/node_modules/**"), false);
        assert.equal(matchesGlob("src/dist-helper.ts", "**/dist/**"), false);
        assert.equal(matchesGlob("src/app.ts", "**/*.bin"), false);
        // A single * must not cross a separator.
        assert.equal(matchesGlob("src/a/b.ts", "src/*.ts"), false);
        assert.equal(matchesGlob("src/b.ts", "src/*.ts"), true);
    });

    it("treats an uncompilable pattern as non-matching instead of throwing", () => {
        assert.doesNotThrow(() => matchesGlob("src/a.ts", "src/(("));
        assert.equal(matchesGlob("src/a.ts", "src/(("), false);
    });

    it("stays in sync with LiveScanner.ts", () => {
        // The mirror above is only trustworthy if it is byte-equivalent to the
        // shipped function. A substring check like /function globToRegExp/ is
        // not enough — it still matches a renamed or rewritten variant. Compare
        // the actual bodies instead, normalized for comments and whitespace.
        const start = liveScannerSrc.indexOf("function globToRegExp(glob: string): RegExp {");
        assert.notEqual(start, -1, "globToRegExp is gone from LiveScanner.ts — the mirror is now fiction");

        // Walk braces to find the real end of the function.
        let depth = 0;
        let end = -1;
        for (let i = liveScannerSrc.indexOf("{", start); i < liveScannerSrc.length; i++) {
            if (liveScannerSrc[i] === "{") depth++;
            else if (liveScannerSrc[i] === "}") {
                depth--;
                if (depth === 0) { end = i + 1; break; }
            }
        }
        assert.notEqual(end, -1, "could not find the end of globToRegExp");

        const normalize = (s: string) =>
            s.replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
                .replace(/\/\/[^\n]*/g, "")      // line comments
                .replace(/:\s*(RegExp|string)\b/g, "") // TS annotations the mirror loses at runtime
                .replace(/\s+/g, "")
                // tsx's transpiled toString() drops statement-terminating
                // semicolons; they carry no logic, so normalize them away.
                .replace(/;/g, "");

        const shipped = normalize(liveScannerSrc.slice(start, end));
        const mirror = normalize(globToRegExp.toString());
        assert.equal(
            mirror,
            shipped,
            "the mirror in this test has drifted from LiveScanner.ts — the glob assertions above no longer prove anything about shipped behavior",
        );
    });
});

describe("configuration scope — a workspace cannot disable protection", () => {
    const props = manifest.contributes.configuration.properties as Record<
        string,
        { scope?: string }
    >;

    // Setting any of these from a repo's .vscode/settings.json would either
    // turn a protection off or change where the user's data goes.
    const MUST_BE_MACHINE = [
        "soterai.protection.enabled",
        "soterai.liveScan.enabled",
        "soterai.sentinel.enabled",
        "soterai.protectedWorkspace.enabled",
        "soterai.mcpFirewall.strictMode",
        "soterai.broker.openAIProviderUrl",
        "soterai.broker.anthropicProviderUrl",
        "soterai.broker.port",
        "soterai.cloud.enabled",
        "soterai.cloud.baseUrl",
        "soterai.privacyMode",
        "soterai.policy.mode",
        "soterai.audit.storeRawPrompts",
        "soterai.telemetry.redactedEvents",
        "soterai.sensitiveContext.allowRawReveal",
        "soterai.sensitiveContext.requireApproval",
        "soterai.sensitiveContext.defaultAction",
        "soterai.sensitiveContext.ttlMinutes",
        "soterai.scan.remoteEscalation",
        "soterai.terminal.protectionMode",
        "soterai.terminal.warnOnRawTerminalOpen",
        "soterai.sentinel.retentionDays",
        "soterai.dependencyGuard.osvMode",
    ];

    for (const key of MUST_BE_MACHINE) {
        it(`${key} is machine-scoped`, () => {
            assert.ok(props[key], `${key} is missing from the manifest`);
            assert.equal(
                props[key].scope,
                "machine",
                `${key} is workspace-overridable — a hostile repo could set it`,
            );
        });
    }

    it("declares the same keys as restricted in untrusted workspaces", () => {
        const restricted: string[] =
            manifest.capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
        for (const key of MUST_BE_MACHINE) {
            assert.ok(
                restricted.includes(key),
                `${key} missing from restrictedConfigurations — it would still apply in Restricted Mode`,
            );
        }
    });

    it("keeps the untrusted-workspace support level declared", () => {
        assert.equal(manifest.capabilities?.untrustedWorkspaces?.supported, "limited");
    });

    /**
     * The other half of machine-scoping: VS Code THROWS on a Workspace-target
     * write to a machine-scoped key. Hardening the manifest turned one existing
     * `ConfigurationTarget.Workspace` call (the secret-handling-policy picker)
     * into a runtime crash. This scans the source so the next one is caught at
     * test time rather than by a user whose command threw.
     */
    it("never writes a machine-scoped key to Workspace or WorkspaceFolder", () => {
        const srcRoot = join(extensionRoot, "src");
        const files: string[] = [];
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (statSync(full).isDirectory()) walk(full);
                else if (entry.endsWith(".ts")) files.push(full);
            }
        };
        walk(srcRoot);

        const offenders: string[] = [];
        for (const file of files) {
            const text = readFileSync(file, "utf8");
            // `.update("<key>", <value>, ... ConfigurationTarget.Workspace...)`
            const re = /\.update\(\s*["'`]([\w.]+)["'`][\s\S]{0,200}?ConfigurationTarget\.(Workspace|WorkspaceFolder)\b/g;
            for (const m of text.matchAll(re)) {
                const key = `soterai.${m[1]}`;
                if (MUST_BE_MACHINE.includes(key)) {
                    offenders.push(`${file.slice(extensionRoot.length + 1)} → ${key} (${m[2]})`);
                }
            }
        }
        assert.deepEqual(
            offenders,
            [],
            `machine-scoped key written to a workspace target; VS Code throws:\n${offenders.join("\n")}`,
        );
    });
});
