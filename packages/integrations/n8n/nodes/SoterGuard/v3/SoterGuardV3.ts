import type {
  ExpressionString,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
  NodeHint,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

import { executeSoterGuard, SINGLE_OUTPUT_ACTIONS } from "../shared/execute";
import { OPERATIONS } from "../shared/layoutV3";
import { withV3ParameterLayout } from "../shared/parameterLayout";
import { soterGuardPropertiesV3 } from "../shared/propertiesV3";

const MAIN = NodeConnectionTypes.Main;

/**
 * Version 3 is a new panel over the version-2 engine.
 *
 * Version 2 opened on one flat twelve-item Action dropdown and, for a guard, up
 * to sixteen more fields underneath it — most of them optional, none of them
 * grouped. Version 3 replaces that with the Resource → Operation pair every
 * other n8n node uses: the fields an operation actually needs, then one Options
 * button for everything else, and exactly one notice saying what the operation
 * will and will not do.
 *
 * Nothing about detection, verdicts, routing or the output contract changes.
 * `execute.ts` is not forked — `parameterLayout.ts` answers its reads from
 * wherever this layout stored them — so the same input produces the same request
 * and the same output on version 2 and version 3, which `test/v3-layout.test.ts`
 * checks operation by operation.
 *
 * It is a new typeVersion rather than an edit to version 2 because a property's
 * `name` is the storage key in saved workflow JSON. Renaming `action` to
 * `operation`, or folding a top-level field into a collection, orphans the value
 * a published node already saved — and on this node an orphaned value means a
 * security setting silently switching itself off. Versions 1 and 2 keep their
 * panel untouched; only a newly dropped node gets this one.
 */

/** Values whose canvas label, engine line, and enforcement line all come from the layout. */
const OPERATION_LABELS = JSON.stringify(Object.fromEntries(OPERATIONS.map((o) => [o.value, o.name])));
const ENFORCING = JSON.stringify(OPERATIONS.filter((o) => o.fields.includes("onThreat")).map((o) => o.value));
const WITH_SENSITIVITY = JSON.stringify(OPERATIONS.filter((o) => o.fields.includes("sensitivity")).map((o) => o.value));
const ENGINE_LESS = JSON.stringify(OPERATIONS.filter((o) => !o.fields.includes("detectionEngine")).map((o) => o.value));
const WITH_ENGINE = JSON.stringify(
  OPERATIONS.filter((o) => o.fields.includes("detectionEngine") || o.options.includes("detectionEngine")).map((o) => o.value),
);
const WITH_TOPICS = JSON.stringify(OPERATIONS.filter((o) => o.options.includes("allowedTopics")).map((o) => o.value));
const PASSPORT_LIFECYCLE = JSON.stringify(
  ["enrollIdentity", "issuePassport", "validatePassport", "revokePassport"],
);
const WITH_PRESET = JSON.stringify(
  OPERATIONS.filter((o) => o.fields.includes("passportPolicyPreset")).map((o) => o.value),
);

/**
 * Two outputs, decided from the chosen operation.
 *
 * Unchanged from version 2 apart from the parameter name. It is the fix for the
 * node's worst failure mode: a user configures a guard, sees a verdict, and
 * believes they are protected — while nothing downstream reads `blocked`, so
 * every flagged item continues anyway. Naming the branches makes the split part
 * of the node instead of homework.
 *
 * Redact keeps a single output because it never rejects anything; a Flagged
 * branch there would always be empty.
 */
export const soterGuardOutputsV3 = `={{
  ((parameters) => {
    const options = parameters.options || {};
    if (${JSON.stringify(SINGLE_OUTPUT_ACTIONS)}.includes(parameters.operation)) {
      if (options.branchOnRedaction === true) {
        return [
          { displayName: "Clean", type: "${MAIN}" },
          { displayName: "Redacted", type: "${MAIN}" }
        ];
      }
      return [{ displayName: "", type: "${MAIN}" }];
    }
    return [
      { displayName: "Safe", type: "${MAIN}" },
      { displayName: "Flagged", type: "${MAIN}" }
    ];
  })($parameter)
}}` as ExpressionString;

/**
 * Canvas subtitle: the human label, plus anything that weakens the guard.
 *
 * Same format as version 2 — `Guard Input (block)`, with ` · lenient` and
 * ` · local` appended when they apply — so a reviewer can see what a workflow's
 * guards actually do without opening any of them. The labels and the lists are
 * generated from `layoutV3.ts`, so renaming an operation cannot leave a stale
 * name on the canvas.
 *
 * Detection Engine now lives on the main panel, with fallback to options.
 * `($parameter["options"] || {})` rather than optional chaining: this string is
 * evaluated by n8n's expression engine, not by Node.
 */
export const soterGuardSubtitleV3 = `={{
  ((parameters) => {
    const labels = ${OPERATION_LABELS};
    const options = parameters.options || {};
    const operation = parameters.operation;
    const label = labels[operation] || operation;
    let base = ${ENFORCING}.includes(operation)
      ? label + " (" + String(parameters.onThreat || "BLOCK").toLowerCase() + ")"
      : label;
    const sensitivity = String(parameters.sensitivity || "BALANCED");
    if (${WITH_SENSITIVITY}.includes(operation) && sensitivity !== "BALANCED") {
      base = base + " · " + sensitivity.toLowerCase();
    }
    if (${ENGINE_LESS}.includes(operation)) return base;
    const engine = String(parameters.detectionEngine || options.detectionEngine || "AUTO");
    if (engine === "LOCAL" && ${PASSPORT_LIFECYCLE}.includes(operation)) base = base + " · local simulation";
    else if (engine !== "AUTO") base = base + " · " + engine.toLowerCase();
    if (operation === "piiRedactor" && options.branchOnRedaction === true) {
      base = base + " · branching";
    }
    return base;
  })($parameter)
}}` as ExpressionString;

/**
 * The version-2 hints, re-expressed against `operation` and the Options
 * collection, plus one the new panel makes possible.
 *
 * A hint that reads a parameter which moved is worse than no hint: it silently
 * stops firing, and the conditions here guard the states where someone believes
 * they are protected and is not. So each one names where the setting now lives.
 */
export const soterGuardHintsV3: NodeHint[] = [
  {
    // The one mistake that leaves a user unprotected while they believe the
    // opposite: enforcement configured, Flagged output left dangling.
    message:
      "Items routed to Flagged do not appear on Safe. Connect Flagged to an alert or review step to handle them.",
    type: "info",
    location: "outputPane",
    displayCondition: `={{ !${JSON.stringify(SINGLE_OUTPUT_ACTIONS)}.includes($parameter["operation"]) }}`,
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "Token inputs are masked. Issue Passport returns a live token for the next step; use expressions and control access to saved execution data.",
    type: "info",
    location: "ndv",
    displayCondition: '={{ ["issuePassport", "validatePassport", "toolCall"].includes($parameter["operation"]) }}',
  },
  {
    message:
      "<b>Continue</b> allows detected threats to proceed. Use Block or Redact for enforcement. Firewall approval and unavailable-layer decisions can still go to Flagged.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${ENFORCING}.includes($parameter["operation"]) && $parameter["onThreat"] === "CONTINUE" }}`,
  },
  {
    message:
      "For cloud checks across conversation turns, add a stable <b>Session ID</b> under Options or pass sessionId in the incoming item.",
    type: "info",
    location: "ndv",
    displayCondition: '={{ ["inputGuard", "universalGuard"].includes($parameter["operation"]) && ($parameter["detectionEngine"] || ($parameter["options"] || {}).detectionEngine || "AUTO") !== "LOCAL" && !($parameter["options"] || {}).sessionId }}',
  },
  {
    // The complaint this node was fixed for: a helpdesk blocking its own
    // customers, with topics filled in and nothing to make them count. Shown
    // only when the author has actually named topics, so it is advice and not
    // nagging.
    message:
      "<b>Advisory</b> reports topic scope without changing the verdict. Choose Trust My Topics to reduce topic-related false positives.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${WITH_TOPICS}.includes($parameter["operation"]) && !!(($parameter["options"] || {}).allowedTopics || ($parameter["options"] || {}).systemPromptContext) && ($parameter["options"] || {}).topicHandling === "ADVISORY" }}`,
  },
  {
    // Always Allow is the one control here that can genuinely reduce coverage,
    // so it says so in the node rather than only in the README.
    message:
      "<b>Always Allow</b> bypasses input detection for exact whole-message matches. Universal Firewall still checks its configured output, RAG, tool, and memory layers.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${WITH_TOPICS}.includes($parameter["operation"]) && !!($parameter["options"] || {})["alwaysAllow"] }}`,
  },
  {
    message:
      "<b>Lenient</b> reports borderline findings with fewer stops. Clear attacks remain enforced; Output Guard redacts detected secrets and continues with cleaned text.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${WITH_SENSITIVITY}.includes($parameter["operation"]) && $parameter["sensitivity"] === "LENIENT" }}`,
  },
  {
    // The one local-mode gap a user cannot see from the output alone: the egress
    // layer stays unavailable rather than reporting a clean comparison it never
    // made, and without this they would read the missing layer as a pass.
    message:
      "Local mode can only compare the output against <b>Protected Sources</b> whose text is supplied inline, because resolving a bare source ID needs the cloud fingerprint store. Sources given by ID alone are reported as unresolved, never as clean.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ((p) => {
      if (p.operation !== "universalGuard" || (p.detectionEngine || (p.options || {}).detectionEngine || "AUTO") !== "LOCAL") return false;
      const value = ((p.securityContext || {}).output || {}).protectedSources;
      try {
        const sources = typeof value === "string" ? JSON.parse(value) : value;
        return Array.isArray(sources) && sources.length > 0;
      } catch { return false; }
    })($parameter) }}`,
  },
  {
    // Cross-turn detection, reputation, and the ML tier are all server-side, so
    // a fully local guard is meaningfully weaker. Said once, on the canvas, where
    // someone reviewing the workflow rather than editing the node will see it.
    message:
      "<b>Local rules</b> provide reduced detection coverage, without cloud ML, cross-turn tracking, or reputation checks. Use a credential with Auto or Cloud Only for cloud protection.",
    type: "warning",
    location: "outputPane",
    // Only the operations that offer Detection Engine can raise this. On the
    // lifecycle operations the setting does not exist, and a stale LOCAL value
    // there would collide with the "never falls back to Local" hint below.
    displayCondition: `={{ ${WITH_ENGINE}.includes($parameter["operation"]) && !${PASSPORT_LIFECYCLE}.includes($parameter["operation"]) && ($parameter["detectionEngine"] || ($parameter["options"] || {}).detectionEngine || "AUTO") === "LOCAL" }}`,
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "<b>Local simulation:</b> passports use temporary state inside this n8n process and are marked emulated. Use Cloud Only or Auto with a credential for production authorization; these modes never fall back to simulation.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${PASSPORT_LIFECYCLE}.includes($parameter["operation"]) && ($parameter["detectionEngine"] || ($parameter["options"] || {}).detectionEngine || "AUTO") === "LOCAL" }}`,
  },
  {
    message:
      "Redaction branching is active. Clean items leave through <b>Clean</b> (output 1) and items with redacted PII/secrets leave through <b>Redacted</b> (output 2).",
    type: "info",
    location: "outputPane",
    displayCondition: '={{ $parameter["operation"] === "piiRedactor" && ($parameter["options"] || {}).branchOnRedaction === true }}',
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "<b>Also Enforce On Sensitive Data</b> is off. Sensitive-only findings are cleaned and allowed to continue by default. Enable it under Options to apply On Threat to these findings too.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${ENFORCING}.includes($parameter["operation"]) && $parameter["onThreat"] === "BLOCK" && !($parameter["options"] || {})["enforceOnSensitiveData"] }}`,
  },
  {
    // Empty objects and unknown keys do not configure any of the policy lists.
    // The warning must also work for JSON expressions returning objects.
    message:
      "<b>Custom JSON Only</b> starts with empty policy lists. Define tool access and scopes in <b>Policy Overrides (JSON)</b> under Options before issuing a production passport.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ((p) => {
      if (!${WITH_PRESET}.includes(p.operation) || p.passportPolicyPreset !== "CUSTOM") return false;
      const value = (p.options || {}).passportPolicy;
      if (!value) return true;
      try {
        const policy = typeof value === "string" ? JSON.parse(value) : value;
        const keys = ["allowedTools", "blockedTools", "approvalRequiredTools", "allowedDomains", "blockedDomains", "dataScopes", "memoryScopes"];
        return !policy || !keys.some((key) => Array.isArray(policy[key]) && policy[key].length > 0);
      } catch { return true; }
    })($parameter) }}`,
  },
];

export class SoterGuardV3 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: 3,
      subtitle: soterGuardSubtitleV3,
      defaults: {
        name: "SoterAI",
      },
      usableAsTool: true,
      inputs: [NodeConnectionTypes.Main],
      outputs: soterGuardOutputsV3,
      credentials: [
        {
          // Not required: Local mode and the workflow audit run entirely inside
          // n8n, and a security node that cannot be tried without signing up is
          // a security node that does not get tried. Cloud and Auto still fail
          // with a specific, actionable error when no credential is selected.
          name: "soterApi",
          required: false,
          displayOptions: { hide: { operation: ["workflowAudit"], detectionEngine: ["LOCAL"] } },
        },
      ],
      hints: soterGuardHintsV3,
      properties: soterGuardPropertiesV3,
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // The panel differs; the engine does not. The wrapper answers the names
    // `execute.ts` asks for from wherever version 3 put them.
    return executeSoterGuard.call(withV3ParameterLayout(this));
  }
}
