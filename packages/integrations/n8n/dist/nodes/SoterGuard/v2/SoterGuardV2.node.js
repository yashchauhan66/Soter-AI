"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoterGuardV2 = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const properties_1 = require("../shared/properties");
const execute_1 = require("../shared/execute");
const MAIN = n8n_workflow_1.NodeConnectionTypes.Main;
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
const soterGuardOutputs = `={{
  ((parameters) => {
    if (${JSON.stringify(execute_1.SINGLE_OUTPUT_ACTIONS)}.includes(parameters.action)) {
      return [{ displayName: "", type: "${MAIN}" }];
    }
    return [
      { displayName: "Safe", type: "${MAIN}" },
      { displayName: "Flagged", type: "${MAIN}" }
    ];
  })($parameter)
}}`;
/**
 * Canvas subtitle. Version 1 printed the raw parameter value, so a node read
 * "inputGuard" on the canvas. Showing the human label plus the enforcement
 * setting means a reviewer can see what a workflow's guards actually do without
 * opening any of them.
 */
const soterGuardSubtitle = `={{
  ((parameters) => {
    const labels = {
      analyzeText: "Analyze Text",
      inputGuard: "Guard Input",
      outputGuard: "Guard Output",
      piiRedactor: "Redact Secrets or PII",
      ragScanner: "RAG Risk Summary",
      universalGuard: "Universal AI Firewall",
      workflowAudit: "Workflow Audit"
    };
    const label = labels[parameters.action] || parameters.action;
    const enforcing = ["inputGuard", "outputGuard", "universalGuard"].includes(parameters.action);
    return enforcing ? label + " (" + String(parameters.onThreat || "BLOCK").toLowerCase() + ")" : label;
  })($parameter)
}}`;
const soterGuardHints = [
    {
        // The one mistake that leaves a user unprotected while they believe the
        // opposite: enforcement configured, Flagged output left dangling.
        message: "Flagged items leave through the second output. Connect it to a response or stop step, or leave it unconnected to drop them — but do not connect it back into your main path.",
        type: "info",
        location: "outputPane",
        displayCondition: '={{ !["piiRedactor"].includes($parameter["action"]) }}',
        whenToDisplay: "beforeExecution",
    },
    {
        message: "<b>On Threat</b> is set to Continue, so nothing is ever stopped and the <b>Flagged</b> output stays empty. Use Block or Redact for real enforcement.",
        type: "warning",
        location: "ndv",
        displayCondition: '={{ ["inputGuard", "outputGuard", "universalGuard"].includes($parameter["action"]) && $parameter["onThreat"] === "CONTINUE" }}',
    },
    {
        message: "No <b>Session ID</b> set. Each message will be judged on its own, so an attack spread across several turns can pass one harmless-looking message at a time.",
        type: "info",
        location: "ndv",
        displayCondition: '={{ ["inputGuard", "outputGuard", "universalGuard"].includes($parameter["action"]) && !$parameter["sessionId"] }}',
    },
];
class SoterGuardV2 {
    constructor(baseDescription) {
        this.description = {
            ...baseDescription,
            version: 2,
            subtitle: soterGuardSubtitle,
            defaults: {
                name: "SoterAI",
            },
            usableAsTool: true,
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: soterGuardOutputs,
            credentials: [
                {
                    name: "soterApi",
                    required: true,
                },
            ],
            hints: soterGuardHints,
            properties: properties_1.soterGuardProperties,
        };
    }
    async execute() {
        return execute_1.executeSoterGuard.call(this);
    }
}
exports.SoterGuardV2 = SoterGuardV2;
