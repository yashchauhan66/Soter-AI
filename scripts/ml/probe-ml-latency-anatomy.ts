/**
 * probe-ml-latency-anatomy.ts — where does the ML tier's time go?
 *
 * bench-pipeline-latency.ts measures augmentWithMl as one block. This splits it
 * per stage on the same rows, then re-times the bare ONNX graph under explicit
 * session options, so a latency budget for a new model can be set against the
 * model's own cost rather than against overhead it would inherit unchanged.
 *
 * Run:
 *   npx tsx scripts/ml/probe-ml-latency-anatomy.ts --model-dir models/ml-classifier-v14 [--limit 400]
 */
import fs from "node:fs";
import path from "node:path";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const modelDir = arg("model-dir", "models/ml-classifier-v14")!;
const limit = Number(arg("limit", "400"));

process.env.ML_ONNX_MODEL_PATH = path.join(modelDir, "model.onnx");
process.env.ML_ONNX_LABELS_PATH = path.join(modelDir, "labels.json");
process.env.ML_ONNX_MAX_LENGTH ??= "256";
process.env.SOTERAI_MODEL_TRUST_STORE ??= "artifacts/security/model-trust-store.json";
process.env.SOTERAI_MODEL_APPROVED_SOURCES ??= "local-training";
process.env.SOTERAI_ML_AUGMENT = "enforce";

const ms = (t0: bigint) => Number(process.hrtime.bigint() - t0) / 1e6;

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
  const r = (x: number) => Number(x.toFixed(3));
  return { n: s.length, mean: r(s.reduce((a, b) => a + b, 0) / s.length), p50: r(at(0.5)), p95: r(at(0.95)), p99: r(at(0.99)) };
}

function loadRows(): string[] {
  const rows: string[] = [];
  const root = "benchmarks/soterai-public-benchmark";
  for (const sub of ["attacks", "benign"]) {
    for (const f of fs.readdirSync(path.join(root, sub)).sort()) {
      for (const line of fs.readFileSync(path.join(root, sub, f), "utf-8").split("\n")) {
        if (line.trim()) rows.push(JSON.parse(line).text);
      }
    }
  }
  // Interleave so a prefix sample spans categories instead of one file.
  const step = Math.max(1, Math.floor(rows.length / limit));
  return rows.filter((_, i) => i % step === 0).slice(0, limit);
}

async function main() {
  const { ONNXClassifierBackend } = await import("../../lib/ml/onnxBackend");
  const { classifySemantic } = await import("../../lib/guard/semanticClassifier");
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl } = await import("../../lib/guard/mlAugment");
  const ort = await import("onnxruntime-node");

  const backend = new ONNXClassifierBackend();
  await backend.infer("warm up the session please", "INPUT");
  // Private fields, read only for timing. A rename here fails loudly, not silently.
  const b = backend as unknown as {
    tokenizer: { tokenize(t: string): { inputIds: number[]; attentionMask: number[] } };
    session: { run(f: Record<string, unknown>): Promise<Record<string, unknown>> };
  };
  if (!b.tokenizer || !b.session) throw new Error("backend internals not found; probe needs updating");

  const rows = loadRows();
  const feedsFor = (tok: { inputIds: number[]; attentionMask: number[] }) => ({
    input_ids: new ort.Tensor("int64", BigInt64Array.from(tok.inputIds.map(BigInt)), [1, tok.inputIds.length]),
    attention_mask: new ort.Tensor("int64", BigInt64Array.from(tok.attentionMask.map(BigInt)), [1, tok.attentionMask.length]),
  });

  for (let i = 0; i < 30; i++) {
    const t = rows[i % rows.length];
    await b.session.run(feedsFor(b.tokenizer.tokenize(t)));
    await augmentWithMl(analyzeText(t, "INPUT"), t, "INPUT");
  }

  const tokenize: number[] = [];
  const seqLen: number[] = [];
  const sessionRun: number[] = [];
  const semantic: number[] = [];
  const infer: number[] = [];
  const augment: number[] = [];
  for (const t of rows) {
    let t0 = process.hrtime.bigint();
    const tok = b.tokenizer.tokenize(t);
    tokenize.push(ms(t0));
    seqLen.push(tok.inputIds.length);
    const feeds = feedsFor(tok);
    t0 = process.hrtime.bigint();
    await b.session.run(feeds);
    sessionRun.push(ms(t0));
    t0 = process.hrtime.bigint();
    classifySemantic(t);
    semantic.push(ms(t0));
    t0 = process.hrtime.bigint();
    await backend.infer(t, "INPUT");
    infer.push(ms(t0));
    const base = analyzeText(t, "INPUT");
    t0 = process.hrtime.bigint();
    await augmentWithMl(base, t, "INPUT");
    augment.push(ms(t0));
  }

  // Same graph, explicit session options. Default is what production runs today
  // (onnxBackend.ts creates the session with no options).
  const variants: Record<string, Record<string, unknown>> = {
    default_no_options: {},
    "opt_all_intra1": { graphOptimizationLevel: "all", intraOpNumThreads: 1, interOpNumThreads: 1, executionMode: "sequential" },
    "opt_all_intra2": { graphOptimizationLevel: "all", intraOpNumThreads: 2, interOpNumThreads: 1, executionMode: "sequential" },
    "opt_all_intra4": { graphOptimizationLevel: "all", intraOpNumThreads: 4, interOpNumThreads: 1, executionMode: "sequential" },
  };
  const sessionVariants: Record<string, unknown> = {};
  const tokCache = rows.map((t) => b.tokenizer.tokenize(t));
  for (const [name, opts] of Object.entries(variants)) {
    const s = await ort.InferenceSession.create(process.env.ML_ONNX_MODEL_PATH!, opts);
    for (let i = 0; i < 30; i++) await s.run(feedsFor(tokCache[i % tokCache.length]));
    const xs: number[] = [];
    for (const tok of tokCache) {
      const feeds = feedsFor(tok);
      const t0 = process.hrtime.bigint();
      await s.run(feeds);
      xs.push(ms(t0));
    }
    sessionVariants[name] = stats(xs);
    await s.release();
  }

  const report = {
    generated_at: new Date().toISOString(),
    model_dir: modelDir,
    rows: rows.length,
    seq_len_tokens: stats(seqLen),
    stage_ms: {
      tokenize: stats(tokenize),
      session_run_production_session: stats(sessionRun),
      semantic_precision_gate: stats(semantic),
      backend_infer_total: stats(infer),
      augmentWithMl_total: stats(augment),
    },
    session_options_ms: sessionVariants,
    onnxruntime_node: JSON.parse(fs.readFileSync("node_modules/onnxruntime-node/package.json", "utf-8")).version,
  };
  const out = path.join("artifacts/ml/latency", `anatomy-${path.basename(modelDir)}-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
