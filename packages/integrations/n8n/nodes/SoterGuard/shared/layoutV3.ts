/**
 * The version-3 panel, described once.
 *
 * Version 3 is a new *panel* over the version-2 engine: a Resource → Operation
 * pair instead of one flat twelve-item Action dropdown, the fields an operation
 * actually needs on the panel, and everything else behind a single Options
 * button. Nothing about detection, verdicts, routing, or the output contract
 * changes.
 *
 * This file is the only place that layout is written down. Three things read it
 * and must never drift apart:
 *
 *   1. `propertiesV3.ts` generates the panel from it.
 *   2. `parameterLayout.ts` maps the parameter names `execute.ts` asks for onto
 *      wherever this layout put them, so `execute.ts` is not forked.
 *   3. `test/v3-layout.test.ts` checks the rendered panel against it, and checks
 *      it against what version 2 offered.
 *
 * Two rules that are not style preferences:
 *
 * - **Operation values are the version-2 `action` values, unchanged.** They are
 *   storage keys and they are also what `execute.ts` switches on. Only the
 *   parameter *name* changed (`action` -> `operation`), which is safe because no
 *   v3 node has ever been saved.
 * - **A setting version 2 offered for an action must still be reachable in
 *   version 3.** Moving a control behind Options is fine; dropping it is a
 *   silent reduction in what an author can configure on a security node. The two
 *   deliberate narrowings are listed in `INTENDED_NARROWING` below, with their
 *   reasons, and the test suite fails on any other one.
 */

export interface ResourceSpec {
  name: string;
  value: string;
  description: string;
}

export interface OperationSpec {
  /** Resource this operation is listed under. */
  resource: string;
  /**
   * Storage value — byte-identical to the version-2 `action` value, because
   * `execute.ts` switches on it and saved workflows store it.
   */
  value: string;
  name: string;
  description: string;
  /** Verb phrase the node-creator panel shows. Only read when the parameter is named `operation`. */
  action: string;
  /** The single notice property shown for this operation. Exactly one, always. */
  notice: string;
  /** Parameter names on the panel, filtered through PANEL_ORDER at generation time. */
  fields: string[];
  /** Subset of `fields` that carries the required star. */
  required: string[];
  /** Parameter names inside the Options collection. */
  options: string[];
}

// ---------------------------------------------------------------------------
// Option groups
//
// RUNTIME is transport and batching: it means the same thing for every
// operation that talks to the API. COMMON adds the engine choice and the
// identifiers every detection call carries. Naming the groups rather than
// repeating twelve lists is what keeps "Guard Output offers everything Analyze
// Text offers" true by construction instead of by review.
// ---------------------------------------------------------------------------

/** Transport and batching. Every operation that can reach the API offers these. */
const RUNTIME = ["includeRawResponse", "batchConcurrency", "requestTimeoutMs", "reuseIdenticalItems"];

/**
 * Where detection runs, plus the one switch that only means anything alongside
 * it. `neverDowngradeToLocal` is grouped with the engine on purpose: it decides
 * what Auto does when the cloud is unreachable, so on an operation with no
 * engine choice it is a control that cannot do anything.
 */
const ENGINE = ["detectionEngine", "neverDowngradeToLocal"];

/** Everything a detection operation carries beyond its own text fields. */
const COMMON = [...ENGINE, "sessionId", "projectId", "metadata", ...RUNTIME];

/** Topic scope: what this assistant is *for*, and what that does to a verdict. */
const TOPIC_SCOPE = ["allowedTopics", "alwaysAllow", "topicHandling", "systemPromptContext"];

/**
 * The redaction allow-list. Not part of TOPIC_SCOPE — Guard Output and Redact
 * have no topic scope but do redact, so the two travel separately.
 */
const REDACTION = ["ignoredEntities", "ignoredWords"];

/**
 * Widens what On Threat acts on. Its own group rather than part of REDACTION,
 * which Redact Secrets or PII also carries: that operation has no On Threat and
 * never stops an item, so a switch that changes what On Threat does would be a
 * control with nothing to control.
 */
const ENFORCEMENT = ["enforceOnSensitiveData"];

/** Identifiers and audit fields for the passport lifecycle, which has no engine choice. */
const PASSPORT_COMMON = ["projectId", "metadata", ...RUNTIME];

/** The optional tool details both passport checks accept. */
const TOOL_DETAILS = ["toolContent", "toolTarget", "toolDestination"];

export const RESOURCES: ResourceSpec[] = [
  {
    name: "Guardrail",
    value: "guardrail",
    description: "Check a prompt, an AI response, or a whole AI turn for threats",
  },
  {
    name: "RAG Document",
    value: "ragDocument",
    description: "Check a document before it enters a knowledge base",
  },
  {
    name: "Workflow",
    value: "workflow",
    description: "Review an n8n workflow's own AI security risks",
  },
  {
    name: "Agent Passport",
    value: "agentPassport",
    description: "Give an agent an identity, a short-lived pass, and per-call authorization",
  },
];

/**
 * `required` is a claim the editor enforces, so it is set from evidence, not
 * from taste. n8n turns an empty required field into a node issue and refuses to
 * run the workflow (`NodeHelpers.getNodeParametersIssues`, checked against
 * n8n-workflow 1.120.19), which means a star on an optional field takes away a
 * configuration that works. Every star below is one that `execute.ts` throws on
 * or the API's own zod schema rejects; the comments name which.
 */
export const OPERATIONS: OperationSpec[] = [  {
    resource: "guardrail",
    value: "inputGuard",
    name: "Guard Input",
    description: "Check a user's message before it reaches the AI, and block or clean it. Start here.",
    action: "Check user input for threats",
    notice: "enforcingNotice",
    fields: ["inputText", "onThreat", "sensitivity", "userMessages"],
    required: ["inputText"],
    options: [...TOPIC_SCOPE, ...REDACTION, ...ENFORCEMENT, ...COMMON],
  },
  {
    resource: "guardrail",
    value: "outputGuard",
    name: "Guard Output",
    description: "Check the AI's reply before the user sees it, and block or clean it",
    action: "Check AI output for threats",
    notice: "enforcingNotice",
    fields: ["outputText", "onThreat", "sensitivity", "userMessages"],
    required: ["outputText"],
    options: [...REDACTION, ...ENFORCEMENT, ...COMMON],
  },
  {
    resource: "guardrail",
    value: "universalGuard",
    name: "Universal Firewall",
    description: "All-in-one guard for prompt, files, tools, memory, output, and data leaks. Most complete.",
    action: "Protect an AI workflow end to end",
    notice: "enforcingNotice",
    fields: ["inputText", "universalOutputText", "protectionProfile", "onThreat", "securityContext", "userMessages"],
    required: ["inputText"],
    options: [...TOPIC_SCOPE, ...REDACTION, ...ENFORCEMENT, "passportToken", "parallelLayers", ...COMMON],
  },
  {
    resource: "guardrail",
    value: "analyzeText",
    name: "Analyze Text",
    description: "Score any text for risk without blocking — Safe and risky items are split so you decide",
    action: "Analyze text for AI security risks",
    notice: "reportOnlyNotice",
    fields: ["inputText", "userMessages"],
    required: ["inputText"],
    options: [...COMMON],
  },
  {
    resource: "guardrail",
    value: "piiRedactor",
    name: "Redact Secrets or PII",
    description: "Get a cleaned copy of text with personal data and secrets removed. Use it downstream.",
    action: "Redact secrets and PII from text",
    notice: "redactNotice",
    fields: ["piiText"],
    required: ["piiText"],
    options: [...REDACTION, ...COMMON],
  },
  {
    resource: "ragDocument",
    value: "ragScanner",
    name: "Scan Document",
    description: "Check a document before adding it to a knowledge base. Poisoned files are flagged.",
    action: "Scan a RAG document for threats",
    notice: "reportOnlyNotice",
    fields: ["ragText", "documentId", "documentSource"],
    required: ["ragText", "documentId"],
    options: [...COMMON],
  },
  {
    resource: "workflow",
    value: "workflowAudit",
    name: "Audit Workflow",
    description: "Score a workflow's AI, tool, webhook, code, and data-leak risks. Runs locally, sends nothing.",
    action: "Audit an n8n workflow for AI security risks",
    notice: "auditNotice",
    fields: ["workflowJson"],
    required: ["workflowJson"],
    // The audit is static analysis of pasted JSON. It never reaches the API, so
    // there is no engine, no project, no batching and no timeout to offer.
    options: [],
  },
  {
    resource: "agentPassport",
    value: "enrollIdentity",
    name: "Enroll Identity",
    description: "Give an AI agent a reusable identity with a safe, least-privilege starting policy",
    action: "Enroll an agent identity",
    notice: "enrollIdentityNotice",
    fields: ["agentName", "agentType", "agentDescription", "passportPolicyPreset"],
    required: ["agentName"],
    options: ["passportPolicy", ...PASSPORT_COMMON],
  },
  {
    resource: "agentPassport",
    value: "issuePassport",
    name: "Issue Passport",
    description: "Give an enrolled agent a short-lived access pass for one session",
    action: "Issue an agent passport",
    notice: "issuePassportNotice",
    fields: ["agentIdentityId", "sessionId", "passportTtlSeconds", "passportPolicyPreset"],
    // Session ID is deliberately NOT starred. `agentPassportIssueSchema` marks it
    // `.optional()` and execute.ts sends it only when present, so a session-less
    // passport is a configuration the product accepts. A star here would make n8n
    // report a node issue and refuse to run that workflow at all.
    required: ["agentIdentityId"],
    options: ["passportPolicy", ...PASSPORT_COMMON],
  },
  {
    resource: "agentPassport",
    value: "validatePassport",
    name: "Validate Passport",
    description: "Check that an agent's session pass is still valid, and whether an action is allowed",
    action: "Validate an agent passport",
    notice: "validatePassportNotice",
    fields: ["passportToken", "sessionId", "toolName", "toolAction"],
    // execute.ts throws "Session ID is required to validate a passport.", and
    // `agentPassportValidateSchema` makes it `min(1)` server-side.
    required: ["sessionId"],
    options: [...TOOL_DETAILS, ...PASSPORT_COMMON],
  },
  {
    resource: "agentPassport",
    value: "toolCall",
    name: "Check Tool Call",
    description: "Check one tool call an agent wants to make before it runs",
    action: "Check an agent tool call",
    notice: "toolCallNotice",
    fields: ["passportToken", "sessionId", "toolName", "toolAction"],
    // execute.ts throws "Tool Name and Tool Action are required.", and
    // `agentActionSchema` makes both `min(1)` server-side, so the two stars are
    // the truth. Session ID is `.optional()` in that same schema — a tool check
    // authenticated by the passport token alone is valid — so it is not starred.
    required: ["toolName", "toolAction"],
    // The only passport operation that is not cloud-only in execute.ts, so it is
    // the only one where the engine choice is a real choice.
    options: [...ENGINE, ...TOOL_DETAILS, ...PASSPORT_COMMON],
  },
  {
    resource: "agentPassport",
    value: "revokePassport",
    name: "Revoke Passport",
    description: "Cancel an agent's access pass when the task ends or something looks wrong",
    action: "Revoke an agent passport",
    notice: "revokePassportNotice",
    fields: ["sessionId", "passportId", "revokeReason"],
    // Either identifier is enough on its own, so neither can honestly carry a star.
    required: [],
    options: [...PASSPORT_COMMON],
  },
];

/**
 * Panel order, global and filtered per operation.
 *
 * Read top to bottom it is the order a person meets the work in: who is acting,
 * what they are acting with, what is being checked, and only then how strictly.
 * Keeping one list rather than twelve is what stops Guard Input and Guard Output
 * drifting into different orders for the same pair of fields.
 */
export const PANEL_ORDER = [
  "agentName",
  "agentType",
  "agentDescription",
  "agentIdentityId",
  "passportToken",
  "sessionId",
  "passportId",
  "revokeReason",
  "toolName",
  "toolAction",
  "passportTtlSeconds",
  "passportPolicyPreset",
  "inputText",
  "outputText",
  "universalOutputText",
  "piiText",
  "ragText",
  "documentId",
  "documentSource",
  "workflowJson",
  "protectionProfile",
  "onThreat",
  "sensitivity",
  "securityContext",
  "userMessages",
];

/**
 * Settings version 2 showed for an action that version 3 deliberately does not,
 * with the reason. Anything not listed here must stay reachable; the test suite
 * checks that against version 2's real property array, so a control cannot be
 * dropped by accident.
 */
export const INTENDED_NARROWING: Record<string, { operations: string[]; reason: string }> = {
  parallelLayers: {
    operations: [
      "analyzeText",
      "enrollIdentity",
      "inputGuard",
      "issuePassport",
      "outputGuard",
      "piiRedactor",
      "ragScanner",
      "revokePassport",
      "toolCall",
      "validatePassport",
    ],
    reason:
      "Only the Universal Firewall has optional layers to run in parallel. Everywhere else version 2 showed a switch that changed nothing.",
  },
  neverDowngradeToLocal: {
    operations: ["enrollIdentity", "issuePassport", "revokePassport", "validatePassport"],
    reason:
      "These four are cloud-only in execute.ts and never fall back to the local engine, so there is nothing to refuse to downgrade to.",
  },
};

export type Placement = "panel" | "options" | "absent";

const BY_VALUE = new Map(OPERATIONS.map((operation) => [operation.value, operation]));

export function operationSpec(value: string): OperationSpec | undefined {
  return BY_VALUE.get(value);
}

export function operationsForResource(resource: string): OperationSpec[] {
  return OPERATIONS.filter((operation) => operation.resource === resource);
}

/** The first operation of a resource — what n8n selects when the resource changes. */
export function defaultOperationFor(resource: string): string {
  return operationsForResource(resource)[0]?.value ?? OPERATIONS[0].value;
}

/**
 * Where this operation keeps that parameter: on the panel, inside Options, or
 * nowhere at all. `parameterLayout.ts` resolves every read through this, which
 * is why the mapping is per operation and not per name — `sessionId` is a panel
 * field on Issue Passport and an Option on Guard Input.
 */
export function placementOf(operation: string, name: string): Placement {
  const spec = BY_VALUE.get(operation);
  if (!spec) return "absent";
  if (spec.fields.includes(name)) return "panel";
  if (spec.options.includes(name)) return "options";
  return "absent";
}

/** Panel fields in global order. The layout lists them per operation; this sorts them. */
export function panelFieldsFor(operation: string): string[] {
  const spec = BY_VALUE.get(operation);
  if (!spec) return [];
  return PANEL_ORDER.filter((name) => spec.fields.includes(name));
}
