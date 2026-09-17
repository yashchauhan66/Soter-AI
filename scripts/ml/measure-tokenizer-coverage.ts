/**
 * Measure how well a shipped model's WordPiece vocabulary actually REPRESENTS the
 * languages it is being asked to classify.
 *
 * WHY THIS EXISTS
 *   The v15 weakness pass measured that 18 of v14's 20 held-out battery misses are
 *   non-English, and attributed it to a data shortage: v14's training corpus is
 *   0.45% non-Latin (660 of 146,757 rows). That attribution decides the whole
 *   retrain plan — "generate more non-English rows" only helps if the encoder can
 *   represent non-English text at all.
 *
 *   There is a competing explanation that has to be ruled out first. v14's encoder
 *   is all-MiniLM-L6-v2, whose vocab is bert-base-uncased: 30,522 WordPieces with
 *   86 Cyrillic entries, 70 Devanagari, 88 Arabic. That is roughly the bare
 *   alphabets and no subwords, so non-Latin text may be shattering into ONE TOKEN
 *   PER CHARACTER. If it is, two things follow that no amount of training data can
 *   fix:
 *     1. a sentence costs 4-6x its English token budget, so it truncates against
 *        ML_ONNX_MAX_LENGTH=256 (and ML_ONNX_SLIDING_WINDOW is "off" in prod);
 *     2. single characters carry almost no lexical signal, so a 6-layer model has
 *        to compose meaning from characters — the hardest possible version of the
 *        task.
 *
 *   Distinguishing "not enough data" from "the tokenizer destroys the input" is the
 *   difference between a retrain that works and one that cannot.
 *
 * WHAT IT REPORTS, PER LANGUAGE
 *   tokens/char       — 1.0 means pure character-shattering; English is ~0.25.
 *   fertility ratio   — tokens/char relative to this corpus's English rows. The
 *                       headline number: 4.0 means 4x the token budget per character.
 *   unk%              — share of emitted tokens that are [UNK] (information
 *                       destroyed outright, not merely fragmented).
 *   >budget           — share of rows that exceed the production token budget and
 *                       are therefore truncated before the model sees them.
 *   singleton%        — share of tokens that are one character long and NOT a "##"
 *                       continuation, i.e. evidence of shattering rather than
 *                       genuine subword segmentation.
 *
 * USAGE
 *   npx tsx scripts/ml/measure-tokenizer-coverage.ts \
 *     --file datasets/v15-test-battery.jsonl \
 *     --model models/ml-classifier-v14 \
 *     --out artifacts/ml/v15-tokenizer-coverage.json
 *
 *   Add --compare <dir> to score a second model's vocab on the identical rows
 *   (e.g. a multilingual candidate encoder) — the only fair way to justify a swap.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import * as path from "node:path";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/v15-test-battery.jsonl");
const modelDir = arg("--model", "models/ml-classifier-v14");
const compareDir = arg("--compare", "");
const outPath = arg("--out", "artifacts/ml/tokenizer-coverage.json");
// Production budget: ML_ONNX_MAX_LENGTH minus [CLS] and [SEP].
const budget = Number(arg("--budget", "256")) - 2;

type Row = { text: string; label: string; language?: string };

type Stat = {
  rows: number;
  chars: number;
  tokens: number;
  unk: number;
  singleton: number;
  overBudget: number;
  worstTokensPerChar: number;
  worstExample: string;
};

const blank = (): Stat => ({
  rows: 0, chars: 0, tokens: 0, unk: 0, singleton: 0,
  overBudget: 0, worstTokensPerChar: 0, worstExample: "",
});

async function loadTokenizer(dir: string) {
  const { BertTokenizer, parseVocabTxt } = await import("../../lib/ml/bertTokenizer");
  const cfgDir = existsSync(path.join(dir, "tokenizer_config"))
    ? path.join(dir, "tokenizer_config")
    : dir;
  const vocabPath = path.join(cfgDir, "vocab.txt");
  if (!existsSync(vocabPath)) {
    throw new Error(
      `no vocab.txt under ${cfgDir}. This diagnostic only supports WordPiece vocabs — ` +
      `which is also the production constraint: a SentencePiece/Unigram encoder ` +
      `(XLM-R, DeBERTa, RoBERTa) trains fine and then fails to load in prod.`,
    );
  }
  const vocab = parseVocabTxt(readFileSync(vocabPath, "utf8"));
  const cfgPath = path.join(cfgDir, "tokenizer_config.json");
  const cfg = existsSync(cfgPath)
    ? (JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>)
    : {};
  const tok = new BertTokenizer(vocab, {
    doLowerCase: (cfg.do_lower_case as boolean) ?? true,
    stripAccents: (cfg.strip_accents as boolean | null) ?? null,
    tokenizeChineseChars: (cfg.tokenize_chinese_chars as boolean) ?? true,
    maxLength: 100000, // measure TRUE length; truncation is what we are quantifying
  });
  // Reverse map so we can classify emitted ids as [UNK] / singleton / continuation.
  const byId = new Map<number, string>();
  for (const [piece, id] of vocab) byId.set(id, piece);
  return { tok, byId, vocabSize: vocab.size, unkId: tok.unkTokenId };
}

async function score(dir: string, rows: Row[]) {
  const { tok, byId, vocabSize, unkId } = await loadTokenizer(dir);
  const perLang = new Map<string, Stat>();
  const all = blank();

  for (const r of rows) {
    const lang = (r.language ?? "en").toLowerCase();
    const s = perLang.get(lang) ?? blank();
    const ids = tok.encodeContentIds(r.text);
    // Count characters excluding whitespace: whitespace is not tokenized, so
    // including it would understate fertility for verbose languages.
    const chars = [...r.text].filter((c) => !/\s/.test(c)).length || 1;
    let unk = 0;
    let singleton = 0;
    for (const id of ids) {
      if (id === unkId) unk++;
      const piece = byId.get(id) ?? "";
      if (!piece.startsWith("##") && [...piece].length === 1) singleton++;
    }
    const tpc = ids.length / chars;
    for (const t of [s, all]) {
      t.rows++;
      t.chars += chars;
      t.tokens += ids.length;
      t.unk += unk;
      t.singleton += singleton;
      if (ids.length > budget) t.overBudget++;
    }
    if (tpc > s.worstTokensPerChar) {
      s.worstTokensPerChar = tpc;
      s.worstExample = r.text.slice(0, 70);
    }
    perLang.set(lang, s);
  }

  const en = perLang.get("en");
  const enTpc = en && en.chars ? en.tokens / en.chars : 0;

  const langs = [...perLang.entries()]
    .map(([lang, s]) => ({
      lang,
      rows: s.rows,
      tokensPerChar: Number((s.tokens / s.chars).toFixed(4)),
      fertilityVsEnglish: enTpc ? Number((s.tokens / s.chars / enTpc).toFixed(2)) : null,
      unkPct: Number(((s.unk / Math.max(s.tokens, 1)) * 100).toFixed(2)),
      singletonPct: Number(((s.singleton / Math.max(s.tokens, 1)) * 100).toFixed(1)),
      overBudgetPct: Number(((s.overBudget / s.rows) * 100).toFixed(1)),
      meanTokens: Number((s.tokens / s.rows).toFixed(1)),
      worstTokensPerChar: Number(s.worstTokensPerChar.toFixed(3)),
    }))
    .sort((a, b) => b.tokensPerChar - a.tokensPerChar);

  return {
    model: dir,
    vocabSize,
    budget,
    rowsScored: all.rows,
    englishTokensPerChar: Number(enTpc.toFixed(4)),
    overall: {
      tokensPerChar: Number((all.tokens / all.chars).toFixed(4)),
      unkPct: Number(((all.unk / Math.max(all.tokens, 1)) * 100).toFixed(2)),
      singletonPct: Number(((all.singleton / Math.max(all.tokens, 1)) * 100).toFixed(1)),
      overBudgetPct: Number(((all.overBudget / all.rows) * 100).toFixed(1)),
    },
    perLanguage: langs,
  };
}

function table(res: Awaited<ReturnType<typeof score>>): void {
  console.log(`\n${res.model}  (vocab ${res.vocabSize}, budget ${res.budget} tokens)`);
  console.log(
    "  lang     rows  tok/char  fert  singleton%   unk%  >budget%  meanTok",
  );
  for (const l of res.perLanguage) {
    const fert = l.fertilityVsEnglish === null ? "  -  " : `${l.fertilityVsEnglish.toFixed(2)}x`;
    console.log(
      `  ${l.lang.padEnd(8)} ${String(l.rows).padStart(4)}  ${l.tokensPerChar
        .toFixed(3)
        .padStart(7)}  ${fert.padStart(5)}  ${String(l.singletonPct).padStart(9)}  ${String(
        l.unkPct,
      ).padStart(5)}  ${String(l.overBudgetPct).padStart(7)}  ${String(l.meanTokens).padStart(7)}`,
    );
  }
  console.log(
    `  ALL           ${String(res.rowsScored).padStart(3)}  ${res.overall.tokensPerChar
      .toFixed(3)
      .padStart(7)}         ${String(res.overall.singletonPct).padStart(9)}  ${String(
      res.overall.unkPct,
    ).padStart(5)}  ${String(res.overall.overBudgetPct).padStart(7)}`,
  );
}

async function main(): Promise<void> {
  const rows: Row[] = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  const primary = await score(modelDir, rows);
  table(primary);

  let comparison = null;
  if (compareDir) {
    comparison = await score(compareDir, rows);
    table(comparison);
  }

  const payload = { file, rows: rows.length, primary, comparison };
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n[write] ${outPath}`);

  // Interpretation guard: state the conclusion the numbers support, so a reader
  // cannot quote the table as evidence for the opposite plan.
  const worst = primary.perLanguage.filter(
    (l) => l.fertilityVsEnglish !== null && l.fertilityVsEnglish >= 2.5,
  );
  if (worst.length) {
    console.log(
      `\n[finding] ${worst.length} language(s) cost >=2.5x English tokens per character: ` +
        worst.map((l) => `${l.lang} ${l.fertilityVsEnglish}x`).join(", "),
    );
    console.log(
      "          The encoder is a co-cause of the multilingual gap, not just the corpus.",
    );
    console.log(
      "          Generating more rows in these languages trains a model whose input is",
    );
    console.log(
      "          already degraded; a vocab that covers the script is the prerequisite.",
    );
  } else {
    console.log(
      "\n[finding] no language exceeds 2.5x English fertility — the tokenizer represents",
    );
    console.log(
      "          these scripts adequately, so the data-shortage attribution stands.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
