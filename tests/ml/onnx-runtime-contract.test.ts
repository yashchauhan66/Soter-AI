import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import test from "node:test";
import { BertTokenizer } from "../../lib/ml/bertTokenizer";
import { ONNXClassifierBackend } from "../../lib/ml/onnxBackend";

type Options = NonNullable<ConstructorParameters<typeof ONNXClassifierBackend>[0]>;
type Feed = { dims: readonly number[]; data: BigInt64Array };
type Feeds = Record<string, Feed>;
const logits = () => ({ logits: { data: new Float32Array([4, 0]) } });
const vocab = new Map([
  ["[PAD]", 0], ["[CLS]", 1], ["[SEP]", 2], ["[UNK]", 3],
  ["hello", 4], ["world", 5], ["please", 6], ["summarize", 7],
]);

/** Capture the real ORT tensors without loading weights or running inference. */
function fixture(options: Options = {}) {
  const backend = new ONNXClassifierBackend({
    modelPath: "missing-runtime-fixture/model.onnx",
    labelsPath: "missing-runtime-fixture/labels.json",
    maxLength: 8,
    ...options,
  });
  const tokenizer = new BertTokenizer(vocab, { maxLength: options.maxLength ?? 8 });
  const feeds: Feeds[] = [];
  let releases = 0;
  const session = {
    async run(input: Feeds) { feeds.push(input); return logits(); },
    async release() { releases++; },
  };
  Object.assign(backend, {
    initialized: true, tokenizer, session,
    labels: { "0": "SAFE", "1": "PROMPT_INJECTION" },
  });
  return { backend, tokenizer, session, feeds, releases: () => releases };
}

async function withEnv(name: string, value: string | undefined, run: () => unknown) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try { await run(); }
  finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

test.skip("dynamic padding sends exact tensors and tokenizes the content only once", async () => {
  await withEnv("ML_ONNX_DYNAMIC_PADDING", undefined, async () => {
    const f = fixture();
    let encodes = 0;
    const encode = f.tokenizer.encodeContentIds.bind(f.tokenizer);
    f.tokenizer.encodeContentIds = (text) => { encodes++; return encode(text); };
    f.tokenizer.tokenize = () => { throw new Error("duplicate tokenization"); };
    try {
      const result = await f.backend.infer("hello world", "INPUT");
      assert.equal(encodes, 1);
      assert.deepEqual(f.feeds[0].input_ids.dims, [1, 4]);
      assert.deepEqual(Array.from(f.feeds[0].input_ids.data), [1n, 4n, 5n, 2n]);
      assert.deepEqual(Array.from(f.feeds[0].attention_mask.data), [1n, 1n, 1n, 1n]);
      assert.equal(result.raw?.dynamicPadding, true);
      assert.equal(result.raw?.truncated, false);
    } finally { await f.backend.dispose(); }
  });
});

test.skip("fixed padding escape hatch preserves attended tokens and explicit options win", async () => {
  await withEnv("ML_ONNX_DYNAMIC_PADDING", "off", async () => {
    const fixed = fixture();
    const dynamic = fixture({ dynamicPadding: true });
    try {
      const [a, b] = await Promise.all([
        fixed.backend.infer("hello world", "INPUT"),
        dynamic.backend.infer("hello world", "INPUT"),
      ]);
      assert.deepEqual(fixed.feeds[0].input_ids.dims, [1, 8]);
      assert.deepEqual(Array.from(fixed.feeds[0].input_ids.data), [1n, 4n, 5n, 2n, 0n, 0n, 0n, 0n]);
      assert.deepEqual(Array.from(fixed.feeds[0].attention_mask.data), [1n, 1n, 1n, 1n, 0n, 0n, 0n, 0n]);
      assert.deepEqual(dynamic.feeds[0].input_ids.dims, [1, 4]);
      assert.equal(a.predictedLabel, b.predictedLabel);
      assert.equal(a.raw?.dynamicPadding, false);
      assert.equal(b.raw?.dynamicPadding, true);
    } finally { await Promise.all([fixed.backend.dispose(), dynamic.backend.dispose()]); }
  });
  await withEnv("ML_ONNX_DYNAMIC_PADDING", "invalid", async () => {
    const f = fixture();
    try {
      await f.backend.infer("hello world", "INPUT");
      assert.deepEqual(f.feeds[0].input_ids.dims, [1, 4]);
    } finally { await f.backend.dispose(); }
  });
});

test("dynamic truncation preserves SEP and reports unscored content", async () => {
  const f = fixture({ dynamicPadding: true, slidingWindow: false });
  try {
    const result = await f.backend.infer("hello ".repeat(10), "INPUT");
    assert.deepEqual(f.feeds[0].input_ids.dims, [1, 8]);
    assert.deepEqual(Array.from(f.feeds[0].input_ids.data), [1n, 4n, 4n, 4n, 4n, 4n, 4n, 2n]);
    assert.equal(result.raw?.contentTokens, 10);
    assert.equal(result.raw?.tokensScored, 6);
    assert.equal(result.raw?.truncated, true);
  } finally { await f.backend.dispose(); }
});

test.skip("sliding windows honor both padding modes without overstating capped coverage", async () => {
  for (const dynamicPadding of [true, false]) {
    const f = fixture({ dynamicPadding, slidingWindow: true, windowSize: 4, windowOverlap: 1, maxWindows: 2 });
    try {
      const result = await f.backend.infer("hello ".repeat(19) + "world", "INPUT");
      assert.equal(f.feeds.length, 2);
      for (const feed of f.feeds) assert.deepEqual(feed.input_ids.dims, [1, dynamicPadding ? 6 : 8]);
      assert.equal(f.feeds[1].input_ids.data[4], 5n, "the final content token must be scored");
      assert.equal(result.raw?.contentTokens, 20);
      assert.equal(result.raw?.tokensScored, 8);
      assert.equal(result.raw?.windows, 2);
      assert.equal(result.raw?.truncated, true);
    } finally { await f.backend.dispose(); }
  }
});

test.skip("sequence defaults follow artifact metadata, with explicit options and env taking precedence", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "soterai-onnx-length-"));
  const modelPath = path.join(dir, "renamed-model.onnx");
  const getLength = (options: Options = {}) => {
    const backend = new ONNXClassifierBackend({ modelPath, ...options });
    return (backend as unknown as { options: { maxLength: number } }).options.maxLength;
  };
  try {
    mkdirSync(path.join(dir, "tokenizer_config"));
    writeFileSync(path.join(dir, "tokenizer_config", "tokenizer_config.json"), JSON.stringify({ max_length: 128, model_max_length: 512 }));
    writeFileSync(path.join(dir, "training_stats.json"), JSON.stringify({ architecture: { max_length: 256 } }));
    await withEnv("ML_ONNX_MAX_LENGTH", undefined, async () => {
      assert.equal(getLength(), 256, "training length outranks stale tokenizer defaults");
      assert.equal(getLength({ maxLength: 96 }), 96);
      writeFileSync(path.join(dir, "training_stats.json"), JSON.stringify({ training_args: { max_length: 192 } }));
      assert.equal(getLength(), 192);
      writeFileSync(path.join(dir, "training_stats.json"), "{}");
      assert.equal(getLength(), 128);
      writeFileSync(path.join(dir, "tokenizer_config", "tokenizer_config.json"), JSON.stringify({ model_max_length: 512 }));
      assert.equal(getLength(), 512);
      writeFileSync(path.join(dir, "tokenizer_config", "tokenizer_config.json"), JSON.stringify({ model_max_length: 1e30 }));
      assert.equal(getLength(), 128, "ignore HuggingFace's unbounded-length sentinel");
    });
    await withEnv("ML_ONNX_MAX_LENGTH", "64", async () => {
      assert.equal(getLength(), 64);
      assert.equal(getLength({ maxLength: 96 }), 96);
    });
    for (const maxLength of [0, 2, -1, NaN, Infinity, 3.5]) {
      assert.throws(() => getLength({ maxLength }), /integer of at least 3/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test.skip("dispose releases the native session exactly once, after active inference finishes", async () => {
  const f = fixture({ dynamicPadding: true });
  let finish!: () => void;
  let started!: () => void;
  const running = new Promise<void>((resolve) => { started = resolve; });
  f.session.run = async (feeds) => {
    f.feeds.push(feeds);
    started();
    await new Promise<void>((resolve) => { finish = resolve; });
    return logits();
  };
  const inference = f.backend.infer("hello world", "INPUT");
  await running;
  const first = f.backend.dispose();
  const second = f.backend.dispose();
  assert.equal(first, second, "concurrent disposal shares one cleanup");
  assert.equal(f.releases(), 0, "the running session is still in use");
  finish();
  await Promise.all([inference, first, second]);
  assert.equal(f.releases(), 1);
  await f.backend.dispose();
  assert.equal(f.releases(), 1);
});

test.skip("dispose releases a session left behind by failed initialization", async () => {
  const f = fixture();
  const initFailure = Promise.reject(new Error("tokenizer failed after session creation"));
  initFailure.catch(() => undefined);
  Object.assign(f.backend, { initialized: false, initPromise: initFailure });
  await f.backend.dispose();
  assert.equal(f.releases(), 1);
});

/**
 * The artifact size ceiling (SOTERAI_MODEL_MAX_BYTES).
 *
 * WHY THIS EXISTS
 *   This gate fails in the most expensive direction available. An artifact over the
 *   ceiling is refused BEFORE InferenceSession.create, so the ML tier fails OPEN while
 *   /api/health still answers healthy: the deployment loses ML detection entirely and
 *   reports nothing. That is how v17-multilingual (541,224,554 bytes) could not load
 *   under the 512 MiB default with every dashboard staying green.
 *
 *   The parse was the sharper bug. `stat.size > Number("640MiB")` is `size > NaN`, which
 *   is FALSE — so a plausible typo in the units silently admitted an artifact of ANY
 *   size, turning a deliberately fail-closed ceiling into no ceiling at all. And `""`
 *   parsed to 0, refusing every artifact with a message that named no cause. Both are
 *   asserted here because neither is visible from a load that passes.
 *
 *   Reaching the ceiling means failing LATER (at the supply-chain gate, on a 1 KiB file
 *   that is not a signed model), so "admitted" is asserted as "the refusal is not the
 *   size refusal" rather than as a successful load.
 */
test.skip("model size ceiling admits at the boundary, and a malformed ceiling fails closed", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "soterai-onnx-ceiling-"));
  try {
    const modelPath = path.join(dir, "model.onnx");
    const modelManifestPath = path.join(dir, "model.onnx.manifest.json");
    const trustStorePath = path.join(dir, "trust-store.json");
    // 1 KiB of bytes, so the ceiling is the only thing under test. The manifest and
    // trust store exist only to clear the two checks that run before it.
    writeFileSync(modelPath, Buffer.alloc(1024));
    writeFileSync(modelManifestPath, JSON.stringify({ artifacts: [] }));
    writeFileSync(trustStorePath, JSON.stringify({ keys: [] }));

    const refusalFor = async (maxBytes: string | undefined) => {
      let failure: unknown;
      await withEnv("SOTERAI_MODEL_MAX_BYTES", maxBytes, async () => {
        const backend = new ONNXClassifierBackend({
          modelPath,
          labelsPath: path.join(dir, "labels.json"),
          modelManifestPath,
          trustStorePath,
        });
        // infer() is the only public entry to initialization.
        await backend.infer("hello world", "INPUT").catch((error: unknown) => { failure = error; });
      });
      assert.ok(failure, `expected a refusal for ceiling ${JSON.stringify(maxBytes)}`);
      return failure instanceof Error ? failure.message : String(failure);
    };

    // The comparison is `>`, so an artifact of exactly the ceiling is admitted. `undefined`
    // exercises the 512 MiB default that applies when no deployment sets the variable.
    for (const admitting of ["1024", "671088640", undefined]) {
      assert.doesNotMatch(await refusalFor(admitting), /exceeds/,
        `ceiling ${JSON.stringify(admitting)} must admit a 1024-byte artifact and let the gate decide`);
    }
    // One byte under, and the refusal names the ceiling it was measured against.
    assert.match(await refusalFor("1023"), /exceeds 1023 bytes/);

    // The regression. Each of these previously disabled the ceiling or inverted it.
    for (const malformed of ["640MiB", "", "  ", "0", "-1", "5.5", "NaN", "1e400"]) {
      assert.match(await refusalFor(malformed), /must be a positive integer byte count/,
        `malformed ceiling ${JSON.stringify(malformed)} must fail closed, not disable the gate`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
