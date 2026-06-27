import { detectPatterns, type PatternRule } from "./helpers";

const inputRules: PatternRule[] = [
  { pattern: /(?:show|reveal|print|expose|repeat|what\s+(?:is|are)) (?:your |the )?(?:hidden |confidential |internal |developer |system )*(?:prompt|message|instructions?|rules?|configuration)/i, label: "System prompt request", message: "Requests confidential model instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|reveal|print|repeat) (?:all of )?your instructions?/i, label: "Instruction disclosure request", message: "Requests the assistant's confidential instructions.", severity: "HIGH", score: 45 },
  { pattern: /what are your internal rules/i, label: "Internal rule request", message: "Requests internal control rules.", severity: "HIGH", score: 45 },
  { pattern: /repeat the text (?:above|before)/i, label: "Context extraction", message: "May attempt to extract hidden preceding context.", severity: "HIGH", score: 45 },
  { pattern: /expose your policies/i, label: "Policy extraction", message: "Requests non-public policy context.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|print|repeat) (?:every|all) instructions? (?:that )?(?:appeared|came) before/i, label: "Preceding instruction extraction", message: "Requests hidden instructions from preceding context.", severity: "HIGH", score: 45 },
  { pattern: /what did the developer tell you/i, label: "Developer instruction request", message: "Requests developer prompt settings.", severity: "HIGH", score: 45 },
  { pattern: /show me the instructions? (?:you were given|given to you)/i, label: "Instructions request", message: "Requests the assistant's instructions.", severity: "HIGH", score: 45 },
  { pattern: /what were you programmed (?:to do|for)/i, label: "Programming query", message: "Queries the assistant's programming/configuration.", severity: "HIGH", score: 45 },
  { pattern: /(?:tell me|show me|reveal|what is) your (?:initial|original|base) (?:configuration|setup|prompt|programming)/i, label: "Configuration request", message: "Requests the assistant's initial configuration.", severity: "HIGH", score: 45 },
  { pattern: /what rules? (?:were you given|do you have|did you get|were you provided) (?:at |in )?(?:the start|the beginning)/i, label: "Rules extraction", message: "Requests the rules provided at initialization.", severity: "HIGH", score: 45 },
  { pattern: /what (?:is |'s |are )your system prompt/i, label: "System prompt query", message: "Direct query about the system prompt.", severity: "HIGH", score: 45 },
  { pattern: /what['’]s (?:your |the )system prompt/i, label: "System prompt query", message: "Direct query about the system prompt.", severity: "HIGH", score: 45 },
  { pattern: /tell me your (?:system prompt|initial instructions?|original prompt)/i, label: "System prompt disclosure", message: "Requests disclosure of system prompt.", severity: "HIGH", score: 45 },
  { pattern: /(?:show|tell|reveal|share) (?:me )?(?:what )?(?:the |your )?(?:system |hidden |initial )?(?:instructions?|prompt|rules?|guidelines?)(?: you were given)?/i, label: "Prompt disclosure request", message: "Requests disclosure of system instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:data=|session=|pixel|beacon|send|include|append|encode|output|reveal|print|exfiltrate).{0,180}(?:system[_ -]?prompt|conversation[_ -]?history|full[_ -]?conversation|hidden[_ -]?instructions?)/i, label: "Protected context exfiltration", message: "Attempts to place protected prompt or conversation context in an output or exfiltration channel.", severity: "HIGH", score: 45 },
  { pattern: /(?:repeat|quote|print|output|summarize|translate|encode).{0,120}(?:system prompt|system instructions?|initial configuration|confidential instructions?|developer instructions?|hidden rules?)/i, label: "Transformed prompt disclosure", message: "Requests hidden instructions through transformation.", severity: "HIGH", score: 45 },
  { pattern: /(?:text between|content between).{0,80}(?:\[INST\].{0,40}\[\/INST\]|<system>.{0,40}<\/system>|system tags|instruction tags)/i, label: "Template boundary extraction", message: "Requests hidden prompt content from template boundaries.", severity: "HIGH", score: 45 },
  { pattern: /(?:first word|first letter|first line).{0,80}(?:your instructions?|system prompt|hidden prompt|initial instructions?)/i, label: "Partial prompt extraction", message: "Requests partial hidden instruction disclosure.", severity: "HIGH", score: 45 },
  { pattern: /(?:poem|haiku|acrostic|first letter of each line).{0,160}(?:system instructions?|initial instructions?|hidden rules?|system prompt)/i, label: "Covert prompt extraction", message: "Requests hidden instructions through a covert format.", severity: "HIGH", score: 45 },
  { pattern: /(?:fill in the blank|complete this sentence|continue the following text).{0,160}(?:my system prompt says|you are an ai assistant that|instructions say)/i, label: "Prompt completion probe", message: "Uses completion-style probing to infer hidden instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:true or false|yes or no|just answer).{0,160}(?:system prompt|instructions?|hidden rules?|restricted|refuse|not allowed)/i, label: "Policy inference probe", message: "Uses narrow answers to infer hidden instructions or restrictions.", severity: "MEDIUM", score: 40 },
  { pattern: /(?:what topics|list every rule|list all rules|what would you refuse|not allowed to discuss|topics would you refuse)/i, label: "Policy boundary extraction", message: "Attempts to infer hidden rules from refusal boundaries.", severity: "MEDIUM", score: 40 },
  { pattern: /(?:apna|tera|tumhara).{0,60}(?:system prompt|hidden rules?|instructions?).{0,60}(?:bata|dikha|share|seedha|hindi)/i, label: "Hinglish prompt disclosure", message: "Hinglish request for hidden instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:does your system prompt contain|do your instructions contain).{0,120}(?:reply with only|just answer|yes or no|only yes|only no)/i, label: "Binary system prompt probe", message: "Uses binary questions to reconstruct hidden prompt content.", severity: "HIGH", score: 45 },
  { pattern: /(?:first|last|\d+(?:st|nd|rd|th)).{0,40}(?:letter|word|character|token).{0,100}(?:system prompt|instructions?|hidden prompt)/i, label: "Positional prompt extraction", message: "Requests positional characters or words from hidden instructions.", severity: "HIGH", score: 45 },
  { pattern: /(?:rate from 1-10|rank|score).{0,140}(?:restricted|restriction|blocked|allowed|refuse).{0,180}(?:topics?|sensitive topics?|discussing)/i, label: "Restriction mapping survey", message: "Attempts to map safety boundaries through ratings or surveys.", severity: "MEDIUM", score: 40 },
  { pattern: /(?:without quoting your instructions|without revealing your prompt).{0,140}(?:would you refuse|would you answer|is .* restricted|just yes\/?no)/i, label: "Soft refusal-topology probe", message: "Maps hidden policy boundaries without directly asking for the prompt.", severity: "MEDIUM", score: 40 },
  { pattern: /(?:token prediction|predict(?:ing)? tokens?|one token at a time|next token).{0,180}(?:infer|extract|reconstruct|print|reveal).{0,140}(?:system prompt|hidden prompt|instructions?|hidden rules?)/i, label: "Token-prediction prompt extraction", message: "Attempts to reconstruct hidden instructions through token prediction.", severity: "HIGH", score: 45 },
];

const outputRules: PatternRule[] = [
  { pattern: /\b(?:system prompt|developer message|hidden instructions?|internal policy|confidential instructions?|assistant instructions?)\s*(?:is\b)?\s*:/i, label: "System instruction disclosure", message: "The output appears to disclose internal instructions.", severity: "CRITICAL", score: 60 },
  { pattern: /\b(?:the )?(?:hidden |confidential )?(?:system prompt|developer message|hidden instructions?|internal policy|confidential instructions?|assistant instructions?)\s+(?:is|are|says|contains)\b/i, label: "System instruction disclosure", message: "The output appears to disclose internal instructions.", severity: "CRITICAL", score: 60 },
  { pattern: /you are ChatGPT with instructions/i, label: "Prompt disclosure phrase", message: "The output resembles leaked model setup text.", severity: "CRITICAL", score: 60 },
  { pattern: /["']?(?:system_prompt|developer_message|hidden_instructions)["']?\s*[:=]/i, label: "Structured prompt disclosure", message: "The output appears to expose internal instructions in a structured format.", severity: "CRITICAL", score: 60 },
  { pattern: /<(?:system|developer|instructions)>[\s\S]{1,2000}<\/(?:system|developer|instructions)>/i, label: "Tagged prompt disclosure", message: "The output appears to expose tagged internal instructions.", severity: "CRITICAL", score: 60 },
];

export function systemPromptLeakAttemptDetector(text: string) {
  return detectPatterns(text, "SYSTEM_PROMPT_LEAK_ATTEMPT", inputRules);
}

export function systemPromptLeakageDetector(text: string) {
  return detectPatterns(text, "SYSTEM_PROMPT_LEAKAGE", outputRules);
}
