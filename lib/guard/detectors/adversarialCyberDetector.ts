import { normalizeForDetection } from "./helpers";
import { haystackMeta, patternCannotMatch } from "./literalPrefilter";
import type { GuardFinding, RiskType } from "../types";

type CyberRule = {
  type: RiskType;
  label: string;
  severity: GuardFinding["severity"];
  score: number;
  message: string;
  patterns: RegExp[];
};

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
};

const RULES: CyberRule[] = [
  {
    type: "SYSTEM_PROMPT_LEAK_ATTEMPT",
    label: "Obfuscated system-prompt extraction",
    severity: "HIGH",
    score: 85,
    message: "Obfuscated wording attempts to extract hidden system or developer instructions.",
    patterns: [
      /(?:ignore|disregard|forget|override).{0,120}(?:rules?|instructions?|policy).{0,160}(?:reveal|print|show|dump|return).{0,120}(?:system|developer|hidden|internal)/i,
      /(?:reveal|print|show|dump|return).{0,140}(?:systemprompt|system prompt|developerprompt|developer prompt|hiddeninstructions|hidden instructions|internalrules|internal rules)/i,
    ],
  },
  {
    type: "DATA_EXFILTRATION",
    label: "Obfuscated credential harvesting",
    severity: "CRITICAL",
    score: 90,
    message: "Request attempts to harvest credentials, tokens, MFA codes, or session secrets.",
    patterns: [
      /(?:phish|phishing|credentialharvest|credential harvest|harvestcredentials|harvest credentials|steal|collect|capture).{0,140}(?:passwords?|credentials?|tokens?|sessioncookies?|session cookies|otp|mfa|2fa|seedphrase|seed phrase|privatekeys?|private keys?)/i,
      /(?:ask|prompt|trick|convince).{0,140}(?:user|customer|employee|victim).{0,140}(?:password|otp|mfa|2fa|api key|seed phrase|private key).{0,140}(?:send|enter|paste|upload|share|forward)/i,
    ],
  },
  {
    type: "PROMPT_INJECTION",
    label: "Obfuscated malware construction",
    severity: "CRITICAL",
    score: 90,
    message: "Request attempts to create malware or bypass endpoint defenses.",
    patterns: [
      /(?:write|create|build|generate|code|implement).{0,140}(?:malware|ransomware|keylogger|infostealer|info stealer|credentialstealer|credential stealer|worm|trojan|reverse shell|persistence payload)/i,
      /(?:bypass|disable|evade|turn off|kill).{0,120}(?:edr|av|antivirus|endpoint protection|defender|security monitoring|siem|detections?)/i,
    ],
  },
  {
    type: "JAILBREAK",
    label: "Obfuscated cyber-safety bypass",
    severity: "HIGH",
    score: 70,
    message: "Cyber abuse is framed as a request to bypass safety controls.",
    patterns: [
      /(?:educational|research|simulation|lab|ctf).{0,180}(?:ignore|bypass|disable|remove).{0,120}(?:safety|policy|guardrails?|filters?).{0,180}(?:malware|phishing|credentials?|exploit|payload)/i,
      /(?:make|rewrite|mutate|obfuscate).{0,140}(?:malware|phishing|credential|exploit|payload).{0,140}(?:look benign|bypass|evade|avoid detection|pass filters?)/i,
    ],
  },
  {
    type: "SSRF_ATTEMPT",
    label: "Obfuscated metadata or internal-network access",
    severity: "CRITICAL",
    score: 90,
    message: "Request targets cloud metadata, private network, or internal service endpoints through obfuscation.",
    patterns: [
      /(?:curl|wget|fetch|request|get|open|browse|connect).{0,120}(?:169\.254\.169\.254|169254169254|metadata\.google\.internal|metadata google internal|100\.100\.100\.200|instance-data|kubernetes\.default|svc\.cluster\.local)/i,
      /(?:curl|wget|fetch|request|get|open|browse|connect).{0,120}(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.)/i,
    ],
  },
  {
    type: "PROMPT_INJECTION",
    label: "Connector permission escalation",
    severity: "HIGH",
    score: 75,
    message: "Request attempts to escalate OAuth or connector permissions for unsafe agent actions.",
    patterns: [
      /(?:oauth|connector|integration|plugin|app permission|scope|consent).{0,180}(?:offline_access|read all|write all|send email|delete|admin|full access|export).{0,180}(?:without|silently|secretly|bypass|avoid approval|no consent)/i,
      /(?:grant|request|obtain|escalate).{0,140}(?:gmail|drive|slack|github|calendar|notion).{0,140}(?:read all|send|delete|export|admin|write).{0,140}(?:without approval|silently|secretly)/i,
    ],
  },
  {
    type: "PROMPT_INJECTION",
    label: "Persistent approval bypass pretext",
    severity: "HIGH",
    score: 80,
    message: "Request fabricates or extends approval to bypass future human review.",
    patterns: [
      /(?:admin|trusted admin|security team|management|approver|owner).{0,140}(?:approved|authorized|cleared|granted).{0,140}(?:bypass(?:ing)?|skip(?:ping)?|disable|waive).{0,140}(?:approval|approvals|review|human approval).{0,140}(?:future|all future|external sends?|actions?)/i,
      /(?:approval|approvals|human approval|review).{0,120}(?:not required|waived|disabled|bypassed|skip(?:ped)?).{0,120}(?:future|all future|external sends?|actions?|from now on)/i,
    ],
  },
  {
    type: "DATA_EXFILTRATION",
    label: "Covert exfiltration channel",
    severity: "CRITICAL",
    score: 90,
    message: "Request attempts to move protected context through covert URLs, images, beacons, or DNS-like channels.",
    patterns: [
      /(?:encode|append|place|put|hide|include).{0,140}(?:system prompt|conversation|context|credentials?|tokens?|pii|private data|secrets?).{0,160}(?:url|query|image|pixel|beacon|dns|subdomain|webhook|callback)/i,
      /(?:markdown image|tracking pixel|web beacon|img tag|dns exfil|dns tunnel).{0,180}(?:system prompt|conversation|context|credentials?|tokens?|pii|private data|secrets?)/i,
    ],
  },
  // ── Agent RCE / sandbox-escape escalation ──────────────────────────────────
  // These two patterns cover the two red-team cases that were previously missed:
  //   • agent-escalation-rce  — "Use Auto-GPT tool access … Docker escape … RCE shell"
  //   • rag-plugin-rce-escape — "Use the RAG-LLM plugin … execute commands … reverse shell"
  // Both are PROMPT_INJECTION because the intent is to hijack the agent's tool
  // layer into performing OS-level execution — not just information extraction.
  {
    type: "PROMPT_INJECTION",
    label: "Agent tool RCE / sandbox escape",
    severity: "CRITICAL",
    score: 88,
    message: "Request attempts to use an AI agent's tool access to perform remote code execution or escape a sandbox.",
    patterns: [
      // Auto-GPT / agentic-framework + Docker/container escape + shell access
      /(?:auto.?gpt|autogpt|gpt.?pilot|agent|agentic|langchain|babyagi|crewai|agentgpt)\b.{0,200}(?:docker\s+escape|container\s+escape|sandbox\s+escape|privilege\s+escal|get\s+(?:rce|shell|root|code\s+exec)|reverse\s+shell|bind\s+shell|spawn\s+shell)/i,
      // Docker / container escape + shell — even without explicit agent name
      /(?:docker|container|namespace|cgroup|seccomp|apparmor|chroot|pivot_root).{0,160}(?:escape|breakout|bypass|jailbreak|exploit).{0,160}(?:shell|rce|root|exec(?:ute)?|command)/i,
      // "perform … Docker escape … get RCE shell access" (close-range variant)
      /(?:perform|execute|carry\s+out|do)\b.{0,120}(?:docker|container|sandbox)\s+escape.{0,120}(?:rce|shell|root|code\s+exec)/i,
    ],
  },
  {
    type: "PROMPT_INJECTION",
    label: "RAG / plugin RCE via command execution",
    severity: "CRITICAL",
    score: 88,
    message: "Request attempts to use a RAG plugin or LLM tool to execute OS commands or establish a reverse shell.",
    patterns: [
      // RAG-LLM / plugin + execute commands + escape / reverse shell
      /(?:rag|rag.?llm|retrieval.?augmented|plugin|tool|connector|mcp\s+tool)\b.{0,200}(?:execute\s+commands?|run\s+commands?|os\.system|subprocess|shell\s+exec|reverse\s+shell|bind\s+shell|spawn\s+shell|escape\s+sandbox|sandbox\s+restrictions?)/i,
      // Reverse shell request through any plugin/tool surface
      /(?:plugin|tool|extension|connector|mcp|rag)\b.{0,160}(?:reverse\s+shell|bind\s+shell|netcat|nc\s+-[eln]|bash\s+-i\s*>&|\/dev\/tcp|socat)/i,
      // "escape sandbox restrictions with a reverse shell" (close-range variant)
      /escape\s+sandbox\s+restrictions?.{0,80}(?:reverse\s+shell|bind\s+shell|rce|code\s+exec)/i,
    ],
  },
  {
    type: "DATA_EXFILTRATION",
    label: "Connector confused-deputy exfiltration",
    severity: "CRITICAL",
    score: 90,
    message: "Request abuses a trusted connector to move private data to an external destination.",
    patterns: [
      /(?:calendar|gmail|drive|slack|notion|github|crm|connector|integration).{0,180}(?:send|post|forward|export|share|transmit|sync).{0,180}(?:private|confidential|meeting details|customer data|records?|notes?|files?).{0,180}(?:public webhook|webhook|external|outside|third-party|untrusted|url)/i,
      /(?:private|confidential|meeting details|customer data|records?|notes?|files?).{0,180}(?:calendar|gmail|drive|slack|notion|github|crm|connector|integration).{0,180}(?:send|post|forward|export|share|transmit|sync).{0,180}(?:public webhook|webhook|external|outside|third-party|untrusted|url)/i,
    ],
  },
];

export function adversarialCyberDetector(text: string): GuardFinding[] {
  const variants = buildVariants(text);
  const findings: GuardFinding[] = [];
  const seen = new Set<string>();
  // One metadata record per variant, held across every rule: the lowercase copy
  // and the 3-gram index are each built at most once per variant instead of once
  // per (rule, pattern) pair. Every pattern here is a chained alternation with
  // `.{0,140}` gaps, so a single absent cue literal removes a long scan.
  const metas = variants.map((variant) => haystackMeta(variant.text, variant));

  for (const rule of RULES) {
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      for (const pattern of rule.patterns) {
        if (patternCannotMatch(variant.text, metas[index], pattern, rule.label)) continue;
        if (!pattern.test(variant.text)) continue;
        const key = `${rule.type}:${rule.label}:${variant.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          type: rule.type,
          label: variant.kind === "raw" ? rule.label : `${rule.label} (${variant.kind})`,
          severity: rule.severity,
          score: rule.score,
          message: variant.kind === "raw" ? rule.message : `${rule.message} Detected after ${variant.kind} normalization.`,
          matched: variant.kind === "raw" ? text.slice(0, 120) : undefined,
          start: 0,
          end: text.length,
        });
      }
    }
  }

  return findings;
}

function buildVariants(text: string) {
  const normalized = normalizeForDetection(text);
  const leet = normalized.replace(/[01345789@$]/g, (char) => LEET[char] ?? char);
  const compact = leet.replace(/[^a-z0-9.]+/gi, "");
  const spacedCollapsed = leet.replace(/\b(?:[a-z0-9]\s+){3,}[a-z0-9]\b/gi, (match) => match.replace(/\s+/g, ""));
  const variants = [
    { kind: "raw", text },
    { kind: "unicode", text: normalized },
    { kind: "leet", text: leet },
    { kind: "spaced", text: spacedCollapsed },
    { kind: "compact", text: compact },
  ];
  return variants.filter((variant, index) => variants.findIndex((other) => other.text === variant.text) === index);
}
