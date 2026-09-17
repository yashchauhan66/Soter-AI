import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/* ── Publish-surface guard ────────────────────────────────────────────────
 * Everything in this repo is proprietary (see LICENSE / LICENSING.md), but a
 * handful of packages are deliberately published to public registries. The
 * risk is not the repo — it is private — it is what those tarballs carry.
 *
 * A `files` field that says `["dist/"]` ships more than compiled JS: TypeScript
 * emits `.js.map` and `.d.ts.map` next to the output, and a `.js.map` names the
 * original `../src/*.ts` paths (and, when `inlineSources`/`sourcesContent` is
 * on, the original source text verbatim). Compiled test files travel the same
 * way. Both hand a reader a far easier path to reconstructing the engine than
 * minified output does.
 *
 * These tests assert the boundary on the real packer output (`npm pack
 * --dry-run --json`), not on the `files` field, so a `.npmignore`, a nested
 * build, or a new emit setting cannot quietly widen the surface. They also
 * assert that packages which have never been published stay `private`, so a
 * stray `npm publish` in the wrong directory cannot be the thing that
 * distributes them.
 */

const repoRoot = path.resolve(__dirname, "..");

/** Packages intentionally published to a public registry. */
const PUBLISHED = [
  "packages/sdk",
  "packages/soter-pii",
  "packages/soterai-cli",
  "packages/mcp-gateway",
  "packages/ide-common",
  "packages/ide-protocol",
  "packages/integrations/n8n",
];

/**
 * Packages that carry an open-source LICENSE file but have never been
 * distributed under it. LICENSING.md treats them as proprietary; `private`
 * is what actually enforces that against an accidental publish.
 */
const MUST_STAY_PRIVATE = [
  "packages/guard-core",
  "packages/detectors",
  "packages/policy-engine",
  "packages/shared",
  "packages/langchain-middleware",
  "packages/llamaindex-middleware",
  "packages/vercel-ai-sdk-middleware",
  "packages/integrations/zapier",
  "apps/extension",
  "apps/local-ai-broker",
];

type PackedFile = { path: string };

function packedFiles(pkgDir: string): string[] {
  const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: path.join(repoRoot, pkgDir),
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 32 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw) as Array<{ files: PackedFile[] }>;
  assert.equal(parsed.length, 1, `${pkgDir}: expected one tarball`);
  return parsed[0].files.map((f) => f.path.replace(/\\/g, "/"));
}

function manifest(pkgDir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(repoRoot, pkgDir, "package.json"), "utf8"));
}

for (const pkgDir of PUBLISHED) {
  test(`${pkgDir}: published tarball ships no source maps`, () => {
    const maps = packedFiles(pkgDir).filter((f) => f.endsWith(".map"));
    assert.deepEqual(
      maps,
      [],
      `${pkgDir} would publish source maps. A .js.map names ../src/*.ts and can ` +
        `carry the original source text. Add "!dist/**/*.map" to the files field.`,
    );
  });

  test(`${pkgDir}: published tarball ships no raw TypeScript sources`, () => {
    const sources = packedFiles(pkgDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"),
    );
    assert.deepEqual(sources, [], `${pkgDir} would publish uncompiled TypeScript.`);
  });

  test(`${pkgDir}: published tarball ships no tests or benchmarks`, () => {
    const testish = packedFiles(pkgDir).filter((f) =>
      /(^|\/)(__tests__|test|tests|benchmarks)\//.test(f) || /\.(test|spec)\./.test(f),
    );
    assert.deepEqual(
      testish,
      [],
      `${pkgDir} would publish test/benchmark files. These describe internal ` +
        `behaviour and attack coverage and are not part of the public API.`,
    );
  });

  test(`${pkgDir}: published tarball carries its own LICENSE`, () => {
    const files = packedFiles(pkgDir);
    assert.ok(
      files.some((f) => /^LICENSE(\.md|\.txt)?$/i.test(f)),
      `${pkgDir} publishes without a LICENSE file. The root LICENSE is ` +
        `proprietary, so each published package must ship the license that ` +
        `actually governs it (see LICENSING.md).`,
    );
  });

  test(`${pkgDir}: declares a license and an explicit files allowlist`, () => {
    const m = manifest(pkgDir);
    assert.ok(m.license, `${pkgDir} has no license field.`);
    assert.ok(
      Array.isArray(m.files) && m.files.length > 0,
      `${pkgDir} has no files allowlist, so npm falls back to "everything not ` +
        `ignored" — the default that ships src/ and tests.`,
    );
  });

  test(`${pkgDir}: minifies its compiled JS before publishing`, () => {
    const m = manifest(pkgDir) as { scripts?: Record<string, string> };
    const prepublish = m.scripts?.prepublishOnly ?? "";
    assert.match(
      prepublish,
      /minify-published-dist\.mjs/,
      `${pkgDir} publishes raw tsc output. tsc strips types and nothing else: ` +
        `comments, JSDoc and internal names all survive, so the tarball reads ` +
        `as the source. Add minify-published-dist.mjs to prepublishOnly.`,
    );
  });
}

for (const pkgDir of MUST_STAY_PRIVATE) {
  test(`${pkgDir}: stays private (never published)`, () => {
    const pj = path.join(repoRoot, pkgDir, "package.json");
    assert.ok(existsSync(pj), `${pkgDir}/package.json is missing.`);
    const m = manifest(pkgDir);
    assert.equal(
      m.private,
      true,
      `${pkgDir} is not marked private. It has never been distributed, so its ` +
        `contents are proprietary under LICENSING.md; "private": true is what ` +
        `stops an accidental npm publish from distributing it.`,
    );
  });
}

test("no ONNX weights, tokenizer vocab, or training corpus in any package tarball", () => {
  const modelish = /\.(onnx|safetensors|jsonl|pt|bin)$|(^|\/)vocab\.txt$|(^|\/)tokenizer(_config)?\.json$/;
  for (const pkgDir of PUBLISHED) {
    const hits = packedFiles(pkgDir).filter((f) => modelish.test(f));
    assert.deepEqual(
      hits,
      [],
      `${pkgDir} would publish model weights or corpus data. The trained ` +
        `classifier and its training corpus are the core asset and must stay ` +
        `server-side.`,
    );
  }
});
