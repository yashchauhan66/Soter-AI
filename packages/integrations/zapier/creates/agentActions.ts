/**
 * Zapier creates for the Agent Firewall: session lifecycle, tool-call approval,
 * data access, and output egress.
 *
 * These are the OWASP LLM06 (Excessive Agency) surface. A Zap that lets an AI
 * step trigger a real action — send the email, write the row, call the API —
 * is exactly the pattern these guard, and until now it existed on n8n and Make
 * but not here.
 */

import {
  resolveProjectId,
  soterPost,
  type ZapierBundle,
  type ZapierZ,
} from "./shared";

/** Every agent endpoint returns this shape; declared once. */
const AGENT_DECISION_OUTPUT_FIELDS = [
  { key: "decision", label: "Decision", type: "string" as const },
  { key: "allowed", label: "Allowed", type: "boolean" as const },
  { key: "riskLevel", label: "Risk Level", type: "string" as const },
  { key: "reason", label: "Reason", type: "string" as const },
  { key: "safeContent", label: "Safe Content", type: "string" as const },
  { key: "auditId", label: "Audit ID", type: "string" as const },
  { key: "sessionId", label: "Session ID", type: "string" as const },
];

const DESTINATION_CHOICES = {
  external: "External",
  internal: "Internal",
  local: "Local",
  unknown: "Unknown",
};

/**
 * Normalizes an agent-endpoint response.
 *
 * `allowed` is derived rather than read: the agent endpoints return a decision
 * string, and a Zap author needs a boolean to put in a filter step. Deriving it
 * here means ASK_APPROVAL cannot be silently read as permission — an action
 * awaiting a human is not an allowed action.
 */
function agentDecisionResult(raw: Record<string, unknown>, fallbackSessionId?: string) {
  const decision = (raw.decision as string) ?? "ALLOW";
  return {
    decision,
    allowed: decision === "ALLOW" || decision === "REDACT",
    riskLevel: (raw.riskLevel as string) ?? "LOW",
    reason: (raw.reason as string) ?? "",
    safeContent: (raw.safeContent as string) ?? (raw.contentRedacted as string) ?? null,
    auditId: (raw.auditId as string) ?? null,
    sessionId: (raw.sessionId as string) ?? fallbackSessionId ?? null,
  };
}

export const startAgentSession = {
  key: "start_agent_session",
  noun: "Agent Session",
  display: {
    label: "Start Agent Session",
    description:
      "Start a SoterAI Agent Firewall session. Pass the returned Session ID to the agent check actions so they share one policy context and one audit trail.",
  },
  operation: {
    inputFields: [
      { key: "agentName", label: "Agent Name", type: "string" as const, required: true },
      {
        key: "agentType",
        label: "Agent Type",
        type: "string" as const,
        required: true,
        choices: {
          CHATBOT: "Chatbot",
          CODING_AGENT: "Coding Agent",
          BROWSER_AGENT: "Browser Agent",
          DATA_AGENT: "Data Agent",
          EMAIL_AGENT: "Email Agent",
          CUSTOM: "Custom",
        },
        default: "CHATBOT",
      },
      { key: "userId", label: "End User ID", type: "string" as const, required: false },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
    ],
    sample: {
      sessionId: "sess_01H8XK2P",
      status: "ACTIVE",
      projectId: "proj_123",
      agentName: "support-agent",
      agentType: "CHATBOT",
    },
    outputFields: [
      { key: "sessionId", label: "Session ID", type: "string" as const },
      { key: "status", label: "Status", type: "string" as const },
      { key: "projectId", label: "Project ID", type: "string" as const },
      { key: "agentName", label: "Agent Name", type: "string" as const },
      { key: "agentType", label: "Agent Type", type: "string" as const },
    ],
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const raw = await soterPost(z, bundle, "/api/agent/session/start", {
        agentName: bundle.inputData.agentName,
        agentType: bundle.inputData.agentType || "CHATBOT",
        userId: bundle.inputData.userId || undefined,
        projectId: resolveProjectId(bundle),
      });
      return {
        sessionId: raw.sessionId ?? null,
        status: raw.status ?? null,
        projectId: raw.projectId ?? null,
        agentName: raw.agentName ?? bundle.inputData.agentName,
        agentType: raw.agentType ?? bundle.inputData.agentType,
      };
    },
  },
};

export const agentActionCheck = {
  key: "agent_action_check",
  noun: "Agent Action",
  display: {
    label: "Check Agent Action",
    description:
      "Ask the Agent Firewall whether an AI-initiated action — a tool call, API request, or file write — is allowed in this context. Put this before any Zap step that acts on the world.",
  },
  operation: {
    inputFields: [
      { key: "tool", label: "Tool Name", type: "string" as const, required: true, helpText: "For example: email.send, db.query, http.request" },
      { key: "action", label: "Action", type: "string" as const, required: true, helpText: "For example: send_message, delete_row, post" },
      { key: "target", label: "Target", type: "string" as const, required: false, helpText: "What the action operates on — a recipient, table, or URL." },
      { key: "content", label: "Content", type: "text" as const, required: false },
      {
        key: "destination",
        label: "Destination",
        type: "string" as const,
        required: false,
        choices: DESTINATION_CHOICES,
        default: "unknown",
      },
      { key: "sessionId", label: "Session ID", type: "string" as const, required: false, helpText: "From Start Agent Session. Omitting it still works, but the action is audited on its own rather than as part of a chain." },
      { key: "agentName", label: "Agent Name", type: "string" as const, required: false },
      { key: "passportToken", label: "Passport Token", type: "string" as const, required: false },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
    ],
    sample: {
      decision: "ALLOW",
      allowed: true,
      riskLevel: "LOW",
      reason: "Action permitted by policy.",
      safeContent: null,
      auditId: "aud_01H8XK",
      sessionId: "sess_01H8XK2P",
    },
    outputFields: AGENT_DECISION_OUTPUT_FIELDS,
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const projectId = resolveProjectId(bundle);
      const raw = await soterPost(z, bundle, "/api/agent/action/check", {
        sessionId: bundle.inputData.sessionId || undefined,
        tool: bundle.inputData.tool,
        action: bundle.inputData.action,
        target: bundle.inputData.target || undefined,
        content: bundle.inputData.content || undefined,
        destination: bundle.inputData.destination || "unknown",
        agentName: bundle.inputData.agentName || undefined,
        passportToken: bundle.inputData.passportToken || undefined,
        metadata: projectId ? { projectId } : undefined,
      });
      return agentDecisionResult(raw, bundle.inputData.sessionId);
    },
  },
};

export const agentDataCheck = {
  key: "agent_data_check",
  noun: "Agent Data Access",
  display: {
    label: "Check Agent Data Access",
    description:
      "Check whether data an agent is reading — RAG context, a file, the clipboard — is safe to use, and detect exfiltration when it is headed somewhere external.",
  },
  operation: {
    inputFields: [
      { key: "content", label: "Content", type: "text" as const, required: true },
      { key: "sessionId", label: "Session ID", type: "string" as const, required: false },
      {
        key: "source",
        label: "Data Source",
        type: "string" as const,
        required: false,
        choices: {
          rag_context: "RAG Context",
          browser: "Browser",
          file: "File",
          email: "Email",
          clipboard: "Clipboard",
          terminal: "Terminal",
          memory: "Memory",
          custom: "Custom",
        },
        default: "custom",
        helpText:
          "Be accurate here. Content marked as retrieved or third-party is treated as data, so an instruction embedded in it is flagged as indirect injection instead of being followed.",
      },
      {
        key: "destination",
        label: "Destination",
        type: "string" as const,
        required: false,
        choices: DESTINATION_CHOICES,
        default: "unknown",
      },
      { key: "target", label: "Target", type: "string" as const, required: false },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
    ],
    sample: {
      decision: "ALLOW",
      allowed: true,
      riskLevel: "LOW",
      reason: "No sensitive data detected.",
      safeContent: null,
      auditId: "aud_01H8XK",
      sessionId: "sess_01H8XK2P",
    },
    outputFields: AGENT_DECISION_OUTPUT_FIELDS,
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const projectId = resolveProjectId(bundle);
      const raw = await soterPost(z, bundle, "/api/agent/data/check", {
        content: bundle.inputData.content,
        sessionId: bundle.inputData.sessionId || undefined,
        source: bundle.inputData.source || "custom",
        destination: bundle.inputData.destination || "unknown",
        target: bundle.inputData.target || undefined,
        metadata: projectId ? { projectId } : undefined,
      });
      return agentDecisionResult(raw, bundle.inputData.sessionId);
    },
  },
};

export const agentOutputCheck = {
  key: "agent_output_check",
  noun: "Agent Output",
  display: {
    label: "Check Agent Output",
    description:
      "Check agent output for sensitive data leakage before it is delivered. Put this immediately before the Zap step that sends, posts, or writes the result.",
  },
  operation: {
    inputFields: [
      { key: "content", label: "Content", type: "text" as const, required: true },
      { key: "sessionId", label: "Session ID", type: "string" as const, required: false },
      {
        key: "destination",
        label: "Destination",
        type: "string" as const,
        required: false,
        choices: DESTINATION_CHOICES,
        default: "unknown",
        helpText: "External destinations are held to a stricter standard than internal ones.",
      },
      { key: "project", label: "Project ID", type: "string" as const, required: false },
    ],
    sample: {
      decision: "ALLOW",
      allowed: true,
      riskLevel: "LOW",
      reason: "No sensitive data detected.",
      safeContent: null,
      auditId: "aud_01H8XK",
      sessionId: "sess_01H8XK2P",
    },
    outputFields: AGENT_DECISION_OUTPUT_FIELDS,
    perform: async (z: ZapierZ, bundle: ZapierBundle) => {
      const projectId = resolveProjectId(bundle);
      const raw = await soterPost(z, bundle, "/api/agent/output/check", {
        content: bundle.inputData.content,
        sessionId: bundle.inputData.sessionId || undefined,
        destination: bundle.inputData.destination || "unknown",
        metadata: projectId ? { projectId } : undefined,
      });
      return agentDecisionResult(raw, bundle.inputData.sessionId);
    },
  },
};
