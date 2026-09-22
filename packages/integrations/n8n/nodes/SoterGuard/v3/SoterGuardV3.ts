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
const ENFORCING = JSON.stringify(OPERATIONS.filter((o) => o.notice === "enforcingNotice").map((o) => o.value));
const WITH_SENSITIVITY = JSON.stringify(OPERATIONS.filter((o) => o.fields.includes("sensitivity")).map((o) => o.value));
/** Operations that offer no Detection Engine, so a stale engine value must not be advertised. */
const ENGINE_LESS = JSON.stringify(
  OPERATIONS.filter((o) => !o.options.includes("detectionEngine")).map((o) => o.value),
);
const WITH_ENGINE = JSON.stringify(OPERATIONS.filter((o) => o.options.includes("detectionEngine")).map((o) => o.value));
const WITH_TOPICS = JSON.stringify(OPERATIONS.filter((o) => o.options.includes("allowedTopics")).map((o) => o.value));
const PASSPORT_LIFECYCLE = JSON.stringify(
  OPERATIONS.filter((o) => o.resource === "agentPassport" && !o.options.includes("detectionEngine")).map((o) => o.value),
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
    if (${JSON.stringify(SINGLE_OUTPUT_ACTIONS)}.includes(parameters.operation)) {
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
 * Detection Engine now lives inside Options, so it is read from that object.
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
    const engine = String(options.detectionEngine || "AUTO");
    return engine === "AUTO" ? base : base + " · " + engine.toLowerCase();
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
      "Flagged items leave through the second output. Connect it to a response or stop step, or leave it unconnected to drop them — but do not connect it back into your main path.",
    type: "info",
    location: "outputPane",
    displayCondition: `={{ !${JSON.stringify(SINGLE_OUTPUT_ACTIONS)}.includes($parameter["operation"]) }}`,
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "Passport token fields are masked in the editor. Keep <b>Include Raw API Response</b> off for lifecycle workflows unless debugging; token-shaped keys in raw responses are redacted.",
    type: "info",
    location: "ndv",
    displayCondition: '={{ ["issuePassport", "validatePassport", "toolCall"].includes($parameter["operation"]) }}',
  },
  {
    message:
      "<b>On Threat</b> is set to Continue, so nothing is ever stopped and the <b>Flagged</b> output stays empty. Use Block or Redact for real enforcement.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${ENFORCING}.includes($parameter["operation"]) && $parameter["onThreat"] === "CONTINUE" }}`,
  },
  {
    message:
      "No <b>Session ID</b> set. Each message will be judged on its own, so an attack spread across several turns can pass one harmless-looking message at a time. Add one under <b>Options</b>.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${ENFORCING}.includes($parameter["operation"]) && !($parameter["options"] || {})["sessionId"] }}`,
  },
  {
    // The complaint this node was fixed for: a helpdesk blocking its own
    // customers, with topics filled in and nothing to make them count. Shown
    // only when the author has actually named topics, so it is advice and not
    // nagging.
    message:
      "<b>Topic Handling</b> is set to Advisory, so your <b>Allowed Semantic Topics</b> only annotate the result. If ordinary questions about these topics are being blocked, switch it to <b>Trust My Topics</b> under <b>Options</b>.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${WITH_TOPICS}.includes($parameter["operation"]) && !!($parameter["options"] || {})["allowedTopics"] && ($parameter["options"] || {})["topicHandling"] === "ADVISORY" }}`,
  },
  {
    // Always Allow is the one control here that can genuinely reduce coverage,
    // so it says so in the node rather than only in the README.
    message:
      "<b>Always Allow</b> skips detection completely for messages that match one of your lines exactly. Nothing about them is scanned, and the result is marked <code>bypassed: ALWAYS_ALLOW</code>. Keep the list to the questions you are certain about.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${WITH_TOPICS}.includes($parameter["operation"]) && !!($parameter["options"] || {})["alwaysAllow"] }}`,
  },
  {
    message:
      "<b>Sensitivity</b> is Lenient: borderline findings are reported but not enforced, so expect fewer stops and more items on <b>Safe</b>. Live secrets and clear injection or jailbreak attempts are still stopped at every level.",
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
    displayCondition:
      '={{ $parameter["operation"] === "universalGuard" && ($parameter["options"] || {})["detectionEngine"] === "LOCAL" }}',
  },
  {
    // Cross-turn detection, reputation, and the ML tier are all server-side, so
    // a fully local guard is meaningfully weaker. Said once, on the canvas, where
    // someone reviewing the workflow rather than editing the node will see it.
    message:
      "<b>Reduced protection:</b> Local is a pattern-only first filter (measured prompt-injection recall is about 18% on the published out-of-distribution corpus). It has no ML tier, cross-turn tracking, reputation, or passport enforcement. Use Auto for cloud-first production protection.",
    type: "warning",
    location: "outputPane",
    // Only the operations that offer Detection Engine can raise this. On the
    // lifecycle operations the setting does not exist, and a stale LOCAL value
    // there would collide with the "never falls back to Local" hint below.
    displayCondition: `={{ ${WITH_ENGINE}.includes($parameter["operation"]) && ($parameter["options"] || {})["detectionEngine"] === "LOCAL" }}`,
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "Identity and passport lifecycle operations use server-side state. They require a SoterAI API Key (x-api-key) and never fall back to Local.",
    type: "info",
    location: "ndv",
    displayCondition: `={{ ${PASSPORT_LIFECYCLE}.includes($parameter["operation"]) }}`,
  },
  {
    // New in version 3. Custom JSON Only is the one preset that grants nothing
    // on its own, and the panel now shows the preset while its overrides sit
    // behind Options — so the state where an author has picked Custom and left
    // the policy empty is both easy to reach and invisible.
    message:
      "<b>Custom JSON Only</b> starts from an empty policy, so this agent would be granted nothing. Add <b>Policy Overrides (JSON)</b> under <b>Options</b>.",
    type: "warning",
    location: "ndv",
    displayCondition: `={{ ${WITH_PRESET}.includes($parameter["operation"]) && $parameter["passportPolicyPreset"] === "CUSTOM" && !($parameter["options"] || {})["passportPolicy"] }}`,
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
