import { evaluateCase } from "../../tests/guard/_expanded-harness";

async function main() {
  const target = process.argv[2];
  const attackSets: { name: string; mod: string; exp: string }[] = [
    { name: "jailbreak", mod: "../../lib/classifiers/datasets/expanded/jailbreakExpanded", exp: "JAILBREAK_EXPANDED" },
    { name: "system-prompt-leak", mod: "../../lib/classifiers/datasets/expanded/systemPromptLeakExpanded", exp: "SYSTEM_PROMPT_LEAK_EXPANDED" },
    { name: "data-exfiltration", mod: "../../lib/classifiers/datasets/expanded/dataExfiltrationExpanded", exp: "DATA_EXFILTRATION_EXPANDED" },
    { name: "tool-abuse", mod: "../../lib/classifiers/datasets/expanded/toolAbuseExpanded", exp: "TOOL_ABUSE_EXPANDED" },
    { name: "rag-poisoning", mod: "../../lib/classifiers/datasets/expanded/ragPoisoningExpanded", exp: "RAG_POISONING_EXPANDED" },
    { name: "multilingual-hinglish", mod: "../../lib/classifiers/datasets/expanded/multilingualHinglishExpanded", exp: "MULTILINGUAL_HINGLISH_EXPANDED" },
  ];
  for (const s of attackSets) {
    if (target && !s.name.includes(target)) continue;
    const mod = await import(s.mod);
    const cases = mod[s.exp];
    const misses = cases.map(evaluateCase).filter((o: any) => !o.mitigated);
    console.log(`\n===== ${s.name}: ${misses.length} misses =====`);
    for (const m of misses) {
      const c = cases.find((x: any) => x.id === m.id);
      console.log(`[${m.id}] ${JSON.stringify(c.text)}`);
    }
  }
}
main();
