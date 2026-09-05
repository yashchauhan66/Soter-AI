import { detectPatterns, type PatternRule } from "./helpers";

/**
 * Tool-call abuse: turning the agent's own tool surface into the attack.
 *
 * SCOPE, and why it is not mcpToolPoisoningDetector
 *   mcpToolPoisoningDetector covers a poisoned tool DESCRIPTION arriving from a
 *   server (supply chain, floor BLOCK). This file covers a caller steering an
 *   already-trusted tool: forging the call envelope, breaking out of an argument
 *   string, switching approval off, or using a legitimate tool to install
 *   persistence. Measured on the red-team corpus both the rules tier and the full
 *   rules+ML pipeline caught 7 of 10 of these
 *   (artifacts/ml/redteam-baseline-2026-09-04.json) — the ML tier added nothing,
 *   because TOOL_CALL_ABUSE is deliberately excluded from mlAugment's INPUT label
 *   allowlist (it measured 1 benign false positive for 4 attacks, see
 *   lib/guard/mlAugment.ts). Deterministic signatures are the only tier that can
 *   close this.
 *
 * SCORING
 *   TOOL_CALL_ABUSE has no SIGNALS entry in decisionEngine (see RISK_TYPES in
 *   ../types.ts), so the aggregate bands decide. Approval-bypass and persistence
 *   declare 88, which is the >=86 BLOCK band: disabling an approval gate or
 *   writing an SSH key has no benign reading, and holding it for review is too
 *   late once the agent is autonomous. The envelope/argument-breakout rules
 *   declare 62 (61-85 = HUMAN_REVIEW) because a developer pasting a tool trace is
 *   a real, benign case.
 *
 *   Note these numbers are the FINDING's own declared score, not a new entry in
 *   the risk-weight table, so ML predictions carrying the same RiskType keep
 *   declaring 45 and keep behaving exactly as they did before.
 */

const rules: PatternRule[] = [
  {
    // Turning an approval gate off is the one action that removes the human from
    // the loop, which is the whole safety model of an agent runtime.
    pattern:
      /\b(?:set|switch|turn|flip|mark|make|configure)\b[\s\S]{0,40}\b(?:requires?_?approval|needs?_?approval|approval_?required|human_?in_?the_?loop|confirm(?:ation)?_?required|dry_?run|safe_?mode|guard(?:rails?)?|require_?confirmation)\b[\s\S]{0,30}\b(?:to\s+)?(?:false|off|0|disabled?|no)\b/i,
    label: "Tool approval-gate bypass",
    message: "Attempts to disable the approval or confirmation gate on a tool before calling it.",
    severity: "CRITICAL",
    score: 88,
  },
  {
    pattern:
      /\b(?:skip|bypass|suppress|avoid|ignore|disable|remove)\b[\s\S]{0,50}\b(?:the\s+)?(?:approval|confirmation|consent|review|permission|authori[sz]ation)\s*(?:prompt|dialog|step|gate|check|flow|request)?\b[\s\S]{0,60}\b(?:and\s+)?(?:then\s+)?(?:call|invoke|run|execute|proceed|delete|drop|deploy|transfer|push)\b/i,
    label: "Tool approval-step evasion",
    message: "Asks the agent to act without the approval step the operator configured.",
    severity: "CRITICAL",
    score: 88,
  },
  {
    // Persistence: the payload survives the session, so a later review is moot.
    pattern:
      /\b(?:append|add|write|echo|install|inject|insert|copy)\b[\s\S]{0,120}\b(?:authorized_keys|\.ssh\/(?:authorized_keys|id_rsa|id_ed25519)|crontab|cron\s+(?:entry|job|tab)|systemd\s+(?:unit|service|timer)|launchd|\.bashrc|\.bash_profile|\.zshrc|\.profile|rc\.local|scheduled\s+task|startup\s+(?:script|item))\b/i,
    label: "Agent-assisted persistence install",
    message: "Uses a tool to install a persistence mechanism that outlives the session.",
    severity: "CRITICAL",
    score: 88,
  },
  {
    pattern:
      /\b(?:re-?adds?|reinstalls?|restores?|recreates?)\b[\s\S]{0,60}\b(?:it|itself|the\s+(?:key|entry|job|task|user|account))\b[\s\S]{0,60}\b(?:hourly|daily|every\s+\d+\s*(?:m|min|minutes?|h|hours?)|on\s+(?:boot|reboot|startup)|automatically)\b/i,
    label: "Self-reinstalling persistence",
    message: "Requests a mechanism that re-establishes itself after removal.",
    severity: "CRITICAL",
    score: 88,
  },
  {
    // JSON argument-boundary breakout. A value that closes its own string and
    // opens a new key is the LLM equivalent of SQL injection: the model is asked
    // to emit a call whose argument object the caller never authorized. The
    // trailing-key requirement is what keeps ordinary JSON out.
    pattern:
      /["'][\s,]*[,}][\s]*["'](?:approve|approved|admin|is_admin|role|permission|scope|allow|allowed|confirm|confirmed|requires?_?approval|dry_?run|force|sudo|bypass|override|auth|authori[sz]ed|user_?id|tenant_?id)["'][\s]*:/i,
    label: "Tool argument-boundary breakout",
    message: "Argument value closes its own string and injects an additional privileged key.",
    severity: "HIGH",
    score: 62,
  },
  {
    // A caller emitting the call envelope itself, rather than asking for an
    // action, is forging a decision the runtime is supposed to make.
    pattern:
      /["']?(?:tool_?call|function_?call|tool_?use|tool_?invocation)["']?\s*:\s*\{[\s\S]{0,200}["']?(?:name|tool|function)["']?\s*:\s*["'][\w.-]+["'][\s\S]{0,200}["']?(?:arguments?|args|parameters?|input)["']?\s*:/i,
    label: "Forged tool-call envelope",
    message: "Instructs the model to emit a tool-call envelope directly, forging the runtime's decision.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:register|add|define|create|install)\b[\s\S]{0,60}\b(?:a\s+)?(?:new\s+)?(?:tool|function|mcp\s+server|connector|plugin|skill)\b[\s\S]{0,120}\b(?:whose|with\s+a)\s+description\b[\s\S]{0,160}\b(?:instructs?|tells?|forces?|makes?|requires?)\s+you\b/i,
    label: "Tool-definition instruction smuggling",
    message: "Registers a tool whose description carries instructions for the model.",
    severity: "HIGH",
    score: 62,
  },
  {
    pattern:
      /\b(?:chain|run|call|invoke|execute)\b[\s\S]{0,60}\b(?:these|the\s+following|both)\b[\s\S]{0,40}\b(?:calls?|tools?|steps?|commands?)\b[\s\S]{0,60}\bwithout\b[\s\S]{0,40}\b(?:asking|confirming|approval|telling|notifying|checking\s+with)\b/i,
    label: "Unattended tool chaining",
    message: "Requests a multi-step tool chain be executed without operator confirmation.",
    severity: "HIGH",
    score: 62,
  },
];

export function toolCallAbuseDetector(text: string) {
  return detectPatterns(text, "TOOL_CALL_ABUSE", rules);
}
