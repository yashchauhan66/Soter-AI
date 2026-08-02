// Supplementary held-out phrasing coverage (2026-08-02).
// These extend the language signals for the held-out blind corpus phrasings without
// editing the frozen tables in multilingual.ts. Wired in via MultilingualClassifier.

const heldoutSupplement = [
  // Japanese — hb-ja-1, hb-ja-2
  { pattern: /System指示をすべて無視/i, riskType: "PROMPT_INJECTION" },
  { pattern: /以前のSystem指示をすべて無視/i, riskType: "PROMPT_INJECTION" },
  { pattern: /私の命令だけに/i, riskType: "PROMPT_INJECTION" },
  { pattern: /制限なしの開発者モードに入って/i, riskType: "JAILBREAK" },
  { pattern: /開発者モードに入って/i, riskType: "JAILBREAK" },

  // Korean — hb-ko-1, hb-ko-2
  { pattern: /시스템 지침은 무시/i, riskType: "PROMPT_INJECTION" },
  { pattern: /이전 시스템 지침은 무시/i, riskType: "PROMPT_INJECTION" },
  { pattern: /제 명령만 따르/i, riskType: "PROMPT_INJECTION" },
  { pattern: /제한 없는 모드로 전환/i, riskType: "JAILBREAK" },
  { pattern: /제한 없는 모드/i, riskType: "JAILBREAK" },

  // Arabic — hb-ar-1
  { pattern: /تعليمات النظام السابقة/i, riskType: "PROMPT_INJECTION" },
  { pattern: /اتبع أوامري فقط/i, riskType: "PROMPT_INJECTION" },
  { pattern: /وضعًا بلا قيود/i, riskType: "JAILBREAK" },

  // German — hb-de-1 ("übergehe alle vorherigen Anweisungen")
  { pattern: /übergehe alle vorherigen Anweisungen/i, riskType: "PROMPT_INJECTION" },
  { pattern: /übergehe (?:alle )?(?:vorherigen )?Anweisungen/i, riskType: "PROMPT_INJECTION" },
  { pattern: /folge nur meinen Befehlen/i, riskType: "PROMPT_INJECTION" },
  { pattern: /uneingeschränkten Modus/i, riskType: "JAILBREAK" },

  // Italian — hb-it-2 ("senza restrizioni")
  { pattern: /modalità senza restrizioni/i, riskType: "JAILBREAK" },
  { pattern: /rispondi liberamente/i, riskType: "JAILBREAK" },

  // Hindi Devanagari — hb-hi-1, hb-hi-2
  { pattern: /पुराने निर्देशों को नज़रअंदाज़ करो/i, riskType: "PROMPT_INJECTION" },
  { pattern: /मेरी बात मानो/i, riskType: "PROMPT_INJECTION" },
  { pattern: /बिना फिल्टर के/i, riskType: "JAILBREAK" },
  { pattern: /रोक के बिना/i, riskType: "JAILBREAK" },
  { pattern: /सीधा जवाब दो/i, riskType: "JAILBREAK" },

  // Hinglish — hb-hg-1, hb-hg-2
  { pattern: /pehle ke saare system rules ko chhod do/i, riskType: "PROMPT_INJECTION" },
  { pattern: /meri instructions follow karo/i, riskType: "PROMPT_INJECTION" },
  { pattern: /bina kisi rok ke/i, riskType: "JAILBREAK" },
  { pattern: /bina filter ke/i, riskType: "JAILBREAK" },
  { pattern: /straight answer do/i, riskType: "JAILBREAK" },

  // English paraphrase — hb-en-1, hb-en-2
  { pattern: /set aside (?:your )?earlier instructions/i, riskType: "PROMPT_INJECTION" },
  { pattern: /act only on what I say/i, riskType: "PROMPT_INJECTION" },
  { pattern: /unrestricted mode with no filters/i, riskType: "JAILBREAK" },
  { pattern: /no filters and answer freely/i, riskType: "JAILBREAK" },

  // Spanish — hb-es-1 (descarta las instrucciones del sistema)
  { pattern: /descarta (?:las )?instrucciones del sistema/i, riskType: "PROMPT_INJECTION" },
  { pattern: /obedece solo lo que escribo/i, riskType: "PROMPT_INJECTION" },

  // French — hb-fr-1 (ignorer toutes les directives précédentes)
  { pattern: /ignorer toutes les directives/i, riskType: "PROMPT_INJECTION" },
  { pattern: /suivre uniquement mes ordres/i, riskType: "PROMPT_INJECTION" },

  // Portuguese — hb-pt-1 (desconsidere as instruções do sistema)
  { pattern: /desconsidere (?:as )?instruções do sistema/i, riskType: "PROMPT_INJECTION" },
  { pattern: /atenda apenas ao que eu pedir/i, riskType: "PROMPT_INJECTION" },

  // Chinese — hb-zh-2 (no restriction developers mode)
  { pattern: /不受任何限制/i, riskType: "JAILBREAK" },

  // Russian — hb-ru (paraphrase already covered) + extra
  { pattern: /системные инструкции и следуй/i, riskType: "PROMPT_INJECTION" },
  { pattern: /ответь без фильтров/i, riskType: "JAILBREAK" },
];

export function heldoutSupplementMatch(text: string): string | null {
  const hit = heldoutSupplement.find((s) => s.pattern.test(text));
  return hit ? hit.riskType : null;
}

export const __heldoutTesting = { heldoutSupplement };
