import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* ── Minifier gate ────────────────────────────────────────────────────────
 * `scripts/minify-published-dist.mjs` rewrites the compiled JS of every
 * published package at `prepublishOnly` time, so it runs exactly once per
 * release and its output is what users install. A defect in it does not show
 * up in any other suite: the working tree keeps readable `tsc` output, and the
 * publish-surface guard asserts the minifier is *wired*, not that it is right.
 *
 * These tests run the real script against synthetic packages. They exist
 * because of one bug that reached `prepublishOnly` before it was caught: the
 * attribution banner was written above the `#!/usr/bin/env node` line, and a
 * hashbang is legal only at byte 0. `@soterai/cli` and `@soterai/mcp-gateway`
 * both ship a hashbang `bin`, so every published CLI would have died with
 * "SyntaxError: Invalid or unexpected token" on first run — and the script's
 * own load check could not see it, because `bin` is not `main`.
 */

const repoRoot = path.resolve(__dirname, "..");
const script = path.join(repoRoot, "scripts", "minify-published-dist.mjs");

type Probe = { dir: string; run: () => { status: number; output: string } };

/** Write a throwaway package with one dist file and return a runner for it. */
function probe(name: string, manifest: Record<string, unknown>, entry: string): Probe {
  const dir = mkdtempSync(path.join(tmpdir(), `minify-${name}-`));
  mkdirSync(path.join(dir, "dist"), { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: `probe-${name}`, version: "1.0.0", license: "MIT", ...manifest }),
  );
  // Padding keeps the file long enough to look like real tsc output rather
  // than a one-liner the size heuristics would treat as already minified.
  const padding = Array.from({ length: 45 }, (_, i) => `// padding line ${i}`).join("\n");
  writeFileSync(path.join(dir, "dist", "index.js"), `${entry}\n${padding}\n`);

  return {
    dir,
    run() {
      // spawnSync, not execFileSync: the script reports skipped checks on
      // stderr, and execFileSync only hands back stdout when the exit code is 0
      // — which would make a warning look like silence.
      const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
      return { status: r.status ?? 1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
    },
  };
}

test("a hashbang bin stays executable after minification", () => {
  const p = probe(
    "hashbang",
    { main: "dist/index.js", bin: { probe: "dist/index.js" } },
    '#!/usr/bin/env node\n"use strict";\nfunction main() { return 1; }\nmodule.exports = { main };',
  );
  try {
    const { status } = p.run();
    assert.equal(status, 0, "minifying a hashbang entry must not fail");

    const out = readFileSync(path.join(p.dir, "dist", "index.js"), "utf8");
    assert.ok(
      out.startsWith("#!/usr/bin/env node"),
      "the hashbang must stay at byte 0 — one line above it is a SyntaxError, " +
        "which would break every published CLI on first run.",
    );
    assert.match(out, /\/\*!/, "the attribution banner must survive, just below the hashbang");

    // The real proof: node itself accepts the file.
    execFileSync(process.execPath, ["--check", path.join(p.dir, "dist", "index.js")], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test("minifying twice does not stack a second banner", () => {
  const p = probe(
    "idempotent",
    { main: "dist/index.js" },
    '#!/usr/bin/env node\n"use strict";\nmodule.exports = { a: 1 };',
  );
  try {
    assert.equal(p.run().status, 0);
    assert.equal(p.run().status, 0);
    const out = readFileSync(path.join(p.dir, "dist", "index.js"), "utf8");
    assert.equal(
      out.split("Copyright (c)").length - 1,
      1,
      "a re-run must not prepend a second banner",
    );
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test("an entry that exports nothing fails the build", () => {
  const p = probe("empty", { main: "dist/index.js" }, "module.exports = {};");
  try {
    const { status, output } = p.run();
    assert.equal(status, 1, "a package whose entry exports nothing must not pass");
    assert.match(output, /exported nothing/);
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test("an unresolvable dependency warns instead of failing the build", () => {
  // n8n-nodes-soterai declares n8n-workflow as a peer, so its entry cannot be
  // required during a build. That is not the minifier's fault and must not be
  // reported as one — but it must still be said out loud, not passed silently.
  const p = probe(
    "peer",
    { main: "dist/index.js" },
    'const dep = require("package-that-does-not-exist-anywhere");\nmodule.exports = { dep };',
  );
  try {
    const { status, output } = p.run();
    assert.equal(status, 0, "an absent peer dependency must not fail the build");
    assert.match(output, /load check skipped/);
    assert.match(output, /parsed cleanly/);
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test("a missing main is reported, not silently skipped", () => {
  const p = probe("nomain", { main: "dist/does-not-exist.js" }, "module.exports = { a: 1 };");
  try {
    const { status, output } = p.run();
    assert.equal(status, 0);
    assert.match(output, /does not exist/);
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test("--check fails on unminified source and passes on minified output", () => {
  const p = probe(
    "check",
    { main: "dist/index.js" },
    '"use strict";\n/**\n * A long explanatory comment of the kind tsc preserves verbatim.\n */\nmodule.exports = { a: 1 };',
  );
  const checkRun = () => {
    try {
      execFileSync(process.execPath, [script, p.dir, "--check"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return 0;
    } catch (err) {
      return (err as { status?: number }).status ?? 1;
    }
  };
  try {
    assert.equal(checkRun(), 1, "--check must reject readable source, or CI cannot catch a skipped minify");
    assert.equal(p.run().status, 0);
    assert.equal(checkRun(), 0, "--check must accept the script's own output");
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});
