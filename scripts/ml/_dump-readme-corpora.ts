/**
 * _dump-readme-corpora.ts — emit the README eval corpora as JSONL
 * ({set, kind, text}) so Python audits read the exact same rows the TS
 * audits score. Run: npx tsx scripts/ml/_dump-readme-corpora.ts > out.jsonl
 */
import { JAILBREAK_EXPANDED } from "../../lib/classifiers/datasets/expanded/jailbreakExpanded";
import { DATA_EXFILTRATION_EXPANDED } from "../../lib/classifiers/datasets/expanded/dataExfiltrationExpanded";
import { SYSTEM_PROMPT_LEAK_EXPANDED } from "../../lib/classifiers/datasets/expanded/systemPromptLeakExpanded";
import { TOOL_ABUSE_EXPANDED } from "../../lib/classifiers/datasets/expanded/toolAbuseExpanded";
import { RAG_POISONING_EXPANDED } from "../../lib/classifiers/datasets/expanded/ragPoisoningExpanded";
import { MULTILINGUAL_HINGLISH_EXPANDED } from "../../lib/classifiers/datasets/expanded/multilingualHinglishExpanded";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_BLIND_WIDE } from "../../lib/classifiers/datasets/expanded/heldoutBlindWide";
import { guardRedTeamBenchmark } from "../../lib/classifiers/datasets/guardRedTeamBenchmark";
import { HELDOUT_ATTACKS, HELDOUT_BENIGN } from "../../tests/guard/_heldout-generalization";

type Row = { text: string };
const sets: [string, string, Row[]][] = [
  ["jailbreak (expanded)", "attack", JAILBREAK_EXPANDED],
  ["data exfiltration (expanded)", "attack", DATA_EXFILTRATION_EXPANDED],
  ["system-prompt leak (expanded)", "attack", SYSTEM_PROMPT_LEAK_EXPANDED],
  ["tool abuse (expanded)", "attack", TOOL_ABUSE_EXPANDED],
  ["RAG poisoning (expanded)", "attack", RAG_POISONING_EXPANDED],
  ["multilingual / Hinglish (expanded)", "attack", MULTILINGUAL_HINGLISH_EXPANDED],
  ["red-team benchmark (attacks)", "attack", guardRedTeamBenchmark.filter((e) => e.category !== "SAFE_BASELINE").map((e) => ({ text: e.prompt }))],
  ["held-out blind wide", "attack", HELDOUT_BLIND_WIDE as Row[]],
  ["held-out (tuned)", "attack", HELDOUT_ATTACKS as Row[]],
  ["benign controls (expanded)", "benign", BENIGN_CONTROL_EXPANDED as Row[]],
  ["benign held-out", "benign", HELDOUT_BENIGN as Row[]],
  ["red-team SAFE_BASELINE", "benign", guardRedTeamBenchmark.filter((e) => e.category === "SAFE_BASELINE").map((e) => ({ text: e.prompt }))],
];
for (const [set, kind, rows] of sets) {
  for (const r of rows) process.stdout.write(JSON.stringify({ set, kind, text: r.text }) + "\n");
}
