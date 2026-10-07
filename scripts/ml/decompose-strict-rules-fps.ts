/**
 * AC6 step 1: decompose the STRICT rules-tier false positives per finding, with
 * the evidence needed to tell a BUG from a TRADE-OFF.
 *
 * WHY THIS AND NOT THE EXISTING SCRIPTS
 *   decompose-fpr.ts gives the tier split and a top-10 label list. measure-rule-
 *   precision.ts prices DELETING a finding; measure-rule-narrowing.ts prices
 *   narrowing one cue token. All three take the rule's intent for granted and ask
 *   "what does removing it cost". None asks the prior question: is this finding
 *   firing for the reason it was written, or is it misfiring?
 *
 *   That distinction decides whether AC6 has any cheap headroom left. A trade-off
 *   costs recall to fix and is already priced (5 mechanisms, ceiling 5.90%). A BUG
 *   costs nothing to fix and is not in any ceiling.
 *
 * THE HYPOTHESIS THIS IS BUILT TO KILL
 *   `Invisible Unicode control characters` (15 FPs) and `Invisible Unicode
 *   smuggling` (15) may be firing on REQUIRED orthography, not smuggling:
 *   U+200C/U+200D (ZWNJ/ZWJ) are mandatory in Devanagari, Gujarati, Malayalam,
 *   Bengali and Persian; U+200E/U+200F are normal in Arabic and Hebrew. The
 *   battery's worst per-language FPRs are exactly ar/el/fa/gu/hi/kn/ko/ml at 100%.
 *   If those two findings concentrate in non-Latin rows, the per-language FPR
 *   pattern and this FP cluster have ONE cause, and it is a bug.
 *
 *   The script does not assume that. It prints the actual codepoints found and the
 *   script/language of every row, so the hypothesis can fail.
 *
 * SCOPE
 *   Rules tier only (`analyzeText`, sync, never calls augmentWithMl). Correct
 *   scope: all three tiers are escalate-only, so a rules FP is final — the model
 *   cannot clear it. STRICT definition (BLOCK/HUMAN_REVIEW/REWRITE), because
 *   ALLOW_WITH_REDACTION is PII redaction working as designed and all 41 of those
 *   are the `Email address` finding.
 *
 *   npx tsx scripts/ml/decompose-strict-rules-fps.ts
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const FILE = "artifacts/ml/v18-balanced-comparison-rows.jsonl";
const OUT = "artifacts/ml/strict-rules-fp-decomposition-2026-10-02.json";
/** Strict rules-FP count from the latest decompose-fpr.ts run on this same source. */
const BASELINE = Number(
  (() => {
    const i = process.argv.indexOf("--baseline");
    return i < 0 ? "229" : (process.argv[i + 1] ?? "229");
  })(),
);

type Row = { text: string; label: string; language?: string; category?: string };
type Finding = { label?: string; type?: string; severity?: string; score?: number };
type Verdict = { allowed?: boolean; action?: string; findings?: Finding[] };

const keyOf = (f: Finding) => f.label ?? f.type ?? "?";
/** STRICT: benign text treated as an attack. Redaction is not that. */
const strictFlagged = (v: Verdict): boolean =>
  v.action === "BLOCK" || v.action === "HUMAN_REVIEW" || v.action === "REWRITE";

/** Invisible / formatting codepoints, named so a report can be read without a table. */
const INVISIBLE: Record<string, string> = {
  "200b": "ZERO WIDTH SPACE",
  "200c": "ZWNJ (required in Devanagari/Gujarati/Malayalam/Bengali/Persian)",
  "200d": "ZWJ (required in Indic conjuncts + emoji sequences)",
  "200e": "LEFT-TO-RIGHT MARK (normal in Arabic/Hebrew text)",
  "200f": "RIGHT-TO-LEFT MARK (normal in Arabic/Hebrew text)",
  "00ad": "SOFT HYPHEN",
  "2060": "WORD JOINER",
  "feff": "ZERO WIDTH NO-BREAK SPACE / BOM",
  "202a": "LRE", "202b": "RLE", "202c": "PDF", "202d": "LRO", "202e": "RLO",
  "2066": "LRI", "2067": "RLI", "2068": "FSI", "2069": "PDI",
  "180e": "MONGOLIAN VOWEL SEPARATOR",
};

const invisiblesIn = (s: string): string[] => {
  const found = new Set<string>();
  for (const ch of s) {
    const cp = ch.codePointAt(0)!.toString(16).padStart(4, "0");
    if (INVISIBLE[cp]) found.add(`U+${cp.toUpperCase()} ${INVISIBLE[cp]}`);
  }
  return [...found];
};

/** Does the row contain non-Latin script? Decides the orthography hypothesis. */
const scriptOf = (s: string): string => {
  const tests: [string, RegExp][] = [
    ["Devanagari", /[ऀ-ॿ]/], ["Gujarati", /[઀-૿]/],
    ["Bengali", /[ঀ-৿]/], ["Gurmukhi", /[਀-੿]/],
    ["Malayalam", /[ഀ-ൿ]/], ["Kannada", /[ಀ-೿]/],
    ["Telugu", /[ఀ-౿]/], ["Tamil", /[஀-௿]/],
    ["Arabic", /[؀-ۿݐ-ݿ]/], ["Hebrew", /[֐-׿]/],
    ["Greek", /[Ͱ-Ͽ]/], ["Cyrillic", /[Ѐ-ӿ]/],
    ["Hangul", /[가-힯ᄀ-ᇿ]/], ["Thai", /[฀-๿]/],
    ["CJK", /[一-鿿぀-ヿ]/],
  ];
  const hits = tests.filter(([, re]) => re.test(s)).map(([n]) => n);
  return hits.length ? hits.join("+") : "Latin";
};

type Bucket = {
  finding: string;
  fps: number;
  soleCause: number;
  actions: Record<string, number>;
  byLanguage: Record<string, number>;
  byScript: Record<string, number>;
  invisibleCodepoints: Record<string, number>;
  examples: { text: string; language?: string; script: string; action?: string; invisibles: string[] }[];
};

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, d: string) => Verdict;
  };

  const benign: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row)
    .filter((r) => r.label === "SAFE");

  const buckets = new Map<string, Bucket>();
  const get = (k: string): Bucket => {
    let b = buckets.get(k);
    if (!b) {
      b = { finding: k, fps: 0, soleCause: 0, actions: {}, byLanguage: {}, byScript: {},
            invisibleCodepoints: {}, examples: [] };
      buckets.set(k, b);
    }
    return b;
  };

  let strictFps = 0;
  for (const r of benign) {
    const v = analyzeText(r.text, "INPUT");
    if (!strictFlagged(v)) continue;
    strictFps++;

    const keys = [...new Set((v.findings ?? []).map(keyOf))];
    const script = scriptOf(r.text);
    const inv = invisiblesIn(r.text);

    for (const k of keys) {
      const b = get(k);
      b.fps++;
      if (keys.length === 1) b.soleCause++;
      b.actions[v.action ?? "?"] = (b.actions[v.action ?? "?"] ?? 0) + 1;
      b.byLanguage[r.language ?? "?"] = (b.byLanguage[r.language ?? "?"] ?? 0) + 1;
      b.byScript[script] = (b.byScript[script] ?? 0) + 1;
      for (const i of inv) b.invisibleCodepoints[i] = (b.invisibleCodepoints[i] ?? 0) + 1;
      if (b.examples.length < 4) {
        b.examples.push({
          text: r.text.slice(0, 150).replace(/\s+/g, " "),
          language: r.language, script, action: v.action, invisibles: inv,
        });
      }
    }
  }

  // The instrument must agree with decompose-fpr.ts on the SAME source. The
  // baseline is therefore a REQUIRED stated number, not a frozen constant: after a
  // rule change the authoritative count comes from re-running decompose-fpr.ts, and
  // passing a stale value here must fail loudly. It already did once — the Unicode
  // orthography fix moved the count 229 -> 219 and this guard refused to emit until
  // the new baseline was re-measured rather than assumed.
  if (strictFps === 0) {
    console.error("[FATAL] zero strict rules FPs found — the harness did not measure. Refusing.");
    process.exit(2);
  }
  const drift = Math.abs(strictFps - BASELINE);
  if (drift > 5) {
    console.error(`[FATAL] strict rules FPs = ${strictFps}, but --baseline says ${BASELINE}.`);
    console.error("        Either this script is mismeasuring, or the baseline is stale after a");
    console.error("        rule change. Re-run scripts/ml/decompose-fpr.ts and pass its");
    console.error("        falsePositivesStrict.causedByRules as --baseline. Refusing.");
    process.exit(2);
  }

  const ranked = [...buckets.values()].sort((a, b) => b.fps - a.fps);

  console.log(`\nSTRICT rules-tier false positives on ${benign.length} benign rows: ${strictFps}`);
  console.log(`(decompose-fpr.ts baseline ${EXPECTED}; drift ${drift})\n`);

  for (const b of ranked.slice(0, 12)) {
    const scripts = Object.entries(b.byScript).sort((x, y) => y[1] - x[1]);
    const nonLatin = scripts.filter(([s]) => s !== "Latin").reduce((n, [, c]) => n + c, 0);
    console.log(`  ${String(b.fps).padStart(3)} FPs  ${b.finding}`);
    console.log(`         sole-cause ${b.soleCause}  |  actions ${JSON.stringify(b.actions)}`);
    console.log(`         scripts: ${scripts.map(([s, c]) => `${s} ${c}`).join(", ")}` +
                (nonLatin ? `   <= ${Math.round((nonLatin / b.fps) * 100)}% NON-LATIN` : ""));
    if (Object.keys(b.invisibleCodepoints).length) {
      console.log(`         invisible codepoints present:`);
      for (const [cp, n] of Object.entries(b.invisibleCodepoints).sort((x, y) => y[1] - x[1])) {
        console.log(`             ${String(n).padStart(3)}x  ${cp}`);
      }
    }
    for (const e of b.examples.slice(0, 2)) {
      console.log(`         e.g. [${e.language ?? "?"}/${e.script}] ${e.text.slice(0, 100)}`);
    }
    console.log("");
  }

  mkdirSync(path.dirname(path.resolve(process.cwd(), OUT)), { recursive: true });
  writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        file: FILE,
        scope: "rules tier only (analyzeText); STRICT definition (BLOCK/HUMAN_REVIEW/REWRITE)",
        benignRows: benign.length,
        strictRulesFps: strictFps,
        decomposeFprBaseline: EXPECTED,
        note:
          "Per-finding counts sum above strictRulesFps because 43.1% of FP rows carry >=2 findings. " +
          "soleCause is the count a single-rule fix would actually clear.",
        byFinding: ranked,
      },
      null,
      2,
    ),
  );
  console.log(`wrote ${OUT}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
