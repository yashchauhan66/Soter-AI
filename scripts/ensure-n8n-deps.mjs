#!/usr/bin/env node
/**
 * Makes `npm test` self-sufficient on a fresh checkout, where the n8n node's
 * runtime dependency is not installed yet.
 *
 * Why this exists:
 *
 *   tests/integrations/n8n-node-execute.test.ts imports the community node's
 *   execute.ts, which imports { NodeApiError, NodeOperationError, sleep } from
 *   "n8n-workflow". But packages/integrations/n8n is a standalone npm project
 *   with its own lockfile — it sits two levels under the workspace globs
 *   (apps/*, packages/*), so the root `npm ci` never installs its devDeps and
 *   n8n-workflow is nowhere in the root node_modules. On a developer machine
 *   that has run the n8n package's own install, the import resolves through
 *   packages/integrations/n8n/node_modules and the test passes; on CI (and any
 *   fresh clone) it dies at import time with MODULE_NOT_FOUND — taking the
 *   whole 16-test file down with it, not one assertion.
 *
 * What it does:
 *
 *   Probes whether "n8n-workflow" resolves from the n8n package's own
 *   directory — the same resolution walk execute.ts makes when the test loads
 *   it — and, when it does not, runs the n8n package's `npm ci` against its
 *   committed lockfile, so the tree that gets installed is the same one the
 *   publish workflow (publish-n8n.yml) tests and ships.
 *
 *   The probe is deliberately NOT made from the repo root: Node's resolution
 *   walks up ancestor directories only, so the root never sees
 *   packages/integrations/n8n/node_modules, and a stray machine-level
 *   node_modules (e.g. ~/node_modules) could satisfy the root probe while the
 *   test still fails — or hide a genuinely broken install.
 *
 *   `npm ci` here has to run under npm 11: the lockfile was written by npm 11,
 *   and node 22 bundles npm 10, which reads npm 11's nested placement as out
 *   of sync and refuses ("Missing: ignore@7.0.6 from lock file") — the same
 *   mismatch publish-n8n.yml pins its way around. When the active npm is
 *   already ≥ 11 it is used directly; otherwise npm@11 is invoked via npx
 *   rather than `npm i -g`, so nothing outside this repo is mutated.
 *
 * Idempotent: exits 0 immediately (and silently) when the module already
 * resolves. The install therefore runs once per clone, on CI and on fresh
 * developer machines alike — one code path everywhere.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";

const n8nPackageJson = fileURLToPath(new URL("../packages/integrations/n8n/package.json", import.meta.url));
const n8nDir = fileURLToPath(new URL("../packages/integrations/n8n/", import.meta.url));

function resolvable() {
  try {
    createRequire(n8nPackageJson).resolve("n8n-workflow");
    return true;
  } catch {
    return false;
  }
}

if (!resolvable()) {
  console.log("[pretest] n8n-workflow does not resolve from packages/integrations/n8n — the n8n node tests need it.");
  console.log("[pretest] Installing that package's committed lockfile (npm ci). This runs once per clone.");

  const npmVersion = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).stdout?.trim() ?? "";
  const major = Number.parseInt(npmVersion.split(".")[0] ?? "0", 10);

  // npm ≥ 11 can read this lockfile; npm 10 refuses it (see header). npx
  // downloads npm@11 once and the shared npm cache keeps it cheap after that.
  const useNpx = Number.isFinite(major) ? major < 11 : true;
  const npmCommand = useNpx ? "npx" : process.platform === "win32" ? "npm.cmd" : "npm";
  const npmArgs = useNpx ? ["-y", "npm@11", "ci", "--no-audit", "--no-fund"] : ["ci", "--no-audit", "--no-fund"];

  const result = spawnSync(npmCommand, npmArgs, {
    cwd: n8nDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error("[pretest] Could not spawn npm:", result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("[pretest] The npm ci in packages/integrations/n8n failed; the n8n tests will fail with MODULE_NOT_FOUND.");
    process.exit(result.status ?? 1);
  }

  // npm ci replaced node_modules wholesale; re-verify the probe now passes
  // rather than letting the test runner find out the hard way.
  if (!resolvable()) {
    console.error("[pretest] npm ci finished but n8n-workflow still does not resolve from packages/integrations/n8n.");
    process.exit(1);
  }
  console.log("[pretest] n8n-workflow is installed; continuing.");
}

