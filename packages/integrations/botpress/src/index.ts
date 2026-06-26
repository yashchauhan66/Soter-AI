/**
 * Botpress Integration: SoterAI
 *
 * Adds "Check Input", "Check Output", "Redact PII", and "Scan RAG Document"
 * actions to Botpress. These call the SoterAI REST API to scan messages,
 * redact sensitive data, and validate RAG documents for threats.
 *
 * Installation:
 * 1. In Botpress Studio, go to Integrations > Add Integration
 * 2. Point to this package or upload the built bundle
 * 3. Configure your SoterAI API key in the integration settings
 */

export const integration = {
  name: "soterai",
  version: "0.1.0",
  title: "SoterAI",
  description:
    "SoterAI protects chatbots from prompt injection, jailbreaks, PII leakage, and unsafe content",
  icon: "icon.png",

  configuration: {
    schema: {
      type: "object" as const,
      properties: {
        apiKey: { type: "string", title: "SoterAI API Key", "x-secret": true },
        baseUrl: {
          type: "string",
          title: "Base URL",
          default: "https://api.cybersecurityguard.com",
        },
        projectId: { type: "string", title: "Project ID" },
        policyMode: {
          type: "string",
          title: "Policy Mode",
          enum: ["MONITOR", "BALANCED", "STRICT"],
          default: "BALANCED",
        },
      },
      required: ["apiKey"],
    },
  },

  actions: {
    checkInput: {
      title: "Check Input",
      description:
        "Check user message for prompt injection, jailbreaks, PII, and threats",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "Input Text" },
            onThreat: {
              type: "string",
              title: "On Threat",
              enum: ["BLOCK", "REDACT", "WARN", "CONTINUE"],
              default: "BLOCK",
            },
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
      description:
        "Check AI response for unsafe content before sending to user",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "AI Output Text" },
            onThreat: {
              type: "string",
              title: "On Threat",
              enum: ["BLOCK", "REDACT", "WARN", "CONTINUE"],
              default: "BLOCK",
            },
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

    redactPii: {
      title: "Redact PII",
      description:
        "Redact personally identifiable information and secrets from text",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "Text" },
            redactionMode: {
              type: "string",
              title: "Redaction Mode",
              enum: ["PARTIAL", "FULL", "HASH"],
              default: "PARTIAL",
            },
          },
          required: ["text"],
        },
      },
      output: {
        schema: {
          type: "object" as const,
          properties: {
            safeText: { type: "string" },
            detectedEntities: { type: "array", items: { type: "string" } },
            riskScore: { type: "number" },
          },
        },
      },
    },

    scanRagDocument: {
      title: "Scan RAG Document",
      description:
        "Scan documents for threats before adding to vector databases",
      input: {
        schema: {
          type: "object" as const,
          properties: {
            text: { type: "string", title: "Document Text" },
            sourceName: { type: "string", title: "Source Name" },
          },
          required: ["text"],
        },
      },
      output: {
        schema: {
          type: "object" as const,
          properties: {
            allowed: { type: "boolean" },
            riskScore: { type: "number" },
            issues: { type: "array", items: { type: "string" } },
            safeText: { type: "string" },
          },
        },
      },
    },
  },
};

export async function handler(props: {
  ctx: {
    configuration: {
      apiKey: string;
      baseUrl?: string;
      projectId?: string;
      policyMode?: string;
    };
  };
  action: string;
  input: Record<string, unknown>;
}) {
  const {
    apiKey,
    baseUrl = "https://api.cybersecurityguard.com",
    projectId,
    policyMode = "BALANCED",
  } = props.ctx.configuration;

  if (props.action === "checkInput") {
    return callGuard(
      apiKey,
      baseUrl,
      "/api/guard/input",
      {
        message: props.input.text as string,
        metadata: { projectId, policyMode },
      },
      props.input.onThreat as string || "BLOCK",
      props.input.text as string,
    );
  }

  if (props.action === "checkOutput") {
    return callGuard(
      apiKey,
      baseUrl,
      "/api/guard/output",
      {
        aiResponse: props.input.text as string,
        metadata: { projectId, policyMode },
      },
      props.input.onThreat as string || "BLOCK",
      props.input.text as string,
    );
  }

  if (props.action === "redactPii") {
    const redactionMode =
      (props.input.redactionMode as string) || "PARTIAL";
    return callRedactPii(
      apiKey,
      baseUrl,
      props.input.text as string,
      redactionMode,
      projectId,
      policyMode,
    );
  }

  if (props.action === "scanRagDocument") {
    const sourceName = (props.input.sourceName as string) || "unknown";
    return callScanRagDocument(
      apiKey,
      baseUrl,
      props.input.text as string,
      sourceName,
      projectId,
      policyMode,
    );
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
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "soterai-botpress/1.0",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      typeof raw.message === "string"
        ? raw.message
        : `SoterAI API error ${res.status}`,
    );

  const allowed = raw.allowed as boolean;
  const safeText =
    (raw.safeText as string) ?? (raw.redactedText as string) ?? originalText;
  let blocked = false;
  let outputText = safeText;

  if (!allowed) {
    if (onThreat === "BLOCK") {
      blocked = true;
      outputText = "";
    } else if (onThreat === "CONTINUE") {
      outputText = originalText;
    }
  }

  return {
    allowed,
    blocked,
    riskScore: raw.riskScore,
    safeText: outputText,
    reason: raw.reason,
    categories: raw.riskTypes ?? [],
  };
}

async function callRedactPii(
  apiKey: string,
  baseUrl: string,
  text: string,
  redactionMode: string,
  projectId?: string,
  policyMode?: string,
) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/guard/input`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "soterai-botpress/1.0",
    },
    body: JSON.stringify({
      message: text,
      metadata: { projectId, policyMode, _redactionMode: redactionMode },
    }),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      typeof raw.message === "string"
        ? raw.message
        : `SoterAI API error ${res.status}`,
    );

  return {
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? text,
    detectedEntities: (raw.detectedEntities as string[]) ?? [],
    riskScore: (raw.riskScore as number) ?? 0,
  };
}

async function callScanRagDocument(
  apiKey: string,
  baseUrl: string,
  text: string,
  sourceName: string,
  projectId?: string,
  policyMode?: string,
) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/guard/input`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "User-Agent": "soterai-botpress/1.0",
    },
    body: JSON.stringify({
      message: text,
      metadata: {
        projectId,
        policyMode,
        _ragScan: true,
        _sourceName: sourceName,
      },
    }),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok)
    throw new Error(
      typeof raw.message === "string"
        ? raw.message
        : `SoterAI API error ${res.status}`,
    );

  return {
    allowed: (raw.allowed as boolean) ?? true,
    riskScore: (raw.riskScore as number) ?? 0,
    issues: (raw.issues as string[]) ?? (raw.riskTypes as string[]) ?? [],
    safeText: (raw.safeText as string) ?? (raw.redactedText as string) ?? text,
  };
}
