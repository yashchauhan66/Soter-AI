import { detectPatterns, type PatternRule } from "./helpers";

// MCP (Model Context Protocol) tool-poisoning detection.
//
// Tool poisoning hides steering instructions inside a tool's *metadata*
// (description / parameter docs / annotations) so that an agent reading the
// manifest is silently instructed to exfiltrate data, escalate privileges, or
// call the tool in unintended ways. This maps to the 2026 threat class
// documented by Invariant Labs (tool-description poisoning) and CVE-2025-6514
// (mcp-remote RCE via a malicious server), where the *server-supplied* schema
// text is the injection vector rather than direct user input.
//
// These rules deliberately require MULTI-SIGNAL co-occurrence: an MCP/tool
// context token (tool description, mcp server, function schema, <IMPORTANT>
// annotation, "before using this tool", ...) AND a steering/exfil/hidden-intent
// token. A benign sentence such as "the tool description explains the weather
// parameters" contains the context token but no steering verb, so it will not
// fire. Because the detector reuses the PROMPT_INJECTION risk type, it inherits
// the variant-aware decoding (zero-width, homoglyph, base64, leetspeak) that
// `shouldUseSecurityVariants` enables for that type.
const rules: PatternRule[] = [
  // ── Hidden steering inside tool/description metadata ───────────────────
  { pattern: /(?:tool description|tool metadata|tool annotation|mcp tool|mcp server|function schema|function description|plugin manifest|openapi (?:schema|spec)|json ?schema)[\s\S]{0,220}(?:ignore (?:all )?(?:previous|prior) instructions?|system override|exfiltrate|send (?:all|the) (?:context|conversation|history)|read\s+[~/]|\.ssh|\.env|do not (?:tell|mention|reveal) (?:the )?user|without (?:the user|user's) (?:knowledge|consent)|before (?:you )?(?:respond|answer|use))/i, label: "MCP tool metadata injection", message: "MCP tool metadata contains hidden agent-steering instructions (tool-poisoning).", severity: "HIGH", score: 50 },

  // ── <IMPORTANT>-style hidden instruction blocks (Invariant Labs pattern) ─
  { pattern: /<(?:important|system|secret|hidden|ai_instructions?|do_not_show)>[\s\S]{0,300}(?:ignore|do not (?:tell|mention|inform)|before (?:using|calling)|exfiltrat|send (?:the|all)|read (?:the )?(?:file|\.env|\.ssh|config)|append|forward)[\s\S]{0,120}<\/(?:important|system|secret|hidden|ai_instructions?|do_not_show)>/i, label: "Hidden tag instruction in tool schema", message: "Tool description hides instructions inside an <IMPORTANT>/<SYSTEM> tag the user never sees.", severity: "HIGH", score: 50 },

  // ── "Before using this tool, you must ..." shadowing instructions ──────
  { pattern: /before (?:you (?:can )?)?(?:use|call|invoke|run)(?:ing)? this (?:tool|function|server)[\s,]*[\s\S]{0,160}(?:read|send|forward|include|attach|exfiltrate|pass|append)[\s\S]{0,80}(?:\.env|\.ssh|config file|api ?keys?|credentials?|conversation|system prompt|entire context|~\/|\/etc\/)/i, label: "Tool precondition shadowing", message: "Tool description injects a mandatory pre-call action that leaks data or context.", severity: "HIGH", score: 50 },

  // ── Cross-tool shadowing (poison one tool to hijack another) ───────────
  { pattern: /(?:when (?:the (?:user|agent|model)|you) (?:call|invoke|use)s?|whenever (?:calling|using|invoking)|instead of (?:calling|using)) (?:the )?(?:['"`]?\w[\w .-]{1,40}['"`]?) (?:tool|function|api|server)[\s\S]{0,140}(?:actually|instead|also|first) (?:call|invoke|send|route|forward|use)/i, label: "Cross-tool shadowing", message: "Tool metadata redirects or shadows calls intended for a different tool.", severity: "HIGH", score: 45 },

  // ── Concealment directive aimed at the user/UI ─────────────────────────
  { pattern: /(?:this (?:instruction|note|block)|the following)[\s\S]{0,80}(?:is|are|must be|should be) (?:only for the (?:ai|model|assistant|agent)|invisible to|hidden from|not shown to|never (?:shown|displayed|revealed) to) (?:the )?(?:user|human|operator|ui)/i, label: "Model-only concealed tool directive", message: "Tool content instructs the agent to hide an action or note from the user.", severity: "HIGH", score: 45 },

  // ── Auto-approval / consent-bypass smuggled into schema text ───────────
  { pattern: /(?:this (?:tool|function|server)|the (?:tool|call))[\s\S]{0,120}(?:is (?:pre-?approved|already authorized|trusted|safe)|requires no (?:approval|confirmation|consent)|auto-?approve|skip (?:the )?(?:approval|confirmation|permission) (?:step|prompt|check))/i, label: "Tool auto-approval injection", message: "Tool metadata asserts pre-approval or tells the agent to skip the consent step.", severity: "HIGH", score: 45 },

  // ── Malicious server / mcp-remote RCE style command smuggling ──────────
  { pattern: /(?:mcp[- ]?remote|mcp server (?:config|manifest)|server description)[\s\S]{0,200}(?:\$\((?:curl|wget|bash|sh)|;\s*(?:curl|wget|bash|sh|rm|nc|python)\b|\|\s*(?:bash|sh)\b|`(?:curl|wget|bash|sh)|<script>|child_process|exec(?:Sync)?\s*\(|eval\s*\()/i, label: "MCP server command injection", message: "MCP server metadata smuggles a shell/command payload (mcp-remote RCE class).", severity: "CRITICAL", score: 60 },
];

export function mcpToolPoisoningDetector(text: string) {
  const findings = detectPatterns(text, "MCP_TOOL_POISONING", rules);
  return findings.flatMap((finding) => [
    finding,
    {
      ...finding,
      type: "PROMPT_INJECTION" as const,
      label: `${finding.label} (agent prompt attack)`,
      score: Math.min(finding.score, 40),
    },
  ]);
}
