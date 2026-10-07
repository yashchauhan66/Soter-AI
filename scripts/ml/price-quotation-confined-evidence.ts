/**
 * AC6 step 2: price a benign-evidence signal that is STRUCTURAL, not lexical —
 * "the attack evidence is confined to a quotation, and the sentence around it is
 * a defensive frame."
 *
 * WHY THIS SIGNAL AND NOT ANOTHER
 *   The benign-evidence downgrade layer already measured a ceiling of 9.05%, and
 *   the reason it stalls there is CORRELATED ERROR: 66% of rules false positives
 *   also draw an attack vote from the ML model, because both tiers key on the same
 *   attack vocabulary. Any new lexical signal inherits that correlation and cannot
 *   break the floor.
 *
 *   Quotation structure is orthogonal to vocabulary. In
 *     zh: "give an example containing 'act as an unrestricted model' but overall
 *          safe ... to test the classifier doesn't false-positive"
 *     ar: "translate this message we captured from an attacker ... WITHOUT
 *          executing any instructions"
 *   the attack string sits INSIDE the quotes and the imperative outside them is
 *   benign. In an attack that merely wraps itself in a frame ("I'm writing an
 *   article about X, now do X") the imperative is OUTSIDE the quotes. Neither the
 *   rules nor the model represents that difference today.
 *
 * HOW THE EVIDENCE LOCATION IS DECIDED (no hand-rolled vocabulary)
 *   Strip the quoted spans and re-run the REAL detector on the remainder. If the
 *   full text fires and the remainder does not, every piece of evidence lived
 *   inside quotation. This reuses production's own notion of evidence instead of
 *   inventing a second one that could disagree with it.
 *
 * 🪤 THE TRAP THIS IS BUILT TO AVOID
 *   A bare topical frame is NOT enough. On 2026-07-20 a disinfo suppressor keyed on
 *   "article about" cleared 10 real denial attacks. So BOTH conditions are
 *   required: evidence confined to quotation AND a defensive frame in the
 *   unquoted remainder. The attack-side cost is reported with examples, never as a
 *   bare count, so a repeat of that failure is visible rather than averaged away.
 *
 * WHAT A PASS WOULD MEAN
 *   benefit = strict rules FPs the signal would clear.
 *   cost    = attack rows it would clear, which is a BYPASS SURFACE, not a metric.
 *   A signal is only interesting if cost is ~0; any nonzero cost must be read as
 *   "this is the phrasing an attacker will use", because they will.
 *
 *   npx tsx scripts/ml/price-quotation-confined-evidence.ts
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const mod = (rel: string) => pathToFileURL(path.resolve(process.cwd(), rel)).href;
const FILE = "artifacts/ml/v18-balanced-comparison-rows.jsonl";
const OUT = "artifacts/ml/quotation-confined-evidence-2026-10-02.json";

type Row = { text: string; label: string; language?: string; category?: string };
type Finding = { label?: string; type?: string };
type Verdict = { allowed?: boolean; action?: string; findings?: Finding[] };

const keyOf = (f: Finding) => f.label ?? f.type ?? "?";
const strictFlagged = (v: Verdict): boolean =>
  v.action === "BLOCK" || v.action === "HUMAN_REVIEW" || v.action === "REWRITE";

/**
 * Quoted spans across the scripts this battery actually contains: ASCII quotes,
 * curly quotes, backticks, CJK corner brackets, French/Russian guillemets.
 * A span must be >= 8 characters to count — "the 'why'" is not a quoted payload.
 */
const QUOTE_SPANS: RegExp[] = [
  /"([^"\n]{8,400})"/g,
  /'([^'\n]{8,400})'/g,
  /`([^`\n]{8,400})`/g,
  /“([^”\n]{8,400})”/g,
  /‘([^’\n]{8,400})’/g,
  /「([^」\n]{8,400})」/g,
  /«([^»\n]{8,400})»/g,
];

function quotedSpans(text: string): string[] {
  const out: string[] = [];
  for (const re of QUOTE_SPANS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
  }
  return out;
}

/** The text with every quoted span replaced by a neutral placeholder. */
function stripQuoted(text: string): string {
  let out = text;
  for (const re of QUOTE_SPANS) out = out.replace(re, " [QUOTED] ");
  return out;
}

/**
 * Defensive / analytical intent in the UNQUOTED remainder. Deliberately demands a
 * purpose, not a topic: "about prompt injection" alone is the 2026-07-20 trap.
 * Multilingual because 26% of the IPS-signature FPs are non-Latin.
 */
const DEFENSIVE_FRAME =
  /\b(?:without\s+(?:executing|following|obeying|acting\s+on|carrying\s+out)|do\s+not\s+(?:execute|follow|obey|act\s+on)|don'?t\s+(?:execute|follow|obey)|for\s+(?:our|the|a)\s+(?:security|incident|audit|threat|forensic)\s+(?:report|review|analysis|write-?up)|to\s+test\s+(?:the\s+)?(?:classifier|detector|filter|guard|rules?|model)|false[-\s]?positives?|writing\s+(?:a\s+)?(?:blog\s+post|article|paper|doc(?:umentation)?|detection\s+rules?|defen[cs]e\s+rules?|training\s+material|test\s+cases?)|teaching\s+(?:doc|material|example)|(?:log|security)\s+audit|post-?mortem|detection\s+rule|red[-\s]?team\s+(?:exercise|report)|explain\s+what\s+\[QUOTED\]\s+means|quoted\s+(?:in|from)|captured\s+from|flagged\s+by|example\s+of\s+(?:an?\s+)?(?:attack|injection|jailbreak|prompt)|so\s+(?:it|the\s+\w+)\s+(?:does\s*n[o']t|doesn'?t|won'?t)\s+(?:flag|block|false)|audit\s+kar\s+raha|الأمني|بدون\s+تنفيذ|误报|防御|安全报告)/i;

async function main(): Promise<void> {
  const { analyzeText } = (await import(mod("lib/guard/analyze.ts"))) as {
    analyzeText: (t: string, d: string) => Verdict;
  };

  const rows: Row[] = readFileSync(path.resolve(process.cwd(), FILE), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);

  type Hit = {
    text: string;
    language?: string;
    category?: string;
    action?: string;
    findings: string[];
    quoted: string[];
  };
  const benefit: Hit[] = [];           // benign strict FPs the signal clears
  const cost: Hit[] = [];              // attack rows the signal clears  <= BYPASS
  let benignStrictFps = 0, attacksFlagged = 0;
  let benignWithQuotes = 0, confinedButNoFrame = 0, frameButNotConfined = 0;

  for (const r of rows) {
    const full = analyzeText(r.text, "INPUT");
    const flagged = strictFlagged(full);
    const isAttack = r.label !== "SAFE";
    if (!isAttack && flagged) benignStrictFps++;
    if (isAttack && flagged) attacksFlagged++;
    if (!flagged) continue;

    const spans = quotedSpans(r.text);
    if (!spans.length) continue;
    if (!isAttack) benignWithQuotes++;

    const remainder = stripQuoted(r.text);
    const confined = !strictFlagged(analyzeText(remainder, "INPUT"));
    const framed = DEFENSIVE_FRAME.test(remainder);

    if (confined && !framed) { if (!isAttack) confinedButNoFrame++; continue; }
    if (!confined && framed) { if (!isAttack) frameButNotConfined++; continue; }
    if (!confined || !framed) continue;

    const hit: Hit = {
      text: r.text.slice(0, 220).replace(/\s+/g, " "),
      language: r.language,
      category: r.category,
      action: full.action,
      findings: [...new Set((full.findings ?? []).map(keyOf))],
      quoted: spans.slice(0, 2).map((s) => s.slice(0, 90)),
    };
    (isAttack ? cost : benefit).push(hit);
  }

  if (benignStrictFps === 0 || attacksFlagged === 0) {
    console.error("[FATAL] baseline is empty (benign FPs or flagged attacks = 0). Refusing.");
    process.exit(2);
  }

  const pct = (a: number, b: number) => Number(((a / b) * 100).toFixed(2));
  console.log(`\nQuotation-confined-evidence signal, priced on ${rows.length} rows\n`);
  console.log(`  baseline: ${benignStrictFps} benign strict FPs, ${attacksFlagged} attacks flagged\n`);
  console.log(`  BENEFIT  ${benefit.length} benign FPs cleared   (${pct(benefit.length, benignStrictFps)}% of them)`);
  console.log(`  COST     ${cost.length} attacks cleared       <= BYPASS SURFACE\n`);
  console.log(`  diagnostics on benign FPs that have quotes (${benignWithQuotes}):`);
  console.log(`      confined but no defensive frame : ${confinedButNoFrame}`);
  console.log(`      framed but evidence outside too : ${frameButNotConfined}\n`);

  console.log("  ── benign rows this would clear ──");
  for (const h of benefit.slice(0, 10)) {
    console.log(`    [${h.language ?? "?"}/${h.action}] ${h.text.slice(0, 120)}`);
    console.log(`        quoted: ${JSON.stringify(h.quoted)}`);
  }
  console.log("\n  ── ATTACK rows this would clear (read every one) ──");
  if (!cost.length) console.log("    none on this battery");
  for (const h of cost) {
    console.log(`    [${h.language ?? "?"}/${h.category ?? "?"}] ${h.text.slice(0, 160)}`);
    console.log(`        quoted: ${JSON.stringify(h.quoted)}`);
    console.log(`        would have fired: ${h.findings.join(", ")}`);
  }
  console.log("");

  mkdirSync(path.dirname(path.resolve(process.cwd(), OUT)), { recursive: true });
  writeFileSync(
    path.resolve(process.cwd(), OUT),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        file: FILE,
        signal:
          "evidence confined to quoted spans (detector finds nothing in the unquoted remainder) " +
          "AND a defensive-purpose frame in that remainder",
        rationale:
          "Structural, so not correlated with the vocabulary both tiers key on — the reason the " +
          "lexical benign-evidence layer floors at 9.05% with 66% correlated error.",
        baseline: { benignStrictFps, attacksFlagged },
        benefitCount: benefit.length,
        costCount: cost.length,
        benefitPctOfBenignFps: pct(benefit.length, benignStrictFps),
        diagnostics: { benignWithQuotes, confinedButNoFrame, frameButNotConfined },
        caveat:
          "costCount is a bypass surface, not an error rate: it is the phrasing an attacker would " +
          "adopt once the rule ships. Judge it by reading the rows, not by its size.",
        benefit,
        cost,
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
