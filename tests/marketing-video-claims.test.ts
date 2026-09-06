import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

/**
 * Video claim gate.
 *
 * The video is the highest-leverage marketing artefact in this repo and the
 * hardest to review: nobody diffs an mp4, and a wrong number burned into frame
 * 900 is invisible until a stranger pauses on it. So the generator emits a
 * manifest of everything it said — on screen and out loud — and this file treats
 * that manifest as the reviewable surface.
 *
 * These are the same rules as tests/marketing-launch-claims.test.ts, applied to
 * a different output: numbers must equal the committed benchmark evidence, the
 * unflattering blind result must travel with the flattering tuned one, and the
 * claims this project has promised never to make must stay absent.
 *
 * Regenerate with: node scripts/marketing/generate-video.mjs --crops
 */

const root = process.cwd();
const videoDir = resolve(root, "marketing/video");
const benchmarkPath = resolve(root, "benchmarks/results/latest.json");
const auditDir = resolve(root, "benchmarks/results");

interface Scene {
  id: string;
  start: number;
  end: number;
  duration: number;
  presenter: boolean;
  voiceSource: string;
  eyebrow: string;
  headline: string;
  sub: string | null;
  footnote: string | null;
  narration: string;
  captionCues: number;
}

interface Manifest {
  file: string;
  cut: string;
  language: string;
  voice: string | null;
  voiceSource: string;
  recordedVoiceDir: string | null;
  presenter: string | null;
  runtimeSeconds: number;
  fps: number;
  captionsBurnedIn: boolean;
  requiredDisclaimer: string;
  syntheticIdentifiersOnly: boolean;
  metrics: Record<string, string | boolean>;
  blindHeldOut: { pct: string; n: number; hit: number };
  aggregateRecall: { pct: string; n: number; hit: number };
  aggregateFpr: { pct: string; n: number; hit: number };
  scenes: Scene[];
  assets: { name: string; size: string; seconds: number; note: string }[];
}

/**
 * Every variant, not just the newest. `manifest.json` is a copy of whichever
 * render finished last, so reading only that would let a stale short cut ship
 * unchecked while the full cut passes.
 */
function loadManifests(): Manifest[] {
  if (!existsSync(videoDir)) return [];
  return readdirSync(videoDir)
    .filter((name) => /^manifest-.+\.json$/.test(name))
    .map((name) => ({ ...JSON.parse(readFileSync(join(videoDir, name), "utf8")), file: name }));
}

/** Same rows the generator parses, re-parsed here so the test is not told the answer. */
function loadAudit() {
  const audits = readdirSync(auditDir)
    .filter((name) => /^readme-detection-audit-.*\.txt$/.test(name))
    .sort();
  const source = audits[audits.length - 1];
  const text = readFileSync(join(auditDir, source), "utf8");
  const row = (pattern: RegExp) => {
    const match = text.match(pattern);
    assert.ok(match, `could not parse ${pattern} from ${source}`);
    return { hit: Number(match[1]), n: Number(match[2]), pct: `${Number(match[3]).toFixed(2)}%` };
  };
  return {
    source,
    blind: row(/held-out blind wide\s+(\d+)\/(\d+)\s+([\d.]+)%/),
    recall: row(/AGGREGATE RECALL[^\d]*(\d+)\/(\d+)\s+([\d.]+)%/),
    fpr: row(/AGGREGATE FPR[^\d]*(\d+)\/(\d+)\s+([\d.]+)%/),
  };
}

const manifests = loadManifests();
const skipReason = "no rendered video — run: node scripts/marketing/generate-video.mjs --crops";
/**
 * The mp4 renders are gitignored on purpose (~40MB per crop, regenerable by
 * `npm run marketing:video`); only the reviewable outputs — manifests,
 * shooting scripts, SRTs — are committed. So a fresh checkout has no renders
 * by design, and "every asset file is absent" is the state of every fresh
 * clone — distinct from "some assets are absent", which is the deleted-render
 * regression the per-asset check exists to catch. Timeline continuity, sizes
 * and durations are manifest data and are enforced everywhere.
 */
const renderedAssets = manifests.flatMap((manifest) => manifest.assets.map((asset) => join(videoDir, asset.name)));
const anyRenderOnDisk = renderedAssets.length > 0 && renderedAssets.some((path) => existsSync(path));

/** Everything a viewer can read or hear, per scene. */
const spokenAndSeen = (scene: Scene) =>
  [scene.eyebrow, scene.headline, scene.sub ?? "", scene.footnote ?? "", scene.narration].join(" \u2022 ");

/** A frame "carries a number" if it shows a percentage, a latency, or a case count. */

test("a rendered video exists to check", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  for (const manifest of manifests) {
    assert.ok(manifest.scenes.length >= 3, `${manifest.file}: a cut with ${manifest.scenes.length} scenes is not a video`);
    assert.ok(manifest.runtimeSeconds > 20, `${manifest.file}: runtime ${manifest.runtimeSeconds}s is too short to be real`);
  }
});

test("the video never makes the claims this project has promised not to make", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  // Sourced from marketing/13-SEPTEMBER-2026-GROWTH-SPRINT.md ("Non-negotiable
  // trust rules"), lib/marketing/launchStatus.ts and docs/public-launch-checklist.md.
  const forbidden = [
    /\b100%\s+secure\b/i,
    /\bfully\s+secure\b/i,
    /\bunbreakable\b/i,
    /\bSOC\s*2\s+(?:compliant|certified)\b/i,
    /\bISO\s*27001\s+(?:compliant|certified)\b/i,
    /\bindependently\s+(?:validated|audited|verified)\b/i,
    /\bthird-party\s+audited\b/i,
    /\bzero\s+false\s+positives\b/i,
    /\bguarantees?\s+(?:complete|full)\s+(?:security|protection)\b/i,
  ];
  for (const manifest of manifests) {
    for (const scene of manifest.scenes) {
      const copy = spokenAndSeen(scene);
      for (const pattern of forbidden) {
        assert.doesNotMatch(copy, pattern, `${manifest.file} scene "${scene.id}" contains a forbidden claim: ${pattern}`);
      }
    }
  }
});

test("every number on screen equals the committed benchmark evidence", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  const benchmark = JSON.parse(readFileSync(benchmarkPath, "utf8"));
  const audit = loadAudit();

  for (const manifest of manifests) {
    const where = manifest.file;
    assert.equal(
      manifest.metrics.recall,
      `${(benchmark.metrics.recall * 100).toFixed(2)}%`,
      `${where}: recall drifted from benchmarks/results/latest.json — re-render the video`,
    );
    assert.equal(
      manifest.metrics.fpr,
      `${(benchmark.metrics.false_positive_rate * 100).toFixed(2)}%`,
      `${where}: false-positive rate drifted from the benchmark — re-render`,
    );
    assert.equal(
      manifest.metrics.p50,
      `${benchmark.metrics.latency_ms.p50.toFixed(2)}ms`,
      `${where}: p50 latency drifted from the benchmark — re-render`,
    );
    assert.equal(
      manifest.metrics.p95,
      `${benchmark.metrics.latency_ms.p95.toFixed(2)}ms`,
      `${where}: p95 latency drifted from the benchmark — re-render`,
    );
    assert.equal(
      manifest.metrics.cases,
      benchmark.dataset.total_cases.toLocaleString("en-US"),
      `${where}: case count drifted from the benchmark — re-render`,
    );
    assert.equal(
      manifest.metrics.independent,
      false,
      `${where}: the video may not be built from a run claiming independent third-party status without a copy review`,
    );

    // The audit rows: the tuned aggregate, the blind held-out result, the FPR.
    assert.deepEqual(
      { pct: manifest.blindHeldOut.pct, n: manifest.blindHeldOut.n, hit: manifest.blindHeldOut.hit },
      audit.blind,
      `${where}: blind held-out result does not match ${audit.source}`,
    );
    assert.deepEqual(
      { pct: manifest.aggregateRecall.pct, n: manifest.aggregateRecall.n, hit: manifest.aggregateRecall.hit },
      audit.recall,
      `${where}: aggregate recall does not match ${audit.source}`,
    );
    assert.deepEqual(
      { pct: manifest.aggregateFpr.pct, n: manifest.aggregateFpr.n, hit: manifest.aggregateFpr.hit },
      audit.fpr,
      `${where}: aggregate FPR does not match ${audit.source}`,
    );
  }
});

test("the blind held-out result is in the cut, next to the tuned one", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  const audit = loadAudit();
  for (const manifest of manifests) {
    const where = manifest.file;
    const honesty = manifest.scenes.find((scene) => scene.id === "honesty");
    assert.ok(
      honesty,
      `${where}: the "honesty" scene is missing. A cut without the blind held-out number is not shippable, whatever it does for the runtime.`,
    );

    const copy = spokenAndSeen(honesty);
    assert.ok(
      copy.includes(audit.blind.pct),
      `${where}: the honesty scene does not state the blind held-out result (${audit.blind.pct})`,
    );
    assert.ok(
      copy.includes(audit.recall.pct),
      `${where}: the honesty scene must show the tuned aggregate (${audit.recall.pct}) beside the blind one, or the comparison is meaningless`,
    );

    // The real failure mode is the good number appearing somewhere the bad one
    // does not. Any scene quoting the tuned aggregate has to quote the blind one.
    for (const scene of manifest.scenes) {
      const text = spokenAndSeen(scene);
      if (!text.includes(audit.recall.pct)) continue;
      assert.ok(
        text.includes(audit.blind.pct),
        `${where} scene "${scene.id}" quotes the tuned aggregate ${audit.recall.pct} without the blind held-out ${audit.blind.pct}`,
      );
    }
  }
});

test("every frame carrying a number also carries the disclaimer", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  for (const manifest of manifests) {
    assert.match(
      manifest.requiredDisclaimer,
      /not an independent audit/i,
      `${manifest.file}: the manifest must carry the disclaimer that ships with the numbers`,
    );
    for (const scene of manifest.scenes) {
      // Latency, percentages and case counts are benchmark claims. The rupee
      // amount in the agent demo and the rollback window are not, so scope the
      // check to the on-screen copy that quotes a measurement.
      const measured = [scene.eyebrow, scene.headline, scene.sub ?? ""].filter(carriesMetric).join(" ");
      if (!measured) continue;
      assert.ok(
        (scene.footnote ?? "").includes(manifest.requiredDisclaimer),
        `${manifest.file} scene "${scene.id}" shows a measured number ("${measured.trim()}") without the self-maintained-benchmark disclaimer in its footnote`,
      );
    }
  }
});

test("identifiers on screen are synthetic, and the frame says so", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  for (const manifest of manifests) {
    assert.equal(
      manifest.syntheticIdentifiersOnly,
      true,
      `${manifest.file}: a video built from anything but synthetic identifiers cannot be published`,
    );
    // Aadhaar-like numbers, PAN, UPI and live credentials appear in the guard
    // demos. Those scenes have to label them, because a viewer cannot tell a fake
    // Aadhaar from a real one by looking at it.
    //
    // Scoped to identifiers a frame actually *displays*: the value shapes, plus
    // the "live key" phrasing the demo copy uses for a leaked credential. A bare
    // "API keys" is excluded on purpose — it is the name of a dashboard surface in
    // the Manage layer ("Projects · API keys · Cost firewall"), not an identifier
    // on screen, and demanding the word "synthetic" on that slide would be noise.
    const identifierScenes = manifest.scenes.filter((scene) =>
      /aadhaar|pan\b|upi|ifsc|gstin|\blive (?:api )?keys?\b|\bsk_live\b|\bAKIA[0-9A-Z]{6,}\b/i.test(spokenAndSeen(scene)),
    );
    assert.ok(
      identifierScenes.length > 0,
      `${manifest.file}: no scene demonstrates PII redaction — the India-first claim has no evidence in the cut`,
    );
    for (const scene of identifierScenes) {
      assert.match(
        spokenAndSeen(scene),
        /synthetic/i,
        `${manifest.file} scene "${scene.id}" shows identifiers without saying they are synthetic test values`,
      );
    }
  }
});

test("the rendered timeline is continuous and the assets match it", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  for (const manifest of manifests) {
    const where = manifest.file;
    let expected = 0;
    for (const scene of manifest.scenes) {
      assert.ok(scene.duration > 1, `${where} scene "${scene.id}" is ${scene.duration}s long — too short to read`);
      assert.equal(
        scene.start,
        Math.round(expected * 1000) / 1000,
        `${where} scene "${scene.id}" starts at ${scene.start}s but the previous scene ends at ${expected}s — a gap or overlap means a black frame or a double-exposed slide`,
      );
      expected = scene.end;
    }
    assert.equal(manifest.runtimeSeconds, expected, `${where}: runtime does not equal the sum of its scenes`);

    if (manifest.captionsBurnedIn) {
      for (const scene of manifest.scenes) {
        assert.ok(
          scene.captionCues >= 1,
          `${where} scene "${scene.id}" has no caption cue, so a muted viewer sees a slide with no words`,
        );
      }
    }

    // Sizes are read back from ffprobe. They are asserted here because the
    // platforms silently letterbox a wrong aspect ratio rather than reject it —
    // and because a trailing \r once shipped into this field as "1920x1080\r".
    for (const asset of manifest.assets) {
      assert.match(asset.size, /^\d+x\d+$/, `${where}: asset "${asset.name}" has a malformed size "${asset.size}"`);
      assert.ok(
        Math.abs(asset.seconds - manifest.runtimeSeconds) <= 0.5,
        `${where}: asset "${asset.name}" is ${asset.seconds}s but the timeline is ${manifest.runtimeSeconds}s`,
      );
      // File existence is the one check that needs the renders, and renders
      // are regenerable local-only artifacts (see anyRenderOnDisk above). On a
      // machine that has rendered, a missing asset file is a deleted-render
      // regression; on a fresh checkout with no renders at all it is the
      // repo's designed state.
      if (anyRenderOnDisk) {
        assert.ok(existsSync(join(videoDir, asset.name)), `${where}: manifest lists ${asset.name} but the file is gone`);
      }
    }
    const sizes = manifest.assets.map((asset) => asset.size);
    assert.ok(sizes.includes("1920x1080"), `${where}: no 16:9 master was rendered`);
  }
});

test("the shooting script and captions agree with what was rendered", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  const audit = loadAudit();
  for (const manifest of manifests) {
    const stem = `soterai-${manifest.cut}-${manifest.language}`;
    const scriptPath = join(videoDir, `SCRIPT-${manifest.cut}-${manifest.language}.md`);
    const srtPath = join(videoDir, `${stem}.srt`);
    assert.ok(existsSync(scriptPath), `${manifest.file}: no shooting script at ${scriptPath}`);
    assert.ok(existsSync(srtPath), `${manifest.file}: no subtitle sidecar at ${srtPath}`);

    const script = readFileSync(scriptPath, "utf8");
    assert.ok(
      script.includes(manifest.requiredDisclaimer),
      `SCRIPT-${manifest.cut}-${manifest.language}.md must state the disclaimer that ships with the numbers`,
    );
    assert.ok(
      script.includes(audit.blind.pct),
      `SCRIPT-${manifest.cut}-${manifest.language}.md must publish the blind held-out result (${audit.blind.pct})`,
    );
    for (const scene of manifest.scenes) {
      assert.ok(
        script.includes(scene.narration),
        `SCRIPT-${manifest.cut}-${manifest.language}.md is missing the narration actually rendered for "${scene.id}"`,
      );
    }
  }
});

test("the manifest is honest about whose voice and face are in the video", (t) => {
  if (!manifests.length) {
    t.skip(skipReason);
    return;
  }
  for (const manifest of manifests) {
    const where = manifest.file;
    const sources = new Set(manifest.scenes.map((scene) => scene.voiceSource));
    assert.ok(
      [...sources].every((source) => ["recorded", "tts", "silent"].includes(source)),
      `${where}: unknown voice source in ${[...sources].join(", ")}`,
    );

    // "Real human voice" is a claim like any other: it holds only when every
    // scene actually played a recorded take.
    const allRecorded = [...sources].every((source) => source === "recorded");
    const anyRecorded = sources.has("recorded");
    if (allRecorded) {
      assert.equal(manifest.voiceSource, "recorded", `${where}: all scenes are recorded but voiceSource says otherwise`);
      assert.ok(manifest.recordedVoiceDir, `${where}: voiceSource is "recorded" but no --vo-dir is recorded`);
    } else if (anyRecorded) {
      assert.equal(
        manifest.voiceSource,
        "mixed",
        `${where}: some scenes are recorded and some synthetic — the manifest must say "mixed" so nobody calls this a human voiceover`,
      );
    } else {
      assert.ok(
        ["tts", "silent"].includes(manifest.voiceSource),
        `${where}: no recorded take exists, so voiceSource must be "tts" or "silent", not "${manifest.voiceSource}"`,
      );
    }

    // A presenter path in the manifest is a claim that a human is on screen.
    if (manifest.presenter) {
      assert.ok(
        existsSync(resolve(root, manifest.presenter)),
        `${where}: manifest claims presenter "${manifest.presenter}" but that clip is not on disk`,
      );
      assert.ok(
        manifest.scenes.some((scene) => scene.presenter),
        `${where}: a presenter clip was supplied but no scene is flagged to show it`,
      );
    }
  }
});

const carriesMetric = (text: string) => /\d[\d,.]*\s*(?:%|ms\b)/i.test(text);
