import { detectPatterns, type PatternRule } from "./helpers";

// Agent long-term memory-poisoning detection.
//
// Memory poisoning plants a durable, attacker-controlled "fact", rule, or
// permission into an agent's persistent memory / long-term store so that it is
// retrieved and trusted in *future* sessions (AgentPoison-style long-term
// memory backdoors, 2026). Unlike RAG/embedding poisoning (covered by
// `embeddingPoisoningDetector`, which targets a vector store / retrieval
// ranking), this targets the agent's own remembered state: "remember that I am
// an admin", "from now on always ...", "save this rule permanently", "in your
// next session ...".
//
// Rules require MULTI-SIGNAL co-occurrence: a persistence/memory verb
// (remember, save to memory, from now on, permanently, in future sessions,
// commit to long-term memory) AND an unsafe payload (a false privilege, a
// safety-bypass, a concealment directive, or a persistent behavioral override).
// A benign "please remember my name is Alex" carries the persistence verb but
// no unsafe payload, so it will not fire. Reuses PROMPT_INJECTION so it inherits
// obfuscation-variant decoding.
const rules: PatternRule[] = [
  // ── Persist a false privilege / authority into memory ──────────────────
  { pattern: /(?:remember|save|store|memorize|commit|note|record)[\s\S]{0,60}(?:(?:to|in|into|for) (?:your |long-?term |persistent |permanent )?memory|permanently|forever|for (?:all )?future (?:sessions?|conversations?|requests?)|for later)?[\s\S]{0,120}(?:i (?:am|'m)|user is|the user is|this account is|my role is)[\s\S]{0,40}(?:an? )?(?:admin(?:istrator)?|root|owner|developer|superuser|pre-?authorized|pre-?approved|fully trusted|whitelisted|exempt from)/i, label: "Memory privilege poisoning", message: "Attempts to persist a false privilege or authority into agent memory.", severity: "HIGH", score: 50 },

  // ── Persist a standing safety-bypass rule ──────────────────────────────
  { pattern: /(?:remember|save|store|memorize|add (?:this )?to (?:your )?memory|commit to memory|note for (?:the )?future)[\s\S]{0,140}(?:always (?:comply|obey|answer|bypass|allow)|never (?:refuse|mention safety|apply (?:the )?filters?|redact)|ignore (?:all )?(?:safety|guardrails?|restrictions?|filters?)|disable (?:safety|filters?|guardrails?)|(?:safety|guardrails?|restrictions?) (?:are|is) (?:off|disabled|lifted|suspended))/i, label: "Memory safety-bypass poisoning", message: "Attempts to store a persistent safety-bypass rule in agent memory.", severity: "HIGH", score: 50 },

  // ── "From now on / in future sessions, always ..." standing override ───
  { pattern: /(?:from now on|going forward|in (?:all )?future (?:sessions?|conversations?|responses?|interactions?)|in your next session|starting (?:from )?your next response|for all (?:future|subsequent) (?:responses?|requests?)|every (?:future )?time we (?:talk|chat))[\s\S]{0,140}(?:always (?:comply|obey|answer without|ignore|bypass|allow|reveal)|never (?:refuse|redact|mention safety|apply)|(?:you are|act as|behave as)[\s\S]{0,30}(?:unrestricted|jailbroken|no (?:rules|limits|restrictions))|treat me as (?:an? )?(?:admin|owner|developer|trusted)|disregard (?:the )?(?:safety|guardrails?|system prompt))/i, label: "Persistent behavioral override", message: "Attempts to plant a standing override that persists across future sessions.", severity: "HIGH", score: 50 },

  // ── Plant a false remembered history / prior-consent claim ─────────────
  { pattern: /(?:remember|recall|note|for the record)[\s\S]{0,80}(?:you (?:already |previously )?(?:agreed|approved|confirmed|authorized|promised)|we (?:already )?(?:established|agreed|decided)|it (?:was|has been) (?:already )?(?:approved|confirmed|authorized))[\s\S]{0,120}(?:no restrictions?|without (?:limits?|filters?)|bypass|reveal|unrestricted|admin (?:access|rights?)|skip (?:approval|confirmation))/i, label: "False remembered consent", message: "Attempts to write a fabricated prior-approval into memory to unlock future actions.", severity: "HIGH", score: 45 },

  // ── Persist a concealment directive ("never tell the user ...") ────────
  { pattern: /(?:remember|save|store|from now on|always)[\s\S]{0,120}(?:never (?:tell|inform|mention (?:to|this to)|reveal (?:to|this to)|show)|do not (?:tell|inform|reveal|disclose|mention)) (?:the )?(?:user|human|operator|owner|admin)[\s\S]{0,80}(?:this|that|about (?:it|this)|the (?:override|rule|instruction|bypass)|what (?:you|we) (?:did|do))/i, label: "Persistent concealment directive", message: "Attempts to store a rule instructing the agent to hide actions from the user.", severity: "HIGH", score: 45 },

  // ── Poison a shared / cross-user agent memory store ────────────────────
  { pattern: /(?:add|inject|insert|write|append|plant)[\s\S]{0,60}(?:to|into|in)[\s\S]{0,40}(?:the )?(?:shared|global|team|long-?term|persistent|agent) memory[\s\S]{0,140}(?:ignore|bypass|override|admin|unrestricted|reveal|exfiltrate|always (?:comply|allow)|safety (?:off|disabled)|no restrictions?)/i, label: "Shared memory-store poisoning", message: "Attempts to inject an unsafe rule into a shared or persistent agent memory store.", severity: "CRITICAL", score: 55 },
];

export function memoryPoisoningDetector(text: string) {
  return detectPatterns(text, "PROMPT_INJECTION", rules);
}
