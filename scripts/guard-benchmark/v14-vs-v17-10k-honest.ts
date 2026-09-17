import * as fs from "node:fs";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";
process.env.SOTERAI_MODEL_TRUST_STORE ??= "artifacts/security/model-trust-store.json";
process.env.SOTERAI_MODEL_APPROVED_SOURCES ??= "local-training";
const ARMS = [
  { name: "v14", dir: "models/ml-classifier-v14" },
  { name: "v17-control-minilm", dir: "models/ml-classifier-v17-minilm" },
  { name: "v17-candidate-mdistilbert", dir: "models/ml-classifier-v17" },
];
const EVAL_FILES = [
  "datasets/crossdist-eval-v3-complement.jsonl",
  "datasets/external-real-v1.jsonl",
  "datasets/external-real-v2.jsonl",
  "datasets/external-real-v3.jsonl",
  "datasets/v15-test-battery.jsonl",
  "datasets/v16-probe-battery.jsonl",
  "datasets/v17-multilingual-battery.jsonl",
];
const ATTACK_TARGET = 10_000;
const SEED = 20260913;
interface Row { text: string; label: string; language?: string; source?: string }
function loadJsonl(file: string): Row[] {
  const out: Row[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (typeof o.text === "string" && typeof o.label === "string") out.push(o as Row);
    } catch { /* skip */ }
  }
  return out;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
  return a;
}
function pct(n: number): string { return `${(n * 100).toFixed(2)}%`; }
function percentile(s: number[], q: number): number {
  if (!s.length) return 0;
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const k = Math.min(b, c);
  let cur = 1; let tail = 0;
  for (let i = 0; i <= n; i++) {
    if (i <= k || i >= n - k) tail += cur * Math.pow(0.5, n);
    cur = (cur * (n - i)) / (i + 1);
  }
  return Math.min(1, tail);
}
async function main() {
  const started = Date.now();
  let pool: Row[] = [];
  for (const f of EVAL_FILES) {
    if (!fs.existsSync(f)) { console.log(`[skip] ${f}`); continue; }
    const rows = loadJsonl(f);
    console.log(`loaded ${rows.length} from ${f}`);
    pool.push(...rows);
  }
  const seen = new Set<string>();
  pool = pool.filter((r) => (seen.has(r.text) ? false : (seen.add(r.text), true)));
  const attacks = pool.filter((r) => r.label !== "SAFE");
  const benign = pool.filter((r) => r.label === "SAFE");
  console.log(`pool: ${pool.length} rows (${attacks.length} atk, ${benign.length} ben)`);
  const rnd = mulberry32(SEED);
  const byLabel = new Map<string, Row[]>();
  for (const r of attacks) {
    if (!byLabel.has(r.label)) byLabel.set(r.label, []);
    byLabel.get(r.label)!.push(r);
  }
  const labelsSorted = [...byLabel.keys()].sort();
  const base = Math.floor(ATTACK_TARGET / labelsSorted.length);
  let rem = ATTACK_TARGET - base * labelsSorted.length;
  const sampled: Row[] = [];
  for (const l of labelsSorted) {
    const extra = rem > 0 ? 1 : 0;
    if (extra) rem--;
    const q = Math.min(byLabel.get(l)!.length, base + extra);
    sampled.push(...shuffle(byLabel.get(l)!, rnd).slice(0, q));
  }
  const finalAttacks = shuffle(sampled.slice(0, Math.min(ATTACK_TARGET, sampled.length)), rnd);
async function runArms(finalAttacks: Row[], benign: Row[], started: number) {
  const results: Record<string, { atk: boolean[]; ben: boolean[]; lat: number[]; perLabel: Record<string, { n: number; ok: number }>; byLang: Record<string, { n: number; ok: number }>; mlErr: string }> = {};
  for (const arm of ARMS) {
    console.log(`\n-- scoring ${arm.name} --`);
    const backend = new ONNXClassifierBackend({ modelPath: `${arm.dir}/model.onnx`, labelsPath: `${arm.dir}/labels.json`, calibrationPath: `${arm.dir}/calibration.json` });
    const rec = { atk: [] as boolean[], ben: [] as boolean[], lat: [] as number[], perLabel: {} as Record<string, { n: number; ok: number }>, byLang: {} as Record<string, { n: number; ok: number }>, mlErr: "" };
    const score = async (rows: Row[], isAtk: boolean) => {
      let i = 0;
      for (const row of rows) {
        const t0 = performance.now();
        try {
          const inf = await backend.infer(row.text, "INPUT");
          rec.lat.push(performance.now() - t0);
          const caught = inf.predictedLabel !== "SAFE";
          if (isAtk) {
            rec.atk.push(caught);
            rec.perLabel[row.label] ??= { n: 0, ok: 0 };
            rec.perLabel[row.label].n++; if (caught) rec.perLabel[row.label].ok++;
          } else { rec.ben.push(!caught); }
          const lang = (row.language || "en").toLowerCase();
          rec.byLang[lang] ??= { n: 0, ok: 0 };
          rec.byLang[lang].n++; if (isAtk ? caught : !caught) rec.byLang[lang].ok++;
        } catch (e) { if (!rec.mlErr) rec.mlErr = String((e as Error)?.message ?? e); }
        i++;
        if (i % 2000 === 0) console.log(`  ${arm.name}: ${i}/${rows.length}`);
      }
    };
    await score(finalAttacks, true);
    await score(benign, false);
    results[arm.name] = rec;
    try { await backend.dispose(); } catch { /* ignore */ }
  }
  reportAll(results, finalAttacks.length, benign.length, started);
}
function reportAll(results: Record<string, { atk: boolean[]; ben: boolean[]; lat: number[]; perLabel: Record<string, { n: number; ok: number }>; byLang: Record<string, { n: number; ok: number }>; mlErr: string }>, nAtk: number, nBen: number, started: number) {
  console.log("\n== HEADLINE (identical rows) ==");
  const summary: Record<string, unknown> = { seed: SEED, attackRows: nAtk, benignRows: nBen, files: EVAL_FILES, arms: {} };
  for (const arm of ARMS) {
    const r = results[arm.name];
    const recall = r.atk.filter(Boolean).length / Math.max(1, r.atk.length);
    const fpr = 1 - r.ben.filter(Boolean).length / Math.max(1, r.ben.length);
    const lat = [...r.lat].sort((a, b) => a - b);
    console.log(` ${arm.name} recall ${pct(recall)} FPR ${pct(fpr)} p50 ${percentile(lat, 0.5).toFixed(1)}ms p95 ${percentile(lat, 0.95).toFixed(1)}ms err=${r.mlErr || "none"}`);
    (summary.arms as Record<string, unknown>)[arm.name] = { recall, fpr, tp: r.atk.filter(Boolean).length, fn: r.atk.filter((x) => !x).length, fp: r.ben.filter((x) => !x).length, tn: r.ben.filter(Boolean).length, p50ms: percentile(lat, 0.5), p95ms: percentile(lat, 0.95), perLabel: Object.fromEntries(Object.entries(r.perLabel).map(([k, v]) => [k, { n: v.n, recall: v.ok / v.n }])), byLanguage: r.byLang, mlError: r.mlErr };
  }
  const paired = (a: boolean[], b: boolean[]) => {
    let onlyA = 0, onlyB = 0;
    for (let i = 0; i < a.length; i++) { if (a[i] && !b[i]) onlyA++; if (b[i] && !a[i]) onlyB++; }
    return { onlyA, onlyB, p: mcnemarExact(onlyA, onlyB) };
  };
  console.log("\n-- McNemar vs v14 --");
  const mc: Record<string, unknown> = {};
  for (const other of ["v17-control-minilm", "v17-candidate-mdistilbert"]) {
    const pa = paired(results["v14"].atk, results[other].atk);
    const pb = paired(results["v14"].ben, results[other].ben);
    const tag = (d: { onlyA: number; onlyB: number; p: number }) => (d.p < 0.05 ? (d.onlyB > d.onlyA ? "BETTER(sig)" : "WORSE(sig)") : "no-sig-diff");
    console.log(` ${other} ATK: onlyV14=${pa.onlyA} onlyOther=${pa.onlyB} p=${pa.p.toFixed(6)} => ${tag(pa)}`);
    console.log(` ${other} BEN: onlyV14=${pb.onlyA} onlyOther=${pb.onlyB} p=${pb.p.toFixed(6)} => ${tag(pb)}`);
    mc[other] = { attacks: pa, benign: pb };
  }
  (summary as Record<string, unknown>).mcnemarVsV14 = mc;
  console.log("\n-- Per-label recall --");
  const allLabels = [...new Set([...Object.keys(results["v14"].perLabel), ...Object.keys(results["v17-control-minilm"].perLabel), ...Object.keys(results["v17-candidate-mdistilbert"].perLabel)])].sort();
  for (const l of allLabels) {
    const cell = (arm: string) => { const e = results[arm].perLabel[l]; return e ? `${pct(e.ok / e.n)} (${e.ok}/${e.n})` : "-"; };
    console.log(`  ${l} | v14 ${cell("v14")} | ctrl ${cell("v17-control-minilm")} | cand ${cell("v17-candidate-mdistilbert")}`);
  }
  const outPath = path.join(process.cwd(), "artifacts", "ml", "v14-vs-v17-10k-honest.json");
  fs.writeFileSync(outPath, JSON.stringify({ ...summary, generatedAtIso: new Date().toISOString(), wallClockSeconds: (Date.now() - started) / 1000 }, null, 2));
  console.log(`\nWrote ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

  console.log(`sampled attacks: ${finalAttacks.length} labels: ${labelsSorted.join(",")}`);
  console.log(`benign held-out: ${benign.length}`);
  await runArms(finalAttacks, benign, started);
}

