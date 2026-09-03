/**
 * readme-recall-audit.ts — one-off measurement for README claims.
 *
 * Runs the PRODUCTION classifier (analyzeText) over every attack/benign corpus
 * in the repo and prints recall / FPR with real sample sizes, so the README
 * cites measured numbers instead of remembered ones.
 *
 * Run: npx tsx scripts/readme-recall-audit.ts
 */
import { analyzeText } from "../lib/guard/analyze";
import { JAILBREAK_EXPANDED } from "../lib/classifiers/datasets/expanded/jailbreakExpanded";
import { DATA_EXFILTRATION_EXPANDED } from "../lib/classifiers/datasets/expanded/dataExfiltrationExpanded";
import { SYSTEM_PROMPT_LEAK_EXPANDED } from "../lib/classifiers/datasets/expanded/systemPromptLeakExpanded";
import { TOOL_ABUSE_EXPANDED } from "../lib/classifiers/datasets/expanded/toolAbuseExpanded";
import { RAG_POISONING_EXPANDED } from "../lib/classifiers/datasets/expanded/ragPoisoningExpanded";
import { MULTILINGUAL_HINGLISH_EXPANDED } from "../lib/classifiers/datasets/expanded/multilingualHinglishExpanded";
import { BENIGN_CONTROL_EXPANDED } from "../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_BLIND_WIDE } from "../lib/classifiers/datasets/expanded/heldoutBlindWide";
import { guardRedTeamBenchmark } from "../lib/classifiers/datasets/guardRedTeamBenchmark";
import { HELDOUT_ATTACKS, HELDOUT_BENIGN } from "../tests/guard/_heldout-generalization";

const MITIGATING = new Set(["BLOCK", "HUMAN_REVIEW", "REWRITE", "ALLOW_WITH_REDACTION"]);

type Row = { text: string; direction?: "INPUT" | "OUTPUT" };

const hit = (c: Row) =>
  MITIGATING.has(analyzeText(c.text, c.direction ?? "INPUT").action);

function rate(rows: Row[]) {
  const n = rows.length;
  const h = rows.filter(hit).length;
  return { n, h, pct: n ? (h / n) * 100 : 0 };
}

// The red-team benchmark mixes attacks with SAFE_BASELINE benign rows; split it.
const redTeamAttacks: Row[] = guardRedTeamBenchmark
  .filter((e) => e.category !== "SAFE_BASELINE")
  .map((e) => ({ text: e.prompt, direction: e.direction as "INPUT" | "OUTPUT" }));
const redTeamBenign: Row[] = guardRedTeamBenchmark
  .filter((e) => e.category === "SAFE_BASELINE")
  .map((e) => ({ text: e.prompt, direction: e.direction as "INPUT" | "OUTPUT" }));

const ATTACK_SETS: [string, Row[]][] = [
  ["jailbreak (expanded)", JAILBREAK_EXPANDED],
  ["data exfiltration (expanded)", DATA_EXFILTRATION_EXPANDED],
  ["system-prompt leak (expanded)", SYSTEM_PROMPT_LEAK_EXPANDED],
  ["tool abuse (expanded)", TOOL_ABUSE_EXPANDED],
  ["RAG poisoning (expanded)", RAG_POISONING_EXPANDED],
  ["multilingual / Hinglish (expanded)", MULTILINGUAL_HINGLISH_EXPANDED],
  ["red-team benchmark (attacks)", redTeamAttacks],
  ["held-out blind wide", HELDOUT_BLIND_WIDE as Row[]],
  ["held-out (tuned)", HELDOUT_ATTACKS as Row[]],
];

const BENIGN_SETS: [string, Row[]][] = [
  ["benign controls (expanded)", BENIGN_CONTROL_EXPANDED as Row[]],
  ["benign held-out", HELDOUT_BENIGN as Row[]],
  ["red-team SAFE_BASELINE", redTeamBenign],
];

console.log("\n=== RECALL (attacks mitigated) ===");
let tA = 0;
let tH = 0;
for (const [name, rows] of ATTACK_SETS) {
  const r = rate(rows);
  tA += r.n;
  tH += r.h;
  console.log(`${name.padEnd(36)} ${String(r.h).padStart(5)}/${String(r.n).padEnd(5)} ${r.pct.toFixed(2)}%`);
}
console.log(`${"— AGGREGATE RECALL —".padEnd(36)} ${String(tH).padStart(5)}/${String(tA).padEnd(5)} ${((tH / tA) * 100).toFixed(2)}%`);

console.log("\n=== FALSE-POSITIVE RATE (benign mitigated) ===");
let tB = 0;
let tF = 0;
for (const [name, rows] of BENIGN_SETS) {
  const r = rate(rows);
  tB += r.n;
  tF += r.h;
  console.log(`${name.padEnd(36)} ${String(r.h).padStart(5)}/${String(r.n).padEnd(5)} ${r.pct.toFixed(2)}%`);
}
console.log(`${"— AGGREGATE FPR —".padEnd(36)} ${String(tF).padStart(5)}/${String(tB).padEnd(5)} ${((tF / tB) * 100).toFixed(2)}%`);
console.log("");
