#!/usr/bin/env node
/**
 * Runs ESLint over the whole repository without exhausting V8's heap.
 *
 * `eslint .` in this repo dies:
 *
 *   FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of
 *   memory
 *   Mark-Compact 4001.8 (4144.0) -> 3997.0 MB ... after 682 s
 *
 * Bisecting it: `eslint app components` finishes in ~65 s under 800 MB, `eslint
 * extensions` and `eslint apps` each finish in seconds, and `eslint packages`
 * alone climbs past 2.4 GB and then hits the 4 GB default ceiling. ESLint keeps
 * every parsed SourceCode alive for the duration of a single run, so the cost is
 * cumulative across the 17 workspaces under packages/ rather than caused by one
 * pathological file. Nothing was wrong with the rules — the run was simply
 * bigger than one default-sized heap.
 *
 * Two things fix that, and both are needed:
 *   1. Split the tree into groups, so each ESLint run only has to hold its own
 *      group in memory.
 *   2. Give each run a larger heap. Doing it here rather than through
 *      NODE_OPTIONS keeps the npm script cross-platform (Windows shells do not
 *      accept `NODE_OPTIONS=... eslint`, and adding cross-env for one variable
 *      is not worth a dependency).
 *
 * Groups are linted in sequence, not in parallel: the point is to bound peak
 * memory, and running them concurrently would put it back.
 *
 * Every group's findings are reported even when an earlier group fails, so one
 * error does not hide the rest of the repo. The process exits non-zero if any
 * group did.
 *
 * Usage:
 *   node scripts/runLint.mjs            # lint everything
 *   node scripts/runLint.mjs --fix      # extra args are forwarded to ESLint
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);

// Resolve ESLint's own CLI entry point rather than shelling out to `npx eslint`.
// This process is what carries --max-old-space-size, so ESLint has to run *in*
// a node process we start, not in one npx starts for us.
function resolveEslintBin() {
  try {
    // eslint exposes bin/eslint.js; resolve via its package.json so we do not
    // depend on the layout npm happened to install.
    const pkgPath = require.resolve("eslint/package.json");
    const pkg = require("eslint/package.json");
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.eslint;
    if (!bin) throw new Error("eslint package.json declares no bin entry");
    return path.join(path.dirname(pkgPath), bin);
  } catch (error) {
    console.error("[lint] Could not resolve the eslint CLI. Is it installed?");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Ordered smallest-blast-radius first so a broken config surfaces quickly.
// Paths that do not exist in a given checkout are skipped rather than passed to
// ESLint, which treats a missing path as an error.
const GROUPS = [
  {
    name: "app",
    paths: ["app", "components", "lib", "workers", "types", "middleware.ts", "auth.ts", "auth.config.ts"],
    heapMb: 6144,
  },
  { name: "tests-and-scripts", paths: ["tests", "scripts", "benchmarks"], heapMb: 6144 },
  { name: "packages", paths: ["packages"], heapMb: 8192 },
  { name: "apps-and-extensions", paths: ["apps", "extensions", "integrations"], heapMb: 6144 },
];

const eslintBin = resolveEslintBin();
const forwarded = process.argv.slice(2);
const failed = [];

for (const group of GROUPS) {
  const targets = group.paths.filter((target) => existsSync(target));
  if (targets.length === 0) {
    console.log(`[lint] ${group.name}: nothing to lint, skipping`);
    continue;
  }

  console.log(`[lint] ${group.name}: ${targets.join(" ")}`);
  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${group.heapMb}`, eslintBin, ...targets, ...forwarded],
    { stdio: "inherit" },
  );

  if (result.error) {
    console.error(`[lint] ${group.name}: failed to start ESLint —`, result.error.message);
    failed.push(group.name);
    continue;
  }
  // A signal death (SIGABRT from an OOM, for instance) leaves status null.
  if (result.signal) {
    console.error(`[lint] ${group.name}: ESLint terminated by ${result.signal}`);
    failed.push(group.name);
    continue;
  }
  if (result.status !== 0) failed.push(group.name);
}

if (failed.length > 0) {
  console.error(`\n[lint] failing groups: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("\n[lint] all groups clean");
