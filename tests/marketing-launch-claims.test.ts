import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Launch-claim gate.
 *
 * Marketing copy is the one place in this repo where an unverifiable claim can
 * ship without a compiler or a reviewer noticing. These tests treat the launch
 * kit as a build artefact: every performance number in it must match the
 * committed benchmark evidence, and the claims the project has explicitly
 * promised never to make must stay absent.
 */

const root = process.cwd();
const playbookPath = resolve(root, "marketing/14-PRODUCTHUNT-TOP5-LAUNCH-PLAYBOOK.md");
const manifestPath = resolve(root, "marketing/ph-assets/manifest.json");
const benchmarkPath = resolve(root, "benchmarks/results/latest.json");

const playbook = readFileSync(playbookPath, "utf8");

/**
 * The playbook deliberately quotes the forbidden claims in its "never do this"
 * list. Scanning the raw file would flag those prohibitions as violations, so
 * strip the lines that exist to forbid a claim before scanning what the launch
 * would actually publish.
 */
const publishedCopy = playbook
  .split(/\r?\n/)
  .filter((line) => !/^\s*[-*]\s*❌/.test(line))
  .join("\n");

test("Product Hunt tagline and description fit the platform's hard limits", () => {
  // PH truncates silently, so an over-length tagline is discovered by the public.
  const tagline = "AI security guard for chatbots, RAG apps & agents";
  assert.ok(playbook.includes(tagline), "the launch tagline is missing from the playbook");
  assert.ok(tagline.length <= 60, `PH tagline limit is 60 characters, copy is ${tagline.length}`);

  const descriptionBlock = playbook.match(/```\r?\nOne security layer for every prompt[\s\S]*?```/);
  assert.ok(descriptionBlock, "the launch description block is missing from the playbook");
  const description = descriptionBlock[0].replace(/```/g, "").trim().replace(/\s+/g, " ");
  assert.ok(
    description.length <= 260,
    `PH description limit is 260 characters, playbook copy is ${description.length}`,
  );
});

test("launch copy never makes the claims this project has promised not to make", () => {
  // Sourced from marketing/13-SEPTEMBER-2026-GROWTH-SPRINT.md ("Non-negotiable
  // trust rules") and docs/public-launch-checklist.md.
  const forbidden = [
    /\b100%\s+secure\b/i,
    /\bSOC\s*2\s+(?:compliant|certified)\b/i,
    /\bindependently\s+(?:validated|audited)\b/i,
    /\bthird-party\s+audited\b/i,
    /\bguarantees?\s+(?:complete|full)\s+(?:security|protection)\b/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(publishedCopy, pattern, `launch copy contains a forbidden claim: ${pattern}`);
  }
});

test("every benchmark number in the launch copy carries its disclaimer", () => {
  // A perfect score without its scope is the single most damaging thing this
  // launch could publish, because the audience checks.
  assert.match(
    playbook,
    /self-maintained/i,
    "launch copy cites benchmark numbers but never says the benchmark is self-maintained",
  );
  assert.match(
    playbook,
    /not a third-party audit/i,
    "launch copy must state that the benchmark is not a third-party audit",
  );
  // The blind held-out gap is the honest counterweight to the synthetic 100%.
  assert.match(
    playbook,
    /blind held-out/i,
    "launch copy must disclose the blind held-out result alongside the synthetic one",
  );
});

test("generated launch assets agree with the committed benchmark evidence", (t) => {
  if (!existsSync(manifestPath)) {
    t.skip("run: node scripts/marketing/generate-ph-gallery.mjs");
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const benchmark = JSON.parse(readFileSync(benchmarkPath, "utf8"));

  assert.equal(
    manifest.metrics.recall,
    `${(benchmark.metrics.recall * 100).toFixed(2)}%`,
    "gallery recall drifted from benchmarks/results/latest.json — regenerate the assets",
  );
  assert.equal(
    manifest.metrics.p95,
    `${benchmark.metrics.latency_ms.p95.toFixed(2)}ms`,
    "gallery p95 latency drifted from the benchmark — regenerate the assets",
  );
  assert.equal(
    manifest.metrics.independent,
    false,
    "assets may not be generated from a run that claims independent third-party status without a copy review",
  );
  assert.match(
    manifest.requiredDisclaimer,
    /not an independent audit/i,
    "the asset manifest must carry the disclaimer that ships with the numbers",
  );

  // PH gallery slides are 1270x760 and the card thumbnail is 240x240. Wrong
  // sizes get cropped by the platform, not rejected, so assert them here.
  const bySize = (size: string) =>
    manifest.assets.filter((asset: { size: string }) => asset.size === size).length;
  assert.ok(bySize("1270x760") >= 6, "expected at least six 1270x760 PH gallery slides");
  assert.equal(bySize("240x240"), 3, "expected three 240x240 thumbnail frames for the launch GIF");
  assert.equal(bySize("1200x630"), 1, "expected one 1200x630 social amplification card");
});
