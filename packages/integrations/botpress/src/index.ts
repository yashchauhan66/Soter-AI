/**
 * Botpress Integration: Soter Guard
 *
 * Adds "Soter Input Guard" and "Soter Output Guard" actions to Botpress.
 * These call the Soter REST API to scan messages for threats.
 *
 * Installation:
 * 1. In Botpress Studio, go to Integrations > Add Integration
 * 2. Point to this package or upload the built bundle
 * 3. Configure your Soter API key in the integration settings
 */

export const integration = {
  name: "soter-guard",
  version: "1.0.0",
  title: "Soter Guard",
  description: "AI security guard — protect your chatbot from prompt injection, jailbreaks, and unsafe content",
  icon: "shield",

  configuration: {
    schema: {
      type: "object" as const,
      properties: {
        apiKey: { type: "string", title: "Soter API Key", "x-secret": true },
        baseUrl: { type: "string", title: "Base URL", default: "https://api.cybersecurityguard.com" },
        projectId: { type: "string", title: "Project ID" },
        policyMode: { type: "string", title: "Policy Mode", enum: ["MONITOR", "BALANCED", "STRICT"], default: "BALANCED" },
      },
      required: ["apiKey"],
    },
  },

  actions: {
    checkInput: {
      title: "Check Input",
      description: "Check user message for prompt injection, jailbreaks, PII, and threats",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "Input Text" },
            onThreat: { type: "string", title: "On Threat", enum: ["BLOCK", "REDACT", "WARN", "CONTINUE"], default: "BLOCK" },
          },
          required: ["text"],
        },
      },
      output: {
        schema: {
          type: "object" as const,
          properties: {
            allowed: { type: "boolean" },
            blocked: { type: "boolean" },
            riskScore: { type: "number" },
            safeText: { type: "string" },
            reason: { type: "string" },
            categories: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    checkOutput: {
      title: "Check Output",
      description: "Check AI response for unsafe content before sending to user",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "AI Output Text" },
            onThreat: { type: "string", title: "On Threat", enum: ["BLOCK", "REDACT", "WARN", "CONTINUE"], default: "BLOCK" },
          },
          required: ["text"],
        },
      },
      output: {
        schema: {
          type: "object" as const,
          properties: {
            allowed: { type: "boolean" },
            blocked: { type: "boolean" },
            riskScore: { type: "number" },
            safeText: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  },
};

export async function handler(props: {
  ctx: { configuration: { apiKey: string; baseUrl?: string; projectId?: string; policyMode?: string } };
  action: string;
  input: Record<string, unknown>;
}) {
  const { apiKey, baseUrl = "https://api.cybersecurityguard.com", projectId, policyMode = "BALANCED" } = props.ctx.configuration;

  if (props.action === "checkInput") {
    return callGuard(apiKey, baseUrl, "/api/guard/input", {
      message: props.input.text as string,
      metadata: { projectId, policyMode },
    }, props.input.onThreat as string || "BLOCK", props.input.text as string);
  }

  if (props.action === "checkOutput") {
    return callGuard(apiKey, baseUrl, "/api/guard/output", {
      aiResponse: props.input.text as string,
      metadata: { projectId, policyMode },
    }, props.input.onThreat as string || "BLOCK", props.input.text as string);
  }

  return { error: "Unknown action" };
}

async function callGuard(
  apiKey: string,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  onThreat: string,
  originalText: string,
) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "User-Agent": "soter-botpress/1.0" },
    body: JSON.stringify(body),
  });

  const raw = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof raw.message === "string" ? raw.message : `Soter API error ${res.status}`);

  const allowed = raw.allowed as boolean;
  const safeText = (raw.safeText as string) ?? (raw.redactedText as string) ?? originalText;
  let blocked = false;
  let outputText = safeText;

  if (!allowed) {
    if (onThreat === "BLOCK") { blocked = true; outputText = ""; }
    else if (onThreat === "CONTINUE") { outputText = originalText; }
  }

  return { allowed, blocked, riskScore: raw.riskScore, safeText: outputText, reason: raw.reason, categories: raw.riskTypes ?? [] };
}
