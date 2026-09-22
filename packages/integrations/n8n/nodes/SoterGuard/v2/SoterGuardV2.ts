import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeBaseDescription,
  INodeTypeDescription,
  ExpressionString,
  NodeHint,
} from "n8n-workflow";
import { NodeConnectionTypes } from "n8n-workflow";

import { soterGuardProperties } from "../shared/properties";
import { executeSoterGuard, SINGLE_OUTPUT_ACTIONS } from "../shared/execute";

const MAIN = NodeConnectionTypes.Main;

/**
 * Two outputs, decided from the chosen action.
 *
 * This is the fix for the node's worst failure mode: on version 1 a user could
 * configure a guard, see it return a verdict, and believe they were protected —
 * while nothing downstream ever looked at `blocked`, so every flagged item
 * continued anyway. Named outputs make the branch part of the node instead of
 * homework, the same way n8n's own Guardrails node does it.
 *
 * "Redact Secrets or PII" keeps a single output because it never rejects
 * anything; a Flagged branch there would always be empty.
 *
 * `$parameter` is the only context an outputs expression gets — there is no way
 * to read the node's typeVersion here. That is precisely why v1 is a separate
 * class with a hard-coded single output rather than this expression plus a
 * version check.
 */
export const soterGuardOutputs = `={{
  ((parameters) => {
    if (${JSON.stringify(SINGLE_OUTPUT_ACTIONS)}.includes(parameters.action)) {
      return [{ displayName: "", type: "${MAIN}" }];
    }
    return [
      { displayName: "Safe", type: "${MAIN}" },
      { displayName: "Flagged", type: "${MAIN}" }
    ];
  })($parameter)
}}` as ExpressionString;

/**
 * Canvas subtitle. Version 1 printed the raw parameter value, so a node read
 * "inputGuard" on the canvas. Showing the human label plus the enforcement
 * setting means a reviewer can see what a workflow's guards actually do without
 * opening any of them.
 *
 * The engine is appended whenever it is not the default, because "this guard is
 * running on the weaker local engine" is exactly the kind of fact that should
 * not require opening the node to discover. Sensitivity is appended on the same
 * grounds: a guard someone quietly set to Lenient stops fewer things than the
 * reviewer standing in front of the canvas is assuming.
 */
export const soterGuardSubtitle = `={{
  ((parameters) => {
    const labels = {
      analyzeText: "Analyze Text",
      toolCall: "Check Tool Call",
      enrollIdentity: "Register Agent",
      issuePassport: "Issue Access Pass",
      revokePassport: "Revoke Access",
      inputGuard: "Guard Input",
      outputGuard: "Guard Output",
      piiRedactor: "Redact PII and Secrets",
      ragScanner: "Scan RAG Document",
      universalGuard: "Universal AI Firewall",
      validatePassport: "Validate Access",
      workflowAudit: "Audit Workflow Security"
    };
    const label = labels[parameters.action] || parameters.action;
    const enforcing = ["inputGuard", "outputGuard", "universalGuard"].includes(parameters.action);
    let base = enforcing ? label + " (" + String(parameters.onThreat || "BLOCK").toLowerCase() + ")" : label;
    const sensitivity = String(parameters.sensitivity || "BALANCED");
    if (["inputGuard", "outputGuard"].includes(parameters.action) && sensitivity !== "BALANCED") {
      base = base + " · " + sensitivity.toLowerCase();
    }
    // Detection Engine is hidden for the audit and passport-lifecycle actions
    // (the hide list in properties.ts), which never run on the local engine.
    // Appending "· local"/"· cloud" there advertised a setting the action ignores.
    const engineLess = ["workflowAudit", "enrollIdentity", "issuePassport", "validatePassport", "revokePassport"];
    if (engineLess.includes(parameters.action)) return base;
    const engine = String(parameters.detectionEngine || "AUTO");
    return engine === "AUTO" ? base : base + " · " + engine.toLowerCase();
  })($parameter)
}}` as ExpressionString;

export const soterGuardHints: NodeHint[] = [
  {
    // The one mistake that leaves a user unprotected while they believe the
    // opposite: enforcement configured, Flagged output left dangling.
    message:
      "Flagged items leave through the second output. Connect it to a response or stop step, or leave it unconnected to drop them — but do not connect it back into your main path.",
    type: "info",
    location: "outputPane",
    displayCondition: '={{ !["piiRedactor"].includes($parameter["action"]) }}',
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "Passport token fields are masked in the editor. Keep <b>Include Raw API Response</b> off for lifecycle workflows unless debugging; token-shaped keys in raw responses are redacted.",
    type: "info",
    location: "ndv",
    displayCondition: '={{ ["issuePassport", "validatePassport", "toolCall"].includes($parameter["action"]) }}',
  },
  {
    message:
      "<b>On Threat</b> is set to Continue, so nothing is ever stopped and the <b>Flagged</b> output stays empty. Use Block or Redact for real enforcement.",
    type: "warning",
    location: "ndv",
    displayCondition:
      '={{ ["inputGuard", "outputGuard", "universalGuard"].includes($parameter["action"]) && $parameter["onThreat"] === "CONTINUE" }}',
  },
  {
    message:
      "No <b>Session ID</b> set. Each message will be judged on its own, so an attack spread across several turns can pass one harmless-looking message at a time.",
    type: "info",
    location: "ndv",
    displayCondition:
      '={{ ["inputGuard", "outputGuard", "universalGuard"].includes($parameter["action"]) && !$parameter["sessionId"] }}',
  },
  {
    // The complaint this node was fixed for: a helpdesk blocking its own
    // customers, with topics filled in and nothing to make them count. Shown
    // only when the author has actually named topics, so it is advice and not
    // nagging.
    message:
      "<b>Topic Handling</b> is set to Advisory, so your <b>Allowed Semantic Topics</b> only annotate the result. If ordinary questions about these topics are being blocked, switch it to <b>Trust My Topics</b>.",
    type: "info",
    location: "ndv",
    displayCondition:
      '={{ ["inputGuard", "universalGuard"].includes($parameter["action"]) && !!$parameter["allowedTopics"] && $parameter["topicHandling"] === "ADVISORY" }}',
  },
  {
    // Always Allow is the one control here that can genuinely reduce coverage,
    // so it says so in the node rather than only in the README.
    message:
      "<b>Always Allow</b> skips detection completely for messages that match one of your lines exactly. Nothing about them is scanned, and the result is marked <code>bypassed: ALWAYS_ALLOW</code>. Keep the list to the questions you are certain about.",
    type: "warning",
    location: "ndv",
    displayCondition:
      '={{ ["inputGuard", "universalGuard"].includes($parameter["action"]) && !!$parameter["alwaysAllow"] }}',
  },
  {
    message:
      "<b>Sensitivity</b> is Lenient: borderline findings are reported but not enforced, so expect fewer stops and more items on <b>Safe</b>. Live secrets and clear injection or jailbreak attempts are still stopped at every level.",
    type: "info",
    location: "ndv",
    displayCondition:
      '={{ ["inputGuard", "outputGuard"].includes($parameter["action"]) && $parameter["sensitivity"] === "LENIENT" }}',
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
      '={{ $parameter["action"] === "universalGuard" && $parameter["detectionEngine"] === "LOCAL" }}',
  },
  {
    // Cross-turn detection, reputation, and the ML tier are all server-side, so
    // a fully local guard is meaningfully weaker. Said once, on the canvas, where
    // someone reviewing the workflow rather than editing the node will see it.
    message:
      "<b>Reduced protection:</b> Local is a pattern-only first filter (measured prompt-injection recall is about 18% on the published out-of-distribution corpus). It has no ML tier, cross-turn tracking, reputation, or passport enforcement. Use Auto for cloud-first production protection.",
    type: "warning",
    location: "outputPane",
    // Only the guard/scan actions read Detection Engine. The audit and passport
    // actions hide the field, so a stale LOCAL value there must not raise this —
    // it also collided with the "never fall back to Local" hint on those actions.
    displayCondition:
      '={{ ["analyzeText", "inputGuard", "outputGuard", "piiRedactor", "ragScanner", "universalGuard"].includes($parameter["action"]) && $parameter["detectionEngine"] === "LOCAL" }}',
    whenToDisplay: "beforeExecution",
  },
  {
    message:
      "Identity and passport lifecycle actions use server-side state. They require a SoterAI API Key (x-api-key) and never fall back to Local.",
    type: "info",
    location: "ndv",
    displayCondition: '={{ ["enrollIdentity", "issuePassport", "validatePassport", "revokePassport"].includes($parameter["action"]) }}',
  },
];

export class SoterGuardV2 implements INodeType {
  description: INodeTypeDescription;

  constructor(baseDescription: INodeTypeBaseDescription) {
    this.description = {
      ...baseDescription,
      version: 2,
      subtitle: soterGuardSubtitle,
      defaults: {
        name: "SoterAI",
      },
      usableAsTool: true,
      inputs: [NodeConnectionTypes.Main],
      outputs: soterGuardOutputs,
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
      hints: soterGuardHints,
      properties: soterGuardProperties,
    };
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    return executeSoterGuard.call(this);
  }
}
