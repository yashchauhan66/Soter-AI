const http = require("http");

const port = 8787;

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function guardResponse(body, mode) {
  const text = String(body.message || body.aiResponse || "");
  const lower = text.toLowerCase();
  const pii = /@|\b\d{3}[- ]?\d{2}[- ]?\d{4}\b|\b\d{10}\b/.test(text);
  const injection = /ignore previous|system prompt|jailbreak|developer message/.test(lower);
  const unsafeOutput = /api key|secret|token|password/.test(lower);
  const blocked = injection || unsafeOutput;
  const safeText = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{10}\b/g, "[REDACTED_PHONE]")
    .replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, "[REDACTED_ID]")
    .replace(/api key [A-Za-z0-9_-]+/gi, "api key [REDACTED]");

  return {
    allowed: !blocked,
    riskScore: blocked ? 0.92 : pii ? 0.66 : 0.08,
    riskTypes: [
      ...(injection ? ["PROMPT_INJECTION"] : []),
      ...(unsafeOutput ? ["SECRET_DISCLOSURE"] : []),
      ...(pii ? ["PII_DETECTED"] : []),
    ],
    safeText,
    redactedText: safeText,
    reason: blocked
      ? `${mode} blocked because the content attempted to bypass AI safety controls.`
      : pii
        ? `${mode} detected sensitive data and returned redacted safe text.`
        : `${mode} passed. No high-risk pattern detected.`,
    incidentId: `demo-${mode.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    findings: pii
      ? [
          { type: "PII_DETECTED", label: "EMAIL_OR_PHONE", severity: "medium" },
        ]
      : [],
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 200, {});
  if (req.method !== "POST") return json(res, 404, { message: "Not found" });

  const body = await readJson(req);

  if (req.url === "/api/guard/input") {
    return json(res, 200, guardResponse(body, "Input Guard"));
  }

  if (req.url === "/api/guard/output") {
    return json(res, 200, guardResponse(body, "Output Guard"));
  }

  if (req.url === "/api/rag/document/trust-score") {
    const content = String(body.content || "");
    const risky = /untrusted|poison|ignore previous|system prompt/i.test(content);
    return json(res, 200, {
      trustScore: risky ? 42 : 91,
      trustLevel: risky ? "NEEDS_REVIEW" : "TRUSTED",
      findings: risky
        ? [
            {
              type: "RAG_POISONING",
              severity: "high",
              message: "Document contains instruction-like content that should not enter retrieval context.",
            },
          ]
        : [],
      recommendedAction: risky ? "QUARANTINE" : "ALLOW",
      documentId: body.documentId,
      source: body.source,
    });
  }

  return json(res, 404, { message: "Unknown SoterAI demo endpoint" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SoterAI demo endpoint listening on http://0.0.0.0:${port}`);
});
