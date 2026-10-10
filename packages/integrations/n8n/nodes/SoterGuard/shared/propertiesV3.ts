import type { INodeProperties, INodePropertyCollection, INodePropertyOptions } from "n8n-workflow";

import {
  OPERATIONS,
  PANEL_ORDER,
  RESOURCES,
  defaultOperationFor,
  operationsForResource,
} from "./layoutV3";
import { soterGuardProperties } from "./properties";

/**
 * The version-3 panel, generated from `layoutV3.ts` and the field definitions
 * version 2 already publishes.
 *
 * Fields inherit their storage keys, types, and defaults from properties.ts.
 * Version-specific copy and compact controls are overridden here. Visibility
 * and required markers come from the layout; saved v1/v2 parameter locations
 * remain supported by their existing panels.
 *
 * Three structural rules this file enforces by construction, because the n8n
 * linter checks them and a hand-written panel drifts out of them silently:
 *
 *   - children of a collection carry no `displayOptions` and are never
 *     `required` (n8n renders them all, always, once the collection is added);
 *   - children are sorted alphabetically by display name;
 *   - operations whose Options are the same list share one collection property,
 *     so the same storage key never means two different things.
 */

// ---------------------------------------------------------------------------
// Looking definitions up in the published array
// ---------------------------------------------------------------------------

/**
 * Finds the one source definition for a name, refusing an ambiguous match.
 *
 * Several names appear twice in `properties.ts` on purpose — `toolName` is
 * required for Check Tool Call and optional for Validate Passport, so the star
 * tells the truth — and picking the wrong twin would put a required star on an
 * optional field or drop one from a field `execute.ts` throws without. Throwing
 * on 0 or 2 matches turns that into a loud failure at load time instead of a
 * quietly wrong panel.
 */
function source(name: string, pick?: (property: INodeProperties) => boolean): INodeProperties {
  const matches = soterGuardProperties.filter((property) => property.name === name && (!pick ? true : pick(property)));
  if (matches.length !== 1) {
    throw new Error(`propertiesV3: expected exactly one "${name}" in properties.ts, found ${matches.length}`);
  }
  return matches[0];
}

/** Finds a child of the version-2 "Options" (performance) collection. */
function runtimeSource(name: string): INodeProperties {
  const collection = source("advancedOptions");
  const child = (collection.options as INodeProperties[] | undefined)?.find((option) => option.name === name);
  if (!child) throw new Error(`propertiesV3: no "${name}" inside advancedOptions in properties.ts`);
  return child;
}

const isRequired = (property: INodeProperties) => property.required === true;
const isOptional = (property: INodeProperties) => property.required !== true;
const forVersion2 = (property: INodeProperties) => {
  const versions = property.displayOptions?.show?.["@version"] as number[] | undefined;
  return !versions || versions.includes(2);
};

/** Drops the fields that only make sense at a definition's old position. */
function rehome(property: INodeProperties): INodeProperties {
  const clone: INodeProperties = { ...property };
  delete clone.displayOptions;
  delete clone.required;
  return clone;
}

// ---------------------------------------------------------------------------
// Version-3 copy overrides
//
// Compact native controls, consistent vocabulary, and operation-specific copy.
// ---------------------------------------------------------------------------

/** Passport vocabulary. Under an "Agent Passport" resource, "Access Pass Token" reads as a different thing. */
const PANEL_OVERRIDES: Record<string, Partial<INodeProperties>> = {
  detectionEngine: {
    description: "Where checks run. Cloud requires a SoterAI credential; Local keeps data inside n8n.",
    options: [
      { name: "Auto (Recommended)", value: "AUTO", description: "Cloud first; use local rules if the cloud is unavailable" },
      { name: "Cloud Only", value: "CLOUD", description: "Full cloud detection; fail the item if the service is unavailable" },
      { name: "Local Only", value: "LOCAL", description: "Bundled rules, no network or API key; reduced detection coverage" },
    ],
  },
  inputText: {
    typeOptions: { rows: 3 },
    hint: "Map the message from the previous node, for example {{ $json.chatInput }}",
  },
  outputText: {
    typeOptions: { rows: 3 },
    hint: "Use {{ $json.safeText }} or {{ $json.outputText }} from this node downstream",
  },
  universalOutputText: {
    displayName: "AI Output Text",
    typeOptions: { rows: 3 },
    hint: "Optional when Input Text is supplied. Both directions can be checked together",
  },
  onThreat: {
    description: "How to handle a detected threat. Approval and unavailable-layer decisions may still route to Flagged.",
    hint: "Block sends threats to Flagged. Configure customer wording in Customer Replies",
    options: [
      { name: "Block", value: "BLOCK", description: "Route stopped items to Flagged" },
      { name: "Continue", value: "CONTINUE", description: "Allow detected threats to continue; inspect the verdict downstream" },
      { name: "Redact", value: "REDACT", description: "Remove unsafe content and continue with the cleaned text" },
      { name: "Warn", value: "WARN", description: "Continue and include a warning in the result" },
    ],
  },
  sensitivity: {
    hint: "Balanced suits most workflows. Lenient reduces borderline stops; Strict also acts on lower-confidence findings",
    description: "Detection threshold. Output Guard in Lenient mode redacts detected secrets instead of hard-blocking them.",
  },
  protectionProfile: {
    hint: "Maximum is the production default. On Threat controls how detected threats are handled",
  },
  agentIdentityId: {
    description: "Identity ID returned by Enroll Identity",
  },
  passportToken: {
    displayName: "Passport Token",
    description:
      "Token returned by Issue Passport. If empty, uses the incoming passportToken or passport.token. Prefer expressions to saved tokens.",
  },
  passportId: {
    displayName: "Passport ID",
    description: "Passport ID to revoke. Optional when Session ID is provided.",
  },
  passportTtlSeconds: {
    displayName: "Passport Lifetime (Seconds)",
  },
  piiText: {
    // The behaviour sentence this hint used to carry is now the operation's
    // notice, so the hint goes back to being about what to put in the field.
    typeOptions: { rows: 3 },
    hint: "Use {{ $json.outputText }} from this node for the cleaned copy",
  },
  ragText: {
    typeOptions: { rows: 3 },
  },
  securityContext: {
    displayName: "Additional Security Layers",
    description: "Add the RAG, tool, memory, or output destination your workflow uses. Each layer is optional.",
  },
  userMessages: {
    description: "Optional customer-facing replies. Results are returned in userMessage; your workflow delivers them.",
  },
};

/** The panel Session ID, which is the thread every passport step has to share. */
const PANEL_SESSION_HINT = "Use the same session across passport steps. If empty, reads the session from the incoming item";

const OPTION_OVERRIDES: Record<string, Partial<INodeProperties>> = {
  branchOnRedaction: {
    displayName: "Branch On Redaction",
    noDataExpression: true,
    description: "Whether to split unchanged items onto Clean and sanitized items onto Redacted",
  },
  sessionId: {
    hint: "Recommended. Keeps one conversation's messages together across turns.",
  },
  metadata: {
    // "Session ID has its own field above" was true when Session ID was a
    // top-level field. It is now a sibling inside this same collection.
    hint: "Optional. Extra fields for your own audit logs.",
    default: "{}",
  },
  allowedTopics: {
    hint: "Comma-separated subjects, such as billing, shipping, returns. Configure Topic Handling to choose their effect",
  },
  topicHandling: {
    hint: "Uses Allowed Semantic Topics and System Prompt Context. Clear attack patterns remain enforced",
  },
  alwaysAllow: {
    description: "Exact whole-message matches bypass input detection. Other configured firewall layers are still checked.",
  },
  enforceOnSensitiveData: {
    hint: "Off: redact sensitive-only findings and continue. On: apply On Threat to sensitive data as well",
  },
  neverDowngradeToLocal: {
    hint: "In Auto mode, fail the item when the cloud cannot answer instead of switching to local rules",
  },
  passportPolicy: {
    displayName: "Policy Overrides (JSON)",
    default: "{}",
    description:
      "JSON object merged over the preset. Supports allowedTools, blockedTools, approvalRequiredTools, allowedDomains, blockedDomains, dataScopes, memoryScopes. Custom JSON Only starts with empty lists.",
  },
  passportToken: {
    displayName: "Passport Token",
    description:
      "Raw short-lived token returned by Issue Passport. Use an expression; do not hard-code it in workflow JSON.",
  },
};

/**
 * Policy presets, reordered and described from what `PASSPORT_POLICY_PRESETS` in
 * execute.ts actually contains.
 *
 * Version 2 sorted them alphabetically, which put "Coding Agent" first and the
 * recommended least-privilege preset third. Put the default first and keep the
 * descriptions short enough to compare inside n8n's dropdown.
 */
const PASSPORT_PRESET_OPTIONS: INodePropertyOptions[] = [
  {
    name: "Read Only (Recommended)",
    value: "READ_ONLY",
    description:
      "Read and search tools; writes and outbound actions require approval; destructive tools are blocked",
  },
  {
    name: "Customer Support",
    value: "SUPPORT",
    description:
      "Support lookups; customer updates, messages, and refunds require approval",
  },
  {
    name: "Coding Agent",
    value: "CODING",
    description:
      "Repository reads and tests; file writes, terminal commands, pushes, and publishing require approval",
  },
  {
    name: "Custom JSON Only",
    value: "CUSTOM",
    description:
      "Empty policy lists. Define tool access and scopes in Policy Overrides (JSON) under Options.",
  },
];

// ---------------------------------------------------------------------------
// Notices. Exactly one per operation.
// ---------------------------------------------------------------------------

/** One short task-specific notice per operation. */
const OPERATION_NOTICES: Record<string, string> = {
  enforcingNotice:
    "Connect <b>Safe</b> to the next step and <b>Flagged</b> to your alert or review path. Use the cleaned text from this node downstream.",
  universalNotice:
    "Supply input, AI output, or both. Add security layers below as needed. Connect <b>Safe</b> to the next step and <b>Flagged</b> to review.",
  redactNotice:
    "The cleaned copy is returned in <code>{{ $json.outputText }}</code>. Enable <b>Branch On Redaction</b> under Options to split Clean and Redacted items.",
  reportOnlyNotice:
    "Returns a risk report. Clean items go to <b>Safe</b>; risky items go to <b>Flagged</b>. Connect both paths to handle each result.",
  auditNotice:
    "Local static review of exported workflow JSON. No workflow execution, network request, or credential access.",
  enrollIdentityNotice:
    "Create an agent identity, then pass <code>{{ $json.agentIdentityId }}</code> to <b>Issue Passport</b>.",
  issuePassportNotice:
    "Issue a short-lived passport. Pass <code>passportToken</code> and <code>sessionId</code> to the validation and tool-check steps by expression.",
  validatePassportNotice:
    "Validate the session passport. Token and session can come from the incoming item. Optional tool fields check authorization for a specific call.",
  toolCallNotice:
    "Place before the real tool. Allowed calls go to <b>Safe</b>; blocked or approval-required calls go to <b>Flagged</b>.",
  revokePassportNotice:
    "Revoke by <b>Session ID</b> or <b>Passport ID</b>. A successful revocation returns <code>PASSPORT_REVOKED</code> on Safe.",
};

function noticeText(name: string): string {
  const text = OPERATION_NOTICES[name];
  if (!text) throw new Error(`propertiesV3: no text for notice "${name}"`);
  return text;
}

// ---------------------------------------------------------------------------
// Option children: one definition per setting, shared by every group that uses it
// ---------------------------------------------------------------------------

const OPTION_SOURCES: Record<string, () => INodeProperties> = {
  detectionEngine: () => source("detectionEngine"),
  neverDowngradeToLocal: () => runtimeSource("neverDowngradeToLocal"),
  includeRawResponse: () => runtimeSource("includeRawResponse"),
  batchConcurrency: () => runtimeSource("batchConcurrency"),
  requestTimeoutMs: () => runtimeSource("requestTimeoutMs"),
  reuseIdenticalItems: () => runtimeSource("reuseIdenticalItems"),
  parallelLayers: () => runtimeSource("parallelLayers"),
  sessionId: () => source("sessionId", isOptional),
  projectId: () => source("projectId"),
  metadata: () => source("metadata", forVersion2),
  allowedTopics: () => source("allowedTopics"),
  alwaysAllow: () => source("alwaysAllow"),
  topicHandling: () => source("topicHandling"),
  systemPromptContext: () => source("systemPromptContext"),
  ignoredEntities: () => source("ignoredEntities"),
  ignoredWords: () => source("ignoredWords"),
  enforceOnSensitiveData: () => source("enforceOnSensitiveData"),
  passportToken: () => source("passportToken"),
  passportPolicy: () => source("passportPolicy"),
  onSessionConflict: () => source("onSessionConflict"),
  toolContent: () => source("toolContent"),
  toolTarget: () => source("toolTarget"),
  toolDestination: () => source("toolDestination"),
  branchOnRedaction: () => runtimeSource("branchOnRedaction"),
};

function optionChild(name: string): INodeProperties {
  const build = OPTION_SOURCES[name];
  if (!build) throw new Error(`propertiesV3: no source for option "${name}"`);
  return { ...rehome(build()), ...(OPTION_OVERRIDES[name] ?? {}) };
}

const OPTION_CHILDREN: Record<string, INodeProperties> = Object.fromEntries(
  Object.keys(OPTION_SOURCES).map((name) => [name, optionChild(name)]),
);

/**
 * What an untouched Option resolves to.
 *
 * n8n stores a collection as an object holding only the keys the author
 * actually set, so an option nobody opened is simply absent — it does not
 * resolve to the default shown beside it. Every `getNodeParameter` in
 * execute.ts passes its own fallback, and those fallbacks were written for
 * top-level fields where n8n supplied the default itself. The two disagree in
 * at least one place that matters: Detection Engine is `AUTO` on the node and
 * `CLOUD` in execute.ts's fallback, so reading the collection naively would
 * turn off the local fallback for every author who never opened Options.
 *
 * `parameterLayout.ts` answers an absent option from here instead.
 */
export const V3_OPTION_DEFAULTS: Record<string, unknown> = Object.fromEntries(
  Object.entries(OPTION_CHILDREN).map(([name, child]) => [name, child.default]),
);

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const byDisplayName = (a: INodeProperties, b: INodeProperties) =>
  a.displayName < b.displayName ? -1 : a.displayName > b.displayName ? 1 : 0;

function resourceProperty(): INodeProperties {
  return {
    displayName: "Resource",
    name: "resource",
    type: "options",
    noDataExpression: true,
    // Task order, not alphabetical: Guardrail is what nearly every workflow
    // needs, and Agent Passport is the advanced lifecycle nobody meets first.
    options: RESOURCES.map((resource) => ({
      name: resource.name,
      value: resource.value,
      description: resource.description,
    })),
    // A literal, not `RESOURCES[0].value`: the n8n linter's default-missing rule
    // reads this object statically and does not accept a computed default. It is
    // the first resource's value; `v3-layout.test.ts` fails if the two drift.
    default: "guardrail",
  };
}

function operationProperties(): INodeProperties[] {
  return RESOURCES.map((resource) => ({
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    displayOptions: { show: { resource: [resource.value] } },
    // Listed in the order a person should meet them, not alphabetically.
    options: operationsForResource(resource.value).map((operation) => ({
      name: operation.name,
      value: operation.value,
      description: operation.description,
      action: operation.action,
    })),
    default: defaultOperationFor(resource.value),
  }));
}

function noticeProperties(): INodeProperties[] {
  const byNotice = new Map<string, string[]>();
  for (const operation of OPERATIONS) {
    byNotice.set(operation.notice, [...(byNotice.get(operation.notice) ?? []), operation.value]);
  }
  return [...byNotice].map(([name, operations]) => ({
    displayName: noticeText(name),
    name,
    type: "notice" as const,
    default: "",
    displayOptions: { show: { operation: operations } },
  }));
}

/**
 * Picks the source twin for a panel field, by whether this group is the required
 * one. Only the three names that exist twice in properties.ts need the hint.
 */
function panelSource(name: string, required: boolean): INodeProperties {
  if (name === "toolName" || name === "toolAction") return source(name, required ? isRequired : isOptional);
  if (name === "sessionId") return source(name, required ? isRequired : isOptional);
  if (name === "metadata") return source(name, forVersion2);
  return source(name);
}

function panelProperties(): INodeProperties[] {
  const properties: INodeProperties[] = [];
  for (const name of PANEL_ORDER) {
    const hosts = OPERATIONS.filter((operation) => operation.fields.includes(name));
    if (hosts.length === 0) continue;
    for (const required of [true, false]) {
      const group = hosts.filter((operation) => operation.required.includes(name) === required);
      if (group.length === 0) continue;
      const property: INodeProperties = {
        ...rehome(panelSource(name, required)),
        ...(PANEL_OVERRIDES[name] ?? {}),
        displayOptions: { show: { operation: group.map((operation) => operation.value) } },
      };
      if (required) property.required = true;
      if (name === "sessionId") {
        property.hint = PANEL_SESSION_HINT;
        // The required twin is Validate Passport, whose published description
        // ("Validation is refused without it") is already exactly right. The
        // optional twin's description was written for guards, where a missing
        // session weakens multi-turn detection; under Agent Passport it has to
        // describe the thread the lifecycle shares instead.
        if (!required) {
          property.description =
            "Session shared by the passport steps. Validate needs a session here or in the incoming item. Revoke accepts this or Passport ID.";
        }
      }
      if (name === "inputText" && !required) {
        property.hint = "Optional when AI Output Text is supplied. Leave empty for an output-only check";
      }
      if (name === "detectionEngine") {
        // Lifecycle state cannot be reconstructed by a cloud fallback. Explicit
        // Local is a simulation, a different promise from local text detection.
        const lifecycle = group.filter((operation) =>
          ["enrollIdentity", "issuePassport", "validatePassport", "revokePassport"].includes(operation.value),
        );
        if (lifecycle.length) {
          properties.push({
            ...property,
            displayOptions: { show: { operation: lifecycle.map((operation) => operation.value) } },
            description: "Cloud and Auto use server-side passport state. Local simulates the lifecycle inside this n8n process.",
            options: [
              { name: "Auto (Cloud)", value: "AUTO", description: "Cloud state; fails if unavailable, with no local fallback" },
              { name: "Cloud Only", value: "CLOUD", description: "Cloud state with a SoterAI credential" },
              { name: "Local Simulation", value: "LOCAL", description: "Testing only: process-local state, emulated tokens, no cloud authorization" },
            ],
          });
          const detection = group.filter((operation) => !lifecycle.includes(operation));
          if (!detection.length) continue;
          property.displayOptions = { show: { operation: detection.map((operation) => operation.value) } };
        }
      }
      if (name === "passportPolicyPreset") property.options = PASSPORT_PRESET_OPTIONS;
      if (name === "securityContext") {
        // Empty optional JSON is accepted at runtime but shows a syntax error
        // in n8n's editor. Start with the appropriate valid empty container.
        property.options = (property.options as INodePropertyCollection[]).map((layer) => ({
          ...layer,
          values: layer.values.map((field) => field.type === "json"
            ? { ...field, default: field.name === "protectedSources" ? "[]" : "{}" }
            : field),
        }));
      }
      properties.push(property);
    }
  }
  return properties;
}

function optionProperties(): INodeProperties[] {
  // Group by the exact option list, so two operations offering the same settings
  // share one collection rather than declaring the same storage key twice.
  const groups = new Map<string, { names: string[]; operations: string[] }>();
  for (const operation of OPERATIONS) {
    if (operation.options.length === 0) continue;
    const names = [...operation.options].sort();
    const key = names.join(",");
    const existing = groups.get(key);
    if (existing) existing.operations.push(operation.value);
    else groups.set(key, { names, operations: [operation.value] });
  }

  return [...groups.values()].map(({ names, operations }) => ({
    displayName: "Options",
    name: "options",
    type: "collection" as const,
    placeholder: "Add Option",
    description: "Optional detection, audit, and execution settings. Defaults apply until a setting is added.",
    default: {},
    displayOptions: { show: { operation: operations } },
    options: names.map((name) => OPTION_CHILDREN[name]).sort(byDisplayName),
  }));
}

/**
 * The whole version-3 panel, in render order: what am I doing, the one notice
 * that says what this operation will and will not do, the fields it needs, and
 * the single Options button for everything else.
 */
export const soterGuardPropertiesV3: INodeProperties[] = [
  resourceProperty(),
  ...operationProperties(),
  ...noticeProperties(),
  ...panelProperties(),
  ...optionProperties(),
];
