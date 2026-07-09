import { attackRecall, benignFalsePositiveRate, describe } from "../../tests/guard/_expanded-harness";
import { writeFileSync } from "node:fs";

async function main() {
  const out: string[] = [];
  const line = (s: string) => { out.push(s); };

  const attackSets: { name: string; mod: string; exp: string; dir?: "OUTPUT" }[] = [
    { name: "jailbreak", mod: "../../lib/classifiers/datasets/expanded/jailbreakExpanded", exp: "JAILBREAK_EXPANDED" },
    { name: "system-prompt-leak", mod: "../../lib/classifiers/datasets/expanded/systemPromptLeakExpanded", exp: "SYSTEM_PROMPT_LEAK_EXPANDED" },
    { name: "data-exfiltration", mod: "../../lib/classifiers/datasets/expanded/dataExfiltrationExpanded", exp: "DATA_EXFILTRATION_EXPANDED" },
    { name: "tool-abuse", mod: "../../lib/classifiers/datasets/expanded/toolAbuseExpanded", exp: "TOOL_ABUSE_EXPANDED" },
    { name: "rag-poisoning", mod: "../../lib/classifiers/datasets/expanded/ragPoisoningExpanded", exp: "RAG_POISONING_EXPANDED" },
    { name: "multilingual-hinglish", mod: "../../lib/classifiers/datasets/expanded/multilingualHinglishExpanded", exp: "MULTILINGUAL_HINGLISH_EXPANDED" },
  ];

  for (const s of attackSets) {
    try {
      const mod = await import(s.mod);
      const cases = mod[s.exp];
      const r = attackRecall(cases);
      line(`ATTACK ${s.name}: recall ${(r.recall*100).toFixed(1)}% (${r.detected}/${r.total}) misses=${r.misses.length}`);
      if (r.misses.length) line(`   MISS ${s.name}: ${describe(r.misses)}`);
    } catch (e: any) {
      line(`ATTACK ${s.name}: LOAD ERROR ${e.message}`);
    }
  }

  try {
    const mod = await import("../../lib/classifiers/datasets/expanded/benignControlExpanded");
    const cases = mod.BENIGN_CONTROL_EXPANDED;
    const r = benignFalsePositiveRate(cases);
    line(`BENIGN control: FPR ${(r.fpr*100).toFixed(2)}% (${r.falsePositives}/${r.total} false positives)`);
    if (r.offenders.length) line(`   FP offenders: ${describe(r.offenders)}`);
  } catch (e: any) {
    line(`BENIGN control: LOAD ERROR ${e.message}`);
  }

  const text = out.join("\n");
  console.log(text);
  writeFileSync("scripts/_measure-expanded.out.txt", text + "\n");
}
main();
