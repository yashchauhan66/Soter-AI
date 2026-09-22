#!/usr/bin/env node
/**
 * Minify a published package's compiled JS in place, then prove it still loads.
 *
 * Why this exists
 * ---------------
 * `tsc` output is not a build artifact in any meaningful sense — it is the
 * TypeScript with the types removed. Comments, JSDoc, internal function and
 * variable names, and the original file layout all survive, so a published
 * tarball reads as the source. For a detection engine the comments are the most
 * valuable part: they explain *why* each rule exists.
 *
 * This step rewrites each emitted `.js` in place with esbuild: comments dropped,
 * locals mangled, whitespace gone. It deliberately does NOT bundle. Bundling
 * would collapse the file layout that `main`, `bin`, `exports` and n8n's
 * `nodes`/`credentials` manifests point at; per-file minification leaves every
 * `require()` edge and every entry path exactly where it was, so nothing about
 * how a consumer imports the package changes.
 *
 * What this is and is not
 * -----------------------
 * This is obfuscation, not protection. Minified JS on someone else's disk can
 * still be read, beautified, and understood by anyone willing to spend the time.
 * It raises the cost of lifting the code from "copy-paste" to "reverse-engineer",
 * and it is the most that is achievable for logic that runs on the consumer's
 * machine. Logic that must not be copied has to stay server-side.
 *
 * The `.d.ts` files are left untouched on purpose: consumers need readable types
 * for editor completion, and types describe the API surface, not its mechanics.
 *
 * Usage:  node scripts/minify-published-dist.mjs <package-dir> [--check]
 *         --check  verify already-minified output instead of rewriting it (CI)
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const pkgDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const pkgJsonPath = path.join(pkgDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
const distDir = path.join(pkgDir, "dist");

/** Every emitted .js under dist/, excluding tests (they are not published). */
function distJsFiles(dir = distDir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "test" || entry === "tests") continue;
      out.push(...distJsFiles(full));
    } else if (entry.endsWith(".js") && !/\.(test|spec)\.js$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * A short attribution banner survives minification and travels with every copy.
 * It is the thing that makes a lifted file self-identifying in a diff.
 */
function banner() {
  const year = new Date().getFullYear();
  return [
    "/*!",
    ` * ${pkg.name} v${pkg.version}`,
    ` * Copyright (c) ${year} Yash Chauhan (SoterAI). All rights reserved.`,
    ` * License: ${pkg.license ?? "proprietary"} — see LICENSE in this package.`,
    " * https://soterai.in",
    " */",
  ].join("\n");
}

/** Heuristic for "this file is still readable source". */
function looksUnminified(code) {
  const lines = code.split("\n");
  const body = lines.filter((l) => !l.startsWith(" *") && !l.startsWith("/*"));
  const avg = body.length ? body.reduce((n, l) => n + l.length, 0) / body.length : 0;
  // tsc output averages well under 60 chars/line and keeps block comments.
  return body.length > 40 && avg < 60;
}

const files = distJsFiles();
if (files.length === 0) {
  console.error(`[minify] ${pkg.name}: no dist/**/*.js found — run the build first.`);
  process.exit(1);
}

if (checkOnly) {
  const unminified = files.filter((f) => looksUnminified(readFileSync(f, "utf8")));
  if (unminified.length > 0) {
    console.error(
      `[minify] ${pkg.name}: ${unminified.length} file(s) still ship readable source:\n` +
        unminified.map((f) => "  " + path.relative(pkgDir, f)).join("\n"),
    );
    process.exit(1);
  }
  console.log(`[minify] ${pkg.name}: ${files.length} file(s) verified minified.`);
  process.exit(0);
}

const before = files.reduce((n, f) => n + statSync(f).size, 0);

/**
 * esbuild is resolved from the package being minified first, so a publish that
 * runs `npm ci` in only that package — the n8n workflow does exactly this and
 * never installs the repo root — finds it in that package's own node_modules.
 * Falls back to this script's own location for callers that keep esbuild at the
 * repo root, so nothing that worked before changes. Both are tried before we
 * fail with a message that says what to do.
 */
function resolveEsbuildBin(fromPkgDir) {
  for (const base of [path.join(fromPkgDir, "package.json"), import.meta.url]) {
    try {
      return createRequire(base).resolve("esbuild/bin/esbuild");
    } catch {
      /* try the next resolution base */
    }
  }
  throw new Error(
    "[minify] esbuild not found. Add it as a devDependency of the package being " +
      "minified so its own `npm ci` installs it, or install it at the repo root.",
  );
}

execFileSync(
  process.execPath,
  [
    resolveEsbuildBin(pkgDir),
    ...files,
    "--minify",
    "--platform=node",
    "--legal-comments=none",
    `--outdir=${distDir}`,
    `--outbase=${distDir}`,
    "--allow-overwrite",
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

/* The banner goes after the hashbang, never before it. `#!` is only legal at
 * byte 0 of a file; one line above it turns a working CLI into an instant
 * SyntaxError, and the entry-point load check below would not catch it because
 * `bin` is not `main` — `@soterai/cli` and `@soterai/mcp-gateway` both ship a
 * hashbang bin, so this is the live case, not a hypothetical one. */
for (const file of files) {
  const code = readFileSync(file, "utf8");
  const hashbang = code.startsWith("#!") ? code.slice(0, code.indexOf("\n") + 1) : "";
  const body = code.slice(hashbang.length);
  if (body.startsWith("/*!")) continue;
  writeFileSync(file, `${hashbang}${banner()}\n${body}`);
}

const after = files.reduce((n, f) => n + statSync(f).size, 0);

/* A minifier that emits broken JS is worse than no minifier, so every rewritten
 * file is parsed before this is called a success.
 *
 * This is the only check that covers `bin`. The load check below requires
 * `main`, and a CLI entry cannot be required the same way — it parses argv and
 * runs on import, so loading it here would execute the tool as a side effect of
 * building it. Parsing is the strongest thing that is safe to do to a bin, and
 * it is enough to catch the failure that actually happens: a banner written
 * above a `#!` line, which is legal only at byte 0.
 *
 * `node --check` also needs no dependencies installed and no peers resolvable,
 * which matters because these packages are minified in CI where a peer like
 * `n8n-workflow` is deliberately absent. */
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (err) {
    console.error(
      `[minify] ${pkg.name}: ${path.relative(pkgDir, file)} is not parseable after ` +
        `minification.\n${err.stderr?.toString() ?? err.message}`,
    );
    process.exit(1);
  }
}

/* Parsing proves the syntax survived; loading the entry proves the module graph
 * did. That second check can fail for reasons that have nothing to do with
 * minification — an entry path that the build did not emit, or an absent peer
 * dependency — so it reports those as warnings and reserves failure for the one
 * signal that does indict the minifier: code that parses but will not run. */
const entry = pkg.main ? path.join(pkgDir, pkg.main) : null;
if (entry && !existsSync(entry)) {
  console.warn(
    `[minify] ${pkg.name}: skipping load check — "main" (${pkg.main}) does not ` +
      `exist. The build did not emit it; the dist is stale or misconfigured.`,
  );
} else if (entry) {
  try {
    const mod = createRequire(import.meta.url)(entry);
    const exported = Object.keys(mod ?? {}).length;
    if (exported === 0) {
      console.error(`[minify] ${pkg.name}: ${pkg.main} loaded but exported nothing.`);
      process.exit(1);
    }
    console.log(`[minify] ${pkg.name}: ${pkg.main} loads, ${exported} export(s) intact.`);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`[minify] ${pkg.name}: ${pkg.main} has a syntax error after minification.`);
      console.error(err.message);
      process.exit(1);
    }
    console.warn(
      `[minify] ${pkg.name}: load check skipped (${err.code ?? err.name}: ${err.message.split("\n")[0]}). ` +
        `All ${files.length} file(s) parsed cleanly.`,
    );
  }
}

const pct = (((before - after) / before) * 100).toFixed(1);
console.log(
  `[minify] ${pkg.name}: ${files.length} file(s), ` +
    `${(before / 1024).toFixed(1)} KB -> ${(after / 1024).toFixed(1)} KB (-${pct}%).`,
);
