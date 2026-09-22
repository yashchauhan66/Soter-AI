import type { INodeProperties, INodePropertyOptions } from "n8n-workflow";

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
 * Nothing here re-types a label, a hint, a placeholder, or a dropdown. Every
 * field is looked up in `properties.ts` and re-homed: `displayOptions` is
 * replaced with the version-3 condition, `required` is set from the layout, and
 * a small number of sentences are overridden where the version-2 wording is
 * wrong at its new position ("Session ID has its own field above" is false once
 * the field moved into Options). A wording fix in `properties.ts` therefore
 * reaches every version, which is the whole reason this file generates rather
 * than copies.
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
// Only sentences that read wrongly at their new position. Everything else is
// inherited, so a fix in properties.ts reaches v1, v2 and v3 together.
// ---------------------------------------------------------------------------

/** Passport vocabulary. Under an "Agent Passport" resource, "Access Pass Token" reads as a different thing. */
const PANEL_OVERRIDES: Record<string, Partial<INodeProperties>> = {
  passportToken: {
    displayName: "Passport Token",
    description:
      "Raw short-lived token returned by Issue Passport. Use an expression; do not hard-code it in workflow JSON.",
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
    hint: "Usually an expression pointing at the previous node, such as {{ $json.text }}",
  },
};

/** The panel Session ID, which is the thread every passport step has to share. */
const PANEL_SESSION_HINT = "Use the same value in every passport step. Revoke accepts this or Passport ID.";

const OPTION_OVERRIDES: Record<string, Partial<INodeProperties>> = {
  sessionId: {
    hint: "Recommended. Keeps one conversation's messages together across turns.",
  },
  metadata: {
    // "Session ID has its own field above" was true when Session ID was a
    // top-level field. It is now a sibling inside this same collection.
    hint: "Optional. Extra fields for your own audit logs.",
  },
  allowedTopics: {
    hint: "Optional. Comma-separated. Topic Handling does nothing while this is empty.",
  },
  passportPolicy: {
    displayName: "Policy Overrides (JSON)",
    description:
      "Policy keys merged over the preset: allowedTools, blockedTools, approvalRequiredTools, allowedDomains, blockedDomains, dataScopes, memoryScopes. Required when the preset is Custom JSON Only, which starts from an empty policy.",
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
 * recommended least-privilege preset third. The order here is the order of
 * increasing reach, and every description is the preset's real tool lists rather
 * than a characterisation of them — a reader choosing a security policy should
 * not have to open the source to find out what they picked.
 */
const PASSPORT_PRESET_OPTIONS: INodePropertyOptions[] = [
  {
    name: "Read Only (Recommended)",
    value: "READ_ONLY",
    description:
      "Allows browser.read, browser.open, rag.search, calendar.read, filesystem.read. Blocks terminal.run, filesystem.delete, payments.charge, secrets.read, and asks for approval on browser.submit_form, gmail.send, filesystem.write, api.call, mcp.tool.call.",
  },
  {
    name: "Customer Support",
    value: "SUPPORT",
    description:
      "Allows rag.search, crm.read, orders.read, tickets.read. Blocks terminal.run, filesystem.delete, secrets.read, payments.charge, and asks for approval on gmail.send, crm.update, tickets.update, payments.refund.",
  },
  {
    name: "Coding Agent",
    value: "CODING",
    description:
      "Allows filesystem.read, repository.search, tests.run. Blocks secrets.read, filesystem.delete, payments.charge, and asks for approval on filesystem.write, terminal.run, git.push, package.publish.",
  },
  {
    name: "Custom JSON Only",
    value: "CUSTOM",
    description:
      "Starts from an empty policy — no allowed tools, no blocked tools, no scopes. Everything the agent may do has to come from Policy Overrides (JSON) under Options.",
  },
];

// ---------------------------------------------------------------------------
// Notices. Exactly one per operation.
// ---------------------------------------------------------------------------

/** Notices whose wording already exists in properties.ts, mapped v3 name -> source name. */
const REUSED_NOTICES: Record<string, string> = {
  reportOnlyNotice: "reportOnlyNoticeV2",
  auditNotice: "auditNotice",
  enrollIdentityNotice: "enrollIdentityNotice",
  issuePassportNotice: "issuePassportNotice",
  validatePassportNotice: "validatePassportNotice",
  toolCallNotice: "toolCallNotice",
  revokePassportNotice: "revokePassportNotice",
};

/** The two version-3 notices with no version-2 equivalent. */
const NEW_NOTICES: Record<string, string> = {
  enforcingNotice:
    "This operation enforces. <b>On Threat</b> decides what happens to anything flagged, and flagged items leave through the <b>Flagged</b> output instead of the main path.",
  redactNotice:
    "Never blocks and never stops an item. The cleaned copy arrives as <code>{{ $json.outputText }}</code> on the single output; the text you pass in is not modified in place.",
};

function noticeText(name: string): string {
  if (NEW_NOTICES[name]) return NEW_NOTICES[name];
  const sourceName = REUSED_NOTICES[name];
  if (!sourceName) throw new Error(`propertiesV3: no text for notice "${name}"`);
  return source(sourceName).displayName;
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
  toolContent: () => source("toolContent"),
  toolTarget: () => source("toolTarget"),
  toolDestination: () => source("toolDestination"),
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
            "Stable per-conversation ID tying this step to the rest of the passport flow. Validate Passport is refused without it, and Revoke accepts this or the Passport ID.";
        }
      }
      if (name === "passportPolicyPreset") property.options = PASSPORT_PRESET_OPTIONS;
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
