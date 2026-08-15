#!/usr/bin/env node
// Which contributed commands does a real VS Code host actually execute?
//
// `extension.test.ts` already proves every declared command has a registered
// handler, but a registration is not a working feature: 0.4.0 shipped four
// commands that reported protection while doing nothing, and every static check
// passed. The only evidence that a command works is a host test that runs it and
// asserts on what the user would see.
//
// So this reports three populations, and refuses to conflate them:
//
//   DRIVEN     executed in a real host via drive()/executeCommand() — real evidence
//   NAMED      mentioned by a host test but never executed (existence checks etc.)
//   UNTESTED   no host test refers to it at all
//
//   node scripts/host-command-coverage.mjs
//   node scripts/host-command-coverage.mjs --list untested
//
// Exit is always 0: this is a measurement, not a gate. Turning it into a gate
// today would only encourage driving commands without asserting anything.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(here, "..");
const repoRoot = join(extensionRoot, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));

const args = process.argv.slice(2);
const LIST = args.includes("--list") ? args[args.indexOf("--list") + 1] : null;

/** Every command the manifest contributes, with the title a user reads. */
const declared = (manifest.contributes?.commands ?? []).map((entry) => ({
    id: entry.command,
    title: [entry.category, entry.title].filter(Boolean).join(": "),
}));

/**
 * Commands hidden from the palette with `"when": "false"`. These are menu- or
 * code-only entry points, so a user cannot type them; they still need to work,
 * but their absence from a palette-driven test is by design, not a gap.
 */
const hidden = new Set(
    (manifest.contributes?.menus?.commandPalette ?? [])
        .filter((entry) => String(entry.when).trim() === "false")
        .map((entry) => entry.command),
);

const hostDir = join(extensionRoot, "src", "__tests__", "host");
const hostSources = readdirSync(hostDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({ file, text: readFileSync(join(hostDir, file), "utf8") }));

/**
 * A command counts as DRIVEN only when a host test passes its id straight into
 * something that executes it. `drive()` is this suite's wrapper around
 * `executeCommand` — it installs a scripted UI first, which is what makes the
 * assertions afterwards meaningful.
 */
const EXECUTORS = /(?:drive|executeCommand)\(\s*["']([^"']+)["']/g;

const driven = new Map();
const named = new Map();
for (const { file, text } of hostSources) {
    for (const [, id] of text.matchAll(EXECUTORS)) {
        if (!driven.has(id)) driven.set(id, new Set());
        driven.get(id).add(file);
    }
    for (const [, id] of text.matchAll(/["'](soterai\.[A-Za-z0-9_.]+)["']/g)) {
        if (!named.has(id)) named.set(id, new Set());
        named.get(id).add(file);
    }
}

const rows = declared.map(({ id, title }) => ({
    id,
    title,
    hiddenFromPalette: hidden.has(id),
    status: driven.has(id) ? "DRIVEN" : named.has(id) ? "NAMED" : "UNTESTED",
    hostFiles: [...(driven.get(id) ?? named.get(id) ?? [])],
}));

const of = (status) => rows.filter((row) => row.status === status);
const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}%`;

console.log(`Contributed commands: ${rows.length}\n`);
console.log(`  DRIVEN   ${String(of("DRIVEN").length).padStart(3)}  ${pct(of("DRIVEN").length).padStart(6)}  executed in a real host`);
console.log(`  NAMED    ${String(of("NAMED").length).padStart(3)}  ${pct(of("NAMED").length).padStart(6)}  mentioned by a host test, never executed`);
console.log(`  UNTESTED ${String(of("UNTESTED").length).padStart(3)}  ${pct(of("UNTESTED").length).padStart(6)}  no host test refers to it`);
console.log(`\n  (${rows.filter((r) => r.hiddenFromPalette).length} of these are hidden from the palette with when:false)`);

if (LIST) {
    const wanted = LIST.toUpperCase();
    const matching = rows.filter((row) => row.status === wanted);
    console.log(`\n── ${wanted} (${matching.length}) ──`);
    for (const row of matching) {
        console.log(`  ${row.id}${row.hiddenFromPalette ? " [not in palette]" : ""}\n      ${row.title}`);
    }
}

const outDir = join(repoRoot, "artifacts", "security");
mkdirSync(outDir, { recursive: true });
const evidencePath = join(outDir, "host-command-coverage.json");
writeFileSync(
    evidencePath,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            extensionVersion: manifest.version,
            totals: {
                declared: rows.length,
                driven: of("DRIVEN").length,
                named: of("NAMED").length,
                untested: of("UNTESTED").length,
                hiddenFromPalette: rows.filter((r) => r.hiddenFromPalette).length,
            },
            hostTestFiles: hostSources.map((s) => s.file),
            commands: rows,
        },
        null,
        2,
    ),
);
console.log(`\nEvidence written to ${evidencePath}`);
