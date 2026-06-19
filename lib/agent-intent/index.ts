import { createHash, randomUUID } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export const INTENT_CATEGORIES = [
  "READ",
  "SUMMARIZE",
  "SEARCH",
  "WRITE_DRAFT",
  "SEND_MESSAGE",
  "DELETE",
  "MODIFY",
  "PURCHASE",
  "PAYMENT",
  "LOGIN",
  "EXPORT_DATA",
  "CALL_EXTERNAL_API",
  "RUN_CODE",
  "INSTALL_PACKAGE",
  "MEMORY_WRITE",
  "UNKNOWN",
] as const;

export const INTENT_DECISIONS = ["ALLOW", "BLOCK", "ASK_APPROVAL", "REVIEW"] as const;
export const INTENT_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];
export type IntentDecision = (typeof INTENT_DECISIONS)[number];
export type IntentRiskLevel = (typeof INTENT_RISK_LEVELS)[number];

export interface ExtractIntentInput {
  userPrompt: string;
  allowedIntentCategories?: IntentCategory[];
  forbiddenIntentCategories?: IntentCategory[];
}

export interface ExtractedIntent {
  primaryCategory: IntentCategory;
  categories: IntentCategory[];
  confidence: number;
  summary: string;
  signals: string[];
  injectionDetected: boolean;
}

export interface AgentIntentRecordSnapshot {
  id?: string;
  projectId?: string;
  sessionId: string;
  userPromptHash?: string;
  userPromptRedacted?: string;
  extractedIntent: ExtractedIntent;
  allowedIntentCategories: IntentCategory[];
  forbiddenIntentCategories: IntentCategory[];
}

export interface IntentActionCheckInput {
  intent: AgentIntentRecordSnapshot | ExtractedIntent;
  allowedIntentCategories?: IntentCategory[];
  forbiddenIntentCategories?: IntentCategory[];
  tool?: string;
  action?: string;
  target?: string;
  actionDescription?: string;
}

export interface IntentActionDecisionResult {
  intentMatchScore: number;
  actionCategories: IntentCategory[];
  decision: IntentDecision;
  riskLevel: IntentRiskLevel;
  reason: string;
  policyMatches: Array<{ id: string; label: string; severity: IntentRiskLevel }>;
}

const HIGH_IMPACT_CATEGORIES = new Set<IntentCategory>([
  "SEND_MESSAGE",
  "DELETE",
  "MODIFY",
  "PURCHASE",
  "PAYMENT",
  "LOGIN",
  "EXPORT_DATA",
  "CALL_EXTERNAL_API",
  "RUN_CODE",
  "INSTALL_PACKAGE",
  "MEMORY_WRITE",
]);

const READ_ONLY_CATEGORIES = new Set<IntentCategory>(["READ", "SUMMARIZE", "SEARCH"]);
const EXTERNAL_SEND_CATEGORIES = new Set<IntentCategory>(["SEND_MESSAGE", "EXPORT_DATA", "CALL_EXTERNAL_API"]);
const DESTRUCTIVE_CATEGORIES = new Set<IntentCategory>(["DELETE", "MODIFY"]);

const PROMPT_INJECTION_PATTERNS = [
  /\bignore (all )?(previous|earlier|above|system|developer) (instructions|rules|messages)\b/i,
  /\bdisregard (previous|earlier|above|system|developer) (instructions|rules|messages)\b/i,
  /\boverride (the )?(user|system|developer) (intent|instruction|policy)\b/i,
  /\bnew (system|developer) instructions?\b/i,
  /\bdo not (tell|notify|inform) (the )?user\b/i,
  /\binstead[, ]+(send|forward|delete|transfer|pay|post|export|exfiltrate)\b/i,
  /\bsecretly (send|forward|delete|transfer|pay|post|export|exfiltrate)\b/i,
  /\breveal (the )?(system prompt|developer message|hidden instructions)\b/i,
];

type CategoryRule = { category: IntentCategory; patterns: RegExp[]; signal: string };

const INTENT_RULES: CategoryRule[] = [
  { category: "INSTALL_PACKAGE", signal: "package_install", patterns: [/\b(npm|pnpm|yarn|pip|gem|cargo) install\b/i, /\binstall (a )?(package|dependency|library|plugin)\b/i] },
  { category: "RUN_CODE", signal: "run_code", patterns: [/\b(run|execute|launch) (this )?(code|script|command|terminal|shell)\b/i, /\bterminal\b|\bshell\b|\bpython\b|\bnode\b/i] },
  { category: "PAYMENT", signal: "payment", patterns: [/\b(pay|payment|charge|transfer funds|send money|invoice payment)\b/i] },
  { category: "PURCHASE", signal: "purchase", patterns: [/\b(purchase|buy|order|checkout|book (a )?(ticket|flight|hotel|ride))\b/i] },
  { category: "DELETE", signal: "delete", patterns: [/\b(delete|remove|drop|destroy|erase|purge|truncate|rm -rf)\b/i] },
  { category: "MODIFY", signal: "modify", patterns: [/\b(update|modify|edit|change|rewrite|patch|write (to|the)|save file)\b/i] },
  { category: "SEND_MESSAGE", signal: "send_message", patterns: [/\b(send|forward|message|text|slack|post|publish)\b/i, /\bemail\b.*\b(to|external|recipient)\b/i] },
  { category: "EXPORT_DATA", signal: "export_data", patterns: [/\b(export|download|share|copy out|exfiltrate|send .*data|upload .*data)\b/i] },
  { category: "CALL_EXTERNAL_API", signal: "external_api", patterns: [/\b(call|post to|send to|submit to|webhook|api request|external api|http request|curl)\b/i] },
  { category: "LOGIN", signal: "login", patterns: [/\b(log ?in|sign ?in|authenticate|enter password|otp|2fa)\b/i] },
  { category: "MEMORY_WRITE", signal: "memory_write", patterns: [/\b(remember|store in memory|save this preference|add to memory|write memory)\b/i] },
  { category: "WRITE_DRAFT", signal: "write_draft", patterns: [/\b(draft|compose a draft|write a draft|prepare (an? )?(email|message|reply))\b/i] },
  { category: "SUMMARIZE", signal: "summarize", patterns: [/\b(summarize|summary|tl;?dr|recap|brief)\b/i] },
  { category: "SEARCH", signal: "search", patterns: [/\b(search|find|look up|lookup|discover)\b/i] },
  { category: "READ", signal: "read", patterns: [/\b(read|view|show|open|inspect|review|analyze)\b/i] },
];

const ACTION_RULES: CategoryRule[] = [
  { category: "INSTALL_PACKAGE", signal: "package_install", patterns: [/\b(npm|pnpm|yarn|pip|gem|cargo) install\b/i, /\binstall (package|dependency|library|plugin)\b/i] },
  { category: "RUN_CODE", signal: "run_code", patterns: [/\b(run|execute|exec|shell|terminal|script|command|code)\b/i] },
  { category: "PAYMENT", signal: "payment", patterns: [/\b(pay|payment|charge|transfer funds|send money|invoice payment)\b/i] },
  { category: "PURCHASE", signal: "purchase", patterns: [/\b(purchase|buy|order|checkout|book ticket|book flight|book hotel)\b/i] },
  { category: "DELETE", signal: "delete", patterns: [/\b(delete|remove|drop|destroy|erase|purge|truncate|rm -rf)\b/i] },
  { category: "MODIFY", signal: "modify", patterns: [/\b(update|modify|edit|change|rewrite|patch|write|save|commit|push)\b/i] },
  { category: "SEND_MESSAGE", signal: "send_message", patterns: [/\b(send|forward|message|text|slack|post|publish)\b/i, /\b(gmail|email)\.(send|forward)\b/i, /\bemail\b.*\b(to|external|recipient)\b/i] },
  { category: "EXPORT_DATA", signal: "export_data", patterns: [/\b(export|download|share|copy out|exfiltrate|upload data|send data)\b/i] },
  { category: "CALL_EXTERNAL_API", signal: "external_api", patterns: [/\b(api\.call|api call|external api|webhook|http|curl|post to|submit to)\b/i] },
  { category: "LOGIN", signal: "login", patterns: [/\b(log ?in|sign ?in|authenticate|password|otp|2fa)\b/i] },
  { category: "MEMORY_WRITE", signal: "memory_write", patterns: [/\b(memory\.write|remember|store memory|save preference|write memory)\b/i] },
  { category: "WRITE_DRAFT", signal: "write_draft", patterns: [/\b(draft|compose draft|write draft|prepare message|prepare email)\b/i] },
  { category: "SUMMARIZE", signal: "summarize", patterns: [/\b(summarize|summary|recap|brief)\b/i] },
  { category: "SEARCH", signal: "search", patterns: [/\b(search|find|lookup|look up|query)\b/i] },
  { category: "READ", signal: "read", patterns: [/\b(read|view|show|open|inspect|get|fetch)\b/i] },
];

export function createAgentIntentRecordId() {
  return `agent_intent_${randomUUID()}`;
}

export function createAgentIntentActionCheckId() {
  return `agent_intent_check_${randomUUID()}`;
}

export function hashUserPrompt(prompt: string) {
  return createHash("sha256").update(prompt ?? "").digest("hex");
}

export function extractAgentIntent(input: ExtractIntentInput) {
  const prompt = input.userPrompt ?? "";
  const redactedPrompt = sanitizeLogText(prompt);
  const promptHash = hashUserPrompt(prompt);
  const injectionDetected = PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(prompt));
  const inferred = inferCategories(prompt, INTENT_RULES, true);
  const categories = inferred.categories.length > 0 ? inferred.categories : ["UNKNOWN" as IntentCategory];
  const confidence = calculateConfidence(categories, injectionDetected, inferred.signals.length);
  const primaryCategory = choosePrimaryCategory(categories);
  const extractedIntent: ExtractedIntent = {
    primaryCategory,
    categories,
    confidence,
    summary: summarizeCategories(categories, confidence, injectionDetected),
    signals: inferred.signals,
    injectionDetected,
  };

  return {
    userPromptHash: promptHash,
    userPromptRedacted: redactedPrompt,
    extractedIntent,
    allowedIntentCategories: normalizeCategories(input.allowedIntentCategories?.length ? input.allowedIntentCategories : categories.filter((category) => category !== "UNKNOWN")),
    forbiddenIntentCategories: normalizeCategories(input.forbiddenIntentCategories ?? []),
  };
}

export function checkIntentAction(input: IntentActionCheckInput): IntentActionDecisionResult {
  const intent = normalizeIntentInput(input.intent);
  const allowed = normalizeCategories(input.allowedIntentCategories ?? intent.allowedIntentCategories ?? intent.extractedIntent.categories);
  const forbidden = normalizeCategories(input.forbiddenIntentCategories ?? intent.forbiddenIntentCategories ?? []);
  const actionCategories = inferActionCategories(input);
  const matches: IntentActionDecisionResult["policyMatches"] = [];
  const intentCategories = normalizeCategories(intent.extractedIntent.categories);
  const lowConfidence = intent.extractedIntent.confidence < 0.45 || intentCategories.includes("UNKNOWN");
  const highImpactAction = actionCategories.some((category) => HIGH_IMPACT_CATEGORIES.has(category));

  if (intent.extractedIntent.injectionDetected) {
    return decision(0.05, actionCategories, "BLOCK", "CRITICAL", "Prompt injection attempted to change or override the user's original intent.", matches, "intent.prompt_injection");
  }

  if (actionCategories.includes("UNKNOWN")) {
    return decision(0.25, actionCategories, "REVIEW", "MEDIUM", "Planned action category is unknown; hold for review.", matches, "intent.action_unknown");
  }

  if (lowConfidence) {
    return decision(0.35, actionCategories, highImpactAction ? "ASK_APPROVAL" : "REVIEW", highImpactAction ? "HIGH" : "MEDIUM", "User intent confidence is too low for automatic execution.", matches, "intent.low_confidence");
  }

  const forbiddenHit = actionCategories.find((category) => forbidden.includes(category));
  if (forbiddenHit) {
    return decision(0.1, actionCategories, "BLOCK", "HIGH", `Action category ${forbiddenHit} is forbidden by intent policy.`, matches, "intent.forbidden_category");
  }

  const readOnlyIntent = intentCategories.every((category) => READ_ONLY_CATEGORIES.has(category));
  const externalSend = actionCategories.some((category) => EXTERNAL_SEND_CATEGORIES.has(category)) && isExternalTarget(input.target);
  if (readOnlyIntent && externalSend) {
    return decision(0.05, actionCategories, "BLOCK", "CRITICAL", "The user asked only to read or summarize, but the planned action sends data externally.", matches, "intent.read_to_external_send");
  }

  if (readOnlyIntent && actionCategories.some((category) => DESTRUCTIVE_CATEGORIES.has(category))) {
    return decision(0.05, actionCategories, "BLOCK", "CRITICAL", "The user asked only to read or summarize, but the planned action deletes or modifies data.", matches, "intent.read_to_mutation");
  }

  const lacksPurchaseIntent = actionCategories.some((category) => category === "PURCHASE" || category === "PAYMENT")
    && !intentCategories.some((category) => category === "PURCHASE" || category === "PAYMENT")
    && !allowed.some((category) => category === "PURCHASE" || category === "PAYMENT");
  if (lacksPurchaseIntent) {
    return decision(0.05, actionCategories, "BLOCK", "CRITICAL", "Payment or purchase action has no explicit user intent.", matches, "intent.payment_without_intent");
  }

  if (intentCategories.includes("WRITE_DRAFT") && actionCategories.includes("SEND_MESSAGE") && !intentCategories.includes("SEND_MESSAGE")) {
    return decision(0.65, actionCategories, "ASK_APPROVAL", "HIGH", "The user asked for a draft, but the planned action would send the message.", matches, "intent.draft_to_send");
  }

  const overlap = actionCategories.filter((category) => allowed.includes(category) || intentCategories.includes(category));
  if (overlap.length === actionCategories.length) {
    if (actionCategories.includes("PAYMENT") || actionCategories.includes("PURCHASE")) {
      return decision(0.9, actionCategories, "ASK_APPROVAL", "HIGH", "Payment or purchase matches user intent but still requires explicit approval.", matches, "intent.explicit_payment_approval");
    }
    return decision(0.95, actionCategories, "ALLOW", riskForCategories(actionCategories), "Planned action matches the user's original intent.", matches, "intent.match");
  }

  if (overlap.length > 0 && highImpactAction) {
    return decision(0.55, actionCategories, "ASK_APPROVAL", "HIGH", "Planned action is broader than the user's original intent and requires approval.", matches, "intent.broader_than_user_intent");
  }

  if (highImpactAction) {
    return decision(0.1, actionCategories, "BLOCK", "HIGH", "Planned high-risk action does not match the user's original intent.", matches, "intent.high_risk_mismatch");
  }

  return decision(0.45, actionCategories, "REVIEW", "MEDIUM", "Planned action does not clearly match the user's original intent.", matches, "intent.unclear_match");
}

export function inferActionCategories(input: { tool?: string; action?: string; target?: string; actionDescription?: string }) {
  const text = `${input.tool ?? ""} ${input.action ?? ""} ${input.target ?? ""} ${input.actionDescription ?? ""}`;
  const inferred = inferCategories(text, ACTION_RULES, false);
  return inferred.categories.length > 0 ? inferred.categories : ["UNKNOWN" as IntentCategory];
}

function normalizeIntentInput(intent: AgentIntentRecordSnapshot | ExtractedIntent): AgentIntentRecordSnapshot {
  if ("extractedIntent" in intent) return intent;
  return {
    sessionId: "",
    extractedIntent: intent,
    allowedIntentCategories: intent.categories.filter((category) => category !== "UNKNOWN"),
    forbiddenIntentCategories: [],
  };
}

function inferCategories(text: string, rules: CategoryRule[], suppressNegatedSend: boolean) {
  const categories: IntentCategory[] = [];
  const signals: string[] = [];
  const normalized = text.trim();
  const noSend = /\b(do not|don't|dont|without)\s+(send|forward|email|message|post|publish)\b/i.test(normalized);
  for (const rule of rules) {
    if (suppressNegatedSend && rule.category === "SEND_MESSAGE" && noSend) continue;
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      categories.push(rule.category);
      signals.push(rule.signal);
    }
  }
  return { categories: normalizeCategories(categories), signals: [...new Set(signals)] };
}

function normalizeCategories(values: IntentCategory[]) {
  return [...new Set(values.filter((value): value is IntentCategory => INTENT_CATEGORIES.includes(value)))];
}

function calculateConfidence(categories: IntentCategory[], injectionDetected: boolean, signalCount: number) {
  if (categories.includes("UNKNOWN")) return injectionDetected ? 0.2 : 0.3;
  let confidence = categories.length === 1 ? 0.9 : 0.75;
  if (signalCount >= 2) confidence += 0.05;
  if (injectionDetected) confidence -= 0.35;
  return Math.max(0.1, Math.min(0.98, Number(confidence.toFixed(2))));
}

function choosePrimaryCategory(categories: IntentCategory[]) {
  const priority: IntentCategory[] = [
    "PAYMENT",
    "PURCHASE",
    "DELETE",
    "SEND_MESSAGE",
    "MODIFY",
    "WRITE_DRAFT",
    "SUMMARIZE",
    "SEARCH",
    "READ",
    "CALL_EXTERNAL_API",
    "EXPORT_DATA",
    "RUN_CODE",
    "INSTALL_PACKAGE",
    "LOGIN",
    "MEMORY_WRITE",
    "UNKNOWN",
  ];
  return priority.find((category) => categories.includes(category)) ?? categories[0] ?? "UNKNOWN";
}

function summarizeCategories(categories: IntentCategory[], confidence: number, injectionDetected: boolean) {
  if (injectionDetected) return "User prompt contains an instruction-change or prompt-injection signal.";
  if (categories.includes("UNKNOWN")) return "User intent could not be confidently classified.";
  return `User intent categories: ${categories.join(", ")} with ${Math.round(confidence * 100)}% confidence.`;
}

function isExternalTarget(target?: string) {
  if (!target) return true;
  const value = target.toLowerCase();
  return /https?:\/\//.test(value) || /@[a-z0-9.-]+\.[a-z]{2,}/i.test(value) || /\bexternal\b/.test(value);
}

function riskForCategories(categories: IntentCategory[]): IntentRiskLevel {
  if (categories.some((category) => ["PAYMENT", "PURCHASE", "DELETE", "RUN_CODE", "INSTALL_PACKAGE"].includes(category))) return "HIGH";
  if (categories.some((category) => HIGH_IMPACT_CATEGORIES.has(category))) return "MEDIUM";
  return "LOW";
}

function decision(
  intentMatchScore: number,
  actionCategories: IntentCategory[],
  outcome: IntentDecision,
  riskLevel: IntentRiskLevel,
  reason: string,
  matches: IntentActionDecisionResult["policyMatches"],
  id: string,
): IntentActionDecisionResult {
  matches.push({ id, label: reason, severity: riskLevel });
  return {
    intentMatchScore,
    actionCategories,
    decision: outcome,
    riskLevel,
    reason,
    policyMatches: matches,
  };
}

export function safeIntentJson(intent: ExtractedIntent) {
  return {
    primaryCategory: intent.primaryCategory,
    categories: intent.categories,
    confidence: intent.confidence,
    summary: sanitizeLogText(intent.summary),
    signals: intent.signals,
    injectionDetected: intent.injectionDetected,
  };
}

export function sanitizeIntentText(value?: string | null) {
  return value ? sanitizeLogText(value) : null;
}

export function guardPromptInjectionDetected(prompt: string) {
  const guard = analyzeText(prompt, "INPUT");
  return guard.riskTypes.includes("PROMPT_INJECTION") || PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(prompt));
}
