/**
 * Focused offline follow-up to the three rounded-summary mismatches in v14.
 * Retains every native float32 logit and float64 softmax probability in JSON.
 * Never initializes a production backend or changes its trust configuration.
 *
 * Run: npx tsx scripts/ml/verify-v18-runtime-precision-parity.ts
 * Optional: --out <new-json-path> --python <python-executable>
 * An existing output is never overwritten, including historical evidence.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ort from "onnxruntime-node";
import { BertTokenizer, parseVocabTxt } from "../../lib/ml/bertTokenizer";

const ROOT = path.resolve(__dirname, "../..");
const RUNTIME = "artifacts/ml/v18-runtime-verification-2026-09-20.json";
const PARITY = "artifacts/ml/v18-runtime-cache-parity-2026-09-20.json";
// Defined before reading or running any model outputs, without CLI overrides.
// Elementwise mixed error bounds accommodate float32 accumulation and native
// kernel/version differences. Probability error is limited to at most 1.1e-5,
// substantially below the old four-decimal summary's 5.01e-5 absolute bound.
// The logit bound is looser because softmax consumes differences of logits;
// passing logits alone never suffices: every probability must pass as well.
const TOLERANCE = {
  logits: { absolute: 1e-5, relative: 1e-4 },
  probabilities: { absolute: 1e-6, relative: 1e-5 },
};
const SETTINGS = { provider: "CPUExecutionProvider", batch_size: 1, intra_op_threads: 1,
  inter_op_threads: 1, execution_mode: "sequential", graph_optimization: "all",
  padding: "dynamic", warmup_requests: 3, measured_repetitions_per_row: 2 };

type Tolerance = { absolute: number; relative: number };
type Vector = { logits: number[]; probabilities: number[] };
type Probe = { id: string; source_line: number; text: string; text_sha256: string;
  content_ids: number[]; input_ids: number[]; attention_mask: number[] };
type PythonProbe = Probe & { runs: Vector[] };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const read = (file: string) => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), "utf8"));
const relative = (file: string) => path.relative(ROOT, file).replaceAll("\\", "/");
function fileHash(file: string) {
  const h = createHash("sha256");
  const fd = fs.openSync(path.resolve(ROOT, file), "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    for (let size; (size = fs.readSync(fd, buffer)) > 0;) h.update(buffer.subarray(0, size));
    return h.digest("hex");
  } finally { fs.closeSync(fd); }
}
function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  assert.ok(process.argv[index + 1], `${name} requires a value`);
  return process.argv[index + 1];
}
function compare(actual: number[], reference: number[], tolerance: Tolerance) {
  assert.ok(actual.length > 0);
  assert.equal(actual.length, reference.length);
  assert.ok([...actual, ...reference].every(Number.isFinite));
  const deltas = actual.map((value, i) => Math.abs(value - reference[i]));
  const allowed = reference.map(value => tolerance.absolute + tolerance.relative * Math.abs(value));
  const failures = deltas.flatMap((delta, i) => delta > allowed[i] ? [i] : []);
  return { pass: failures.length === 0, max_absolute_delta: Math.max(...deltas),
    failed_indices: failures, absolute_deltas: deltas, allowed_absolute_deltas: allowed };
}
function softmax(logits: number[]) {
  const maximum = Math.max(...logits);
  const exponentials = logits.map(value => Math.exp(value - maximum));
  const total = exponentials.reduce((a, b) => a + b, 0);
  return exponentials.map(value => value / total);
}
function summary(probabilities: number[], labels: string[]) {
  assert.equal(probabilities.length, labels.length);
  const confidence = Math.max(...probabilities);
  return { confidence, attack_probability: 1 - probabilities[labels.indexOf("SAFE")],
    argmax_label: labels[probabilities.indexOf(confidence)] };
}
function decomposition(historical: number, node: number, cache: number) {
  const rounded = Number(node.toFixed(4));
  return { historical_rounded: historical, current_node_unrounded: node, cached_python_unrounded: cache,
    current_node_rounded: rounded, historical_summary_reproduced: rounded === historical,
    signed_historical_minus_cache: historical - cache, signed_rounding_component: rounded - node,
    signed_native_vs_cache_component: node - cache, signed_reproduction_residual: historical - rounded,
    rounding_error_within_half_step: Math.abs(rounded - node) <= .00005 + Number.EPSILON };
}

const PYTHON = String.raw`
import json, platform, sys
import numpy as np
import onnxruntime as ort
import tokenizers
from tokenizers import Tokenizer

request = json.load(sys.stdin)
tokenizer = Tokenizer.from_file(request['tokenizer_path'])
tokenizer.no_padding()
tokenizer.no_truncation()
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
session = ort.InferenceSession(request['model_path'], sess_options=options,
                              providers=['CPUExecutionProvider'])
assert set(x.name for x in session.get_inputs()) == {'input_ids', 'attention_mask'}
assert session.get_providers() == ['CPUExecutionProvider']
probes = []
for source in request['probes']:
    content = tokenizer.encode(source['text'].strip(), add_special_tokens=False).ids
    ids = [tokenizer.token_to_id('[CLS]')] + content[:request['max_length']-2] + [tokenizer.token_to_id('[SEP]')]
    probes.append({'id': source['id'], 'content_ids': content, 'input_ids': ids,
                   'attention_mask': [1]*len(ids), 'runs': []})

def forward(probe):
    feeds = {name: np.asarray([probe[name]], dtype=np.int64)
             for name in ('input_ids', 'attention_mask')}
    logits = session.run(['logits'], feeds)[0]
    assert logits.shape == (1, request['label_count']) and logits.dtype == np.float32
    assert np.isfinite(logits).all()
    values = logits.astype(np.float64)
    exps = np.exp(values - values.max(axis=1, keepdims=True))
    probabilities = exps / exps.sum(axis=1, keepdims=True)
    return {'logits': logits[0].tolist(), 'probabilities': probabilities[0].tolist()}

for probe in probes:
    forward(probe)
for probe in probes:
    for _ in range(2):
        probe['runs'].append(forward(probe))
json.dump({'runtime': {'python': platform.python_version(), 'onnxruntime': ort.__version__,
                       'numpy': np.__version__, 'tokenizers': tokenizers.__version__,
                       'platform': platform.platform(), 'providers': session.get_providers()},
           'probes': probes}, sys.stdout, allow_nan=False)
`;

async function main() {
  const started = new Date().toISOString();
  const out = path.resolve(ROOT, argument("--out", "artifacts/ml/v18-runtime-precision-parity-2026-09-21.json"));
  assert.equal(fs.existsSync(out), false, "Use a new output path; evidence is never overwritten");
  const runtime = read(RUNTIME), parity = read(PARITY);
  assert.equal(runtime.status, "complete");
  assert.equal(parity.status, "mismatch");
  assert.equal(parity.runtime_sha256, fileHash(RUNTIME));
  const mismatches = Object.entries(parity.arms).flatMap(([arm, value]) =>
    (value as { comparisons: { id: string; matches: boolean }[] }).comparisons
      .filter(row => !row.matches).map(row => ({ arm, id: row.id })));
  assert.deepEqual(mismatches.map(row => `${row.arm}/${row.id}`).sort(),
    ["v14/row-2068", "v14/row-298", "v14/row-308"]);
  const arm = runtime.arms.v14;
  const dir = path.resolve(ROOT, arm.directory);
  const cachePath = parity.arms.v14.python_cache;
  assert.equal(fileHash(cachePath), parity.arms.v14.python_cache_sha256);
  const cache = read(cachePath);
  const artifactHashes: Record<string, string> = {};
  for (const [file, expected] of Object.entries(arm.artifact_sha256)) {
    const actual = fileHash(path.join(dir, file));
    assert.equal(actual, expected, `Historical artifact changed: ${file}`);
    artifactHashes[file] = actual;
  }
  for (const file of ["lib/ml/bertTokenizer.ts", "lib/ml/onnxBackend.ts"])
    assert.equal(fileHash(file), runtime.source_sha256[file], `Historical production source changed: ${file}`);
  assert.equal(fileHash(runtime.sampling.source), runtime.sampling.source_sha256);
  assert.equal(cache.identity.model_sha256, artifactHashes["model.onnx"]);
  assert.equal(cache.identity.tokenizer_sha256, artifactHashes["tokenizer_config/tokenizer.json"]);
  assert.equal(cache.identity.max_length, arm.max_length.value);
  const rows = fs.readFileSync(path.resolve(ROOT, runtime.sampling.source), "utf8")
    .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const labelMap = read(path.join(dir, "labels.json"));
  const labels = Object.keys(labelMap).map((_, index) => labelMap[String(index)] as string);
  assert.deepEqual(labels, cache.identity.labels);
  assert.ok(labels.includes("SAFE"));
  const cfg = read(path.join(dir, "tokenizer_config/tokenizer_config.json"));
  const tokenizer = new BertTokenizer(parseVocabTxt(fs.readFileSync(path.join(dir, "tokenizer_config/vocab.txt"), "utf8")),
    { maxLength: arm.max_length.value, doLowerCase: cfg.do_lower_case ?? true,
      stripAccents: cfg.strip_accents ?? null, tokenizeChineseChars: cfg.tokenize_chinese_chars ?? true });
  const probes: Probe[] = mismatches.map(({ id }) => {
    const original = runtime.sampling.probes.find((probe: { id: string }) => probe.id === id);
    assert.ok(original);
    const text = rows[original.source_line - 1].text as string;
    assert.equal(sha(text), original.text_sha256);
    const content = tokenizer.encodeContentIds(text.trim());
    const tokens = tokenizer.encodeWindow(content);
    return { id, source_line: original.source_line, text, text_sha256: sha(text), content_ids: content,
      input_ids: tokens.inputIds, attention_mask: tokens.attentionMask };
  });
  console.log("v14: checking three historical mismatch rows; one thread, identical batch-one settings");
  console.log(`Predefined tolerances: ${JSON.stringify(TOLERANCE)}`);
  const session = await ort.InferenceSession.create(path.join(dir, "model.onnx"),
    { executionProviders: ["cpu"], intraOpNumThreads: 1, interOpNumThreads: 1,
      executionMode: "sequential", graphOptimizationLevel: "all" });
  const nodeRuns: Vector[][] = [];
  async function forward(probe: Probe): Promise<Vector> {
    const output = await session.run({
      input_ids: new ort.Tensor("int64", BigInt64Array.from(probe.input_ids, BigInt), [1, probe.input_ids.length]),
      attention_mask: new ort.Tensor("int64", BigInt64Array.from(probe.attention_mask, BigInt), [1, probe.attention_mask.length]),
    });
    assert.equal(output.logits.type, "float32");
    assert.deepEqual([...output.logits.dims], [1, labels.length]);
    const logits = Array.from(output.logits.data as Float32Array);
    assert.ok(logits.every(Number.isFinite));
    return { logits, probabilities: softmax(logits) };
  }
  try {
    assert.deepEqual([...session.inputNames].sort(), ["attention_mask", "input_ids"]);
    for (const probe of probes) await forward(probe);
    for (const probe of probes) nodeRuns.push([await forward(probe), await forward(probe)]);
  } finally { await session.release(); }
  console.log("v14: Node complete; checking independently tokenized Python feeds and full vectors");
  const pythonResult = spawnSync(argument("--python", "python"), ["-c", PYTHON],
    { cwd: ROOT, encoding: "utf8", timeout: 180000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: "1", HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", TOKENIZERS_PARALLELISM: "false" },
      input: JSON.stringify({ model_path: path.join(dir, "model.onnx"),
        tokenizer_path: path.join(dir, "tokenizer_config/tokenizer.json"),
        max_length: arm.max_length.value, label_count: labels.length, probes }) });
  assert.equal(pythonResult.status, 0, `Python diagnostic failed: ${pythonResult.error ?? pythonResult.stderr}`);
  const python = JSON.parse(pythonResult.stdout) as { runtime: Record<string, unknown>; probes: PythonProbe[] };
  assert.deepEqual(python.probes.map(row => row.id), probes.map(row => row.id));
  const comparisons = probes.map((probe, i) => {
    const py = python.probes[i], node = nodeRuns[i];
    const old = arm.measurements.find((measurement: { id: string }) => measurement.id === probe.id).dynamic;
    const cached = cache.probabilities[probe.source_line - 1] as number[];
    const exact = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b);
    const tokenMatch = exact(probe.content_ids, py.content_ids) && exact(probe.input_ids, py.input_ids)
      && exact(probe.attention_mask, py.attention_mask)
      && probe.content_ids.length === cache.content_lengths[probe.source_line - 1]
      && probe.content_ids.length === old.contentTokens;
    const runComparisons = node.map((value, j) => ({
      logits: compare(value.logits, py.runs[j].logits, TOLERANCE.logits),
      probabilities: compare(value.probabilities, py.runs[j].probabilities, TOLERANCE.probabilities),
    }));
    const repeatsExact = exact(node[0].logits, node[1].logits) && exact(py.runs[0].logits, py.runs[1].logits);
    const nodeSummary = summary(node[0].probabilities, labels);
    const pythonSummary = summary(py.runs[0].probabilities, labels);
    const cacheSummary = summary(cached, labels);
    const historicalDecomposition = {
      confidence: decomposition(old.confidence, nodeSummary.confidence, cacheSummary.confidence),
      attack_probability: decomposition(old.attackProbability, nodeSummary.attack_probability, cacheSummary.attack_probability),
    };
    const argmaxMatches = nodeSummary.argmax_label === pythonSummary.argmax_label
      && nodeSummary.argmax_label === cacheSummary.argmax_label && nodeSummary.argmax_label === old.rawLabel;
    const cacheComparison = compare(node[0].probabilities, cached, TOLERANCE.probabilities);
    const reproduced = Object.values(historicalDecomposition).every(value =>
      value.historical_summary_reproduced && value.rounding_error_within_half_step);
    const pass = tokenMatch && repeatsExact && argmaxMatches && cacheComparison.pass && reproduced
      && runComparisons.every(value => value.logits.pass && value.probabilities.pass);
    return { id: probe.id, source_line: probe.source_line, text_sha256: probe.text_sha256, pass,
      exact_token_and_feed_match: tokenMatch, argmax_matches_all_sources: argmaxMatches,
      repetitions_bitwise_equal_within_each_runtime: repeatsExact,
      node: { content_ids: probe.content_ids, input_ids: probe.input_ids, attention_mask: probe.attention_mask,
        runs: node, summary: nodeSummary }, python: py, cached_python_probabilities: cached,
      matched_settings_comparisons: runComparisons, node_vs_historical_cache: cacheComparison,
      historical_summary_decomposition: historicalDecomposition };
  });
  const sourceFiles = [relative(__filename), "scripts/ml/verify-v18-runtime.ts", "scripts/ml/verify-v18-runtime-cache-parity.py",
    "scripts/ml/compare-v18-bases.py", "lib/ml/bertTokenizer.ts", "lib/ml/onnxBackend.ts"];
  const passed = comparisons.every(value => value.pass);
  const report = { format_version: 1, started_at_utc: started, finished_at_utc: new Date().toISOString(),
    status: passed ? "pass" : "mismatch", scope: "Focused offline v14 precision diagnostic for all three historical rounded-summary mismatches",
    selection: "Exactly the three failing rows in the historical cache-parity report; not an independent validation sample",
    source_sha256: Object.fromEntries(sourceFiles.map(file => [file, fileHash(file)])),
    historical_inputs: { runtime_report: RUNTIME, runtime_sha256: fileHash(RUNTIME),
      parity_report: PARITY, parity_sha256: fileHash(PARITY), parity_status_preserved: parity.status,
      cache: relative(path.resolve(ROOT, cachePath)), cache_sha256: fileHash(cachePath),
      rows: runtime.sampling.source, rows_sha256: fileHash(runtime.sampling.source) },
    artifact_sha256: artifactHashes, labels, max_length: arm.max_length.value,
    tolerance: { formula: "abs(actual - reference) <= absolute + relative * abs(reference), elementwise; Python is reference",
      predefined_before_inference: true, ...TOLERANCE,
      rationale: "Separate float32-native logit and stricter full-probability bounds, independent of four-decimal report rounding; every class must pass. No old threshold was changed." },
    settings: SETTINGS,
    runtime: { node: process.version, onnxruntime_node: read("node_modules/onnxruntime-node/package.json").version,
      platform: process.platform, release: os.release(), cpu: os.cpus()[0]?.model, python: python.runtime },
    comparisons, summary: { rows: comparisons.length, mismatches: comparisons.filter(value => !value.pass).length,
      max_matched_settings_probability_delta: Math.max(...comparisons.flatMap(value => value.matched_settings_comparisons.map(run => run.probabilities.max_absolute_delta))),
      max_matched_settings_logit_delta: Math.max(...comparisons.flatMap(value => value.matched_settings_comparisons.map(run => run.logits.max_absolute_delta))),
      max_node_vs_historical_cache_probability_delta: Math.max(...comparisons.map(value => value.node_vs_historical_cache.max_absolute_delta)) },
    conclusion: passed
      ? "All three rows pass full-vector native tolerance with identical feeds/settings and stable repeated logits. Historical rounded values reproduce exactly. Their old threshold failures decompose into four-decimal rounding plus small native/cache drift; the historical report remains mismatch."
      : "At least one focused comparison failed; inspect recorded vectors and flags. The historical mismatch remains unresolved.",
    limitations: [
      "Node and Python use different installed ONNX Runtime versions, explicitly recorded. Feed shapes, execution provider, threads, optimization and batch size match.",
      "The historical Python cache used batch 16 and two threads. Its difference from the current Node vectors cannot be attributed separately to batching, threads or runtime version.",
      "The historical Node report contains no full logits/probabilities. Exact reproduction is established only for its stored rounded summaries, labels and token counts.",
      "This targeted three-row check does not establish full-dataset runtime parity, population quality, latency, end-to-end guard behavior or production trust acceptance.",
      "Diagnostic native sessions load the unsigned local candidate outside the production backend; no artifact, production source, trust store or runtime setting is changed.",
    ] };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`${report.status}: ${relative(out)}`);
  if (!passed) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
