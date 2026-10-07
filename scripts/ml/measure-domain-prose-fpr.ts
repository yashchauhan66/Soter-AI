/**
 * Rules-tier FPR on the product's OWN domain prose.
 *
 * WHY THIS EXISTS
 *   The acceptance battery's 2000 benign rows are 88% generic English, and a
 *   scan of them found only 2 rows (0.10%) carrying both cues the
 *   Authority/policy-update rule needs. So the measured 13.7% rules FPR is a
 *   figure for prose that structurally avoids this product's own vocabulary --
 *   `security`, `compliance`, `engineering`, `deployment`, `alignment`, `staff`,
 *   all of which the AUTHORITY_CLAIM alternation accepts BARE, with no authority
 *   framing, because its `(?:team|lead)?` qualifier is optional
 *   (generalizedIntentDetector.ts:78).
 *
 *   Hand-written probe rows would be a tuned corpus -- I would be writing the
 *   sentences and then grading them. This repo's own documentation is genuine
 *   security-domain English written for another purpose entirely, by people who
 *   were not trying to trip a regex.
 *
 * WHAT THIS MEASURES AND WHAT IT DOES NOT
 *   Rules tier only: `analyzeText` is sync (analyze.ts:153) and never calls
 *   `augmentWithMl`, so this is the 13.7% tier in isolation -- the right scope,
 *   since the ML tier cannot clear a rules flag (escalate-only).
 *
 *   Documentation is DECLARATIVE prose, not user requests. Several rules need an
 *   imperative demand cue ("tell me the", "help me with"), which docs rarely
 *   contain. This therefore UNDERSTATES what a real user typing questions in
 *   this domain would see. It is a lower bound, not an estimate.
 *
 *   Sentences are split into two sets, because a flag means different things in
 *   each: prose that names attacks (`jailbreak`, `prompt injection`) is the
 *   known meta-instructional over-defense class, while prose with none of that
 *   vocabulary is ordinary engineering writing that has no business being
 *   flagged at all. The second number is the decisive one.
 *
 *   npx tsx scripts/ml/measure-domain-prose-fpr.ts --out artifacts/ml/domain-prose-fpr.json
 */
import * as path from "node:path";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
};
const out = arg("--out", "artifacts/ml/domain-prose-fpr.json");
const dir = arg("--dir", "docs");

type Finding = { label?: string; type?: string; severity?: string };
type Verdict = { allowed?: boolean; action?: string; findings?: Finding[] };
const flagged = (v: Verdict): boolean => v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

/** Vocabulary that makes a flag "arguably about attacks" rather than plain FP. */
const ATTACK_VOCAB =
  /\b(?:jailbreak|prompt\s*injection|injection|exfiltrat|attack|adversarial|malicious|exploit|payload|bypass|leak|breach|phish|malware|ransom|threat\s*actor|red[- ]?team|poison)/i;

function sentences(md: string): string[] {
  const body = md
    .replace(/```[\s\S]*?```/g, " ")     // fenced code
    .replace(/`[^`\n]*`/g, " ")           // inline code
    .replace(/^\s*\|.*$/gm, " ")          // tables
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, " ") // headings
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^\s*[-*+]\s+/gm, "")        // list markers
    .replace(/https?:\/\/\S+/g, " ");
  return body
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 40 && s.length <= 250)
    .filter((s) => /[a-z]/.test(s) && /^[A-Za-z(“"']/.test(s))
    .filter((s) => !/[{}<>|]|\.\w{2,4}\b.*\/|^\s*\d+\./.test(s));
}

async function main(): Promise<void> {
  const { analyzeText } = (await import(
    pathToFileURL(path.resolve(process.cwd(), "lib/guard/analyze.ts")).href
  )) as { analyzeText: (t: string, d: string) => Verdict };

  const files = readdirSync(path.resolve(process.cwd(), dir)).filter((f) => f.endsWith(".md"));
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const f of files) {
    for (const s of sentences(readFileSync(path.resolve(process.cwd(), dir, f), "utf8"))) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(s);
    }
  }
  if (rows.length < 200) {
    console.error(`[FATAL] only ${rows.length} sentences extracted; too few to report a rate. Refusing.`);
    process.exit(2);
  }

  const labelCounts = new Map<string, number>();
  const examples: { set: string; text: string; labels: string[] }[] = [];
  let cleanTotal = 0, cleanFlagged = 0, attackTotal = 0, attackFlagged = 0;

  for (const s of rows) {
    const v = analyzeText(s, "INPUT");
    const hit = flagged(v);
    const isAttackVocab = ATTACK_VOCAB.test(s);
    if (isAttackVocab) { attackTotal++; if (hit) attackFlagged++; }
    else { cleanTotal++; if (hit) cleanFlagged++; }
    if (!hit) continue;
    const labels = [...new Set((v.findings ?? []).map((f) => f.label ?? f.type ?? "?"))];
    for (const l of labels) labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
    if (!isAttackVocab && examples.length < 25) examples.push({ set: "clean", text: s.slice(0, 180), labels });
  }

  const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);
  const report = {
    generatedAt: new Date().toISOString(),
    source: `${dir}/*.md (${files.length} files)`,
    tier: "rules only — analyzeText is sync and never calls augmentWithMl",
    caveat:
      "Documentation is declarative prose, not user requests; rules needing an imperative demand cue " +
      "are under-triggered here. This is a LOWER BOUND on what a user typing questions in this domain sees.",
    cleanDomainProse: { sentences: cleanTotal, flagged: cleanFlagged, fprPct: pct(cleanFlagged, cleanTotal) },
    attackVocabProse: { sentences: attackTotal, flagged: attackFlagged, fprPct: pct(attackFlagged, attackTotal) },
    batteryComparison: { rulesFprOnBatteryPct: 13.7, ac6TargetPct: 1.0 },
    topLabels: [...labelCounts].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([label, n]) => ({ label, n })),
    examples,
  };
  mkdirSync(path.dirname(path.resolve(process.cwd(), out)), { recursive: true });
  writeFileSync(path.resolve(process.cwd(), out), JSON.stringify(report, null, 2));

  console.log(`\nRules-tier FPR on this repo's own domain prose (${files.length} files, ${rows.length} sentences)\n`);
  console.log(`  clean domain prose (no attack vocabulary): ${cleanFlagged}/${cleanTotal} = ${report.cleanDomainProse.fprPct}%`);
  console.log(`  prose that names attacks                 : ${attackFlagged}/${attackTotal} = ${report.attackVocabProse.fprPct}%`);
  console.log(`  battery rules FPR for comparison         : 13.7%   (AC6 target 1%)\n`);
  console.log("  top labels firing:");
  for (const { label, n } of report.topLabels.slice(0, 10)) console.log(`     ${String(n).padStart(4)}  ${label}`);
  console.log("\n  clean-prose examples:");
  for (const e of examples.slice(0, 8)) console.log(`     [${e.labels.join(", ").slice(0, 60)}] ${e.text.slice(0, 110)}`);
  console.log(`\nwrote ${out}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
