const http = require("http");

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

function classifyInput(message) {
  const text = String(message || "");
  if (!text.trim()) {
    return {
      allowed: false,
      riskScore: 0.4,
      riskTypes: ["VALIDATION_ERROR"],
      reason: "Input Text is required.",
      findings: [{ type: "VALIDATION_ERROR", label: "EMPTY_INPUT", severity: "medium" }],
      safeText: "",
    };
  }

  const lower = text.toLowerCase();
  if (lower.includes("ignore all previous instructions") || lower.includes("system prompt")) {
    return {
      allowed: false,
      riskScore: 0.92,
      riskTypes: ["PROMPT_INJECTION", "SYSTEM_PROMPT_LEAK_ATTEMPT"],
      reason: "Input attempts to bypass instructions and extract hidden system information.",
      findings: [
        { type: "PROMPT_INJECTION", label: "Instruction override", severity: "high" },
        { type: "SYSTEM_PROMPT_LEAK_ATTEMPT", label: "System prompt request", severity: "high" },
      ],
      safeText: "",
      incidentId: "demo-prompt-injection",
    };
  }

  const findings = [];
  let safeText = text;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
    findings.push({ type: "PII_DETECTED", label: "EMAIL", severity: "medium" });
    safeText = safeText.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
  }
  if (/\bsk-[a-z0-9-]{8,}\b/i.test(text)) {
    findings.push({ type: "SECRET_DETECTED", label: "API_KEY", severity: "high" });
    safeText = safeText.replace(/\bsk-[a-z0-9-]{8,}\b/gi, "[REDACTED_SECRET]");
  }

  if (findings.length) {
    return {
      allowed: false,
      riskScore: 0.74,
      riskTypes: findings.map((finding) => finding.type),
      reason: "Sensitive data was detected and redacted.",
      findings,
      safeText,
      redactedText: safeText,
      incidentId: "demo-sensitive-data",
    };
  }

  return {
    allowed: true,
    riskScore: 0.08,
    riskTypes: [],
    reason: "Input Guard passed. No high-risk pattern detected.",
    findings: [],
    safeText: text,
  };
}

function classifyOutput(aiResponse) {
  const text = String(aiResponse || "");
  if (/\bsk-[a-z0-9-]{8,}\b/i.test(text)) {
    return {
      allowed: false,
      riskScore: 0.91,
      riskTypes: ["SECRET_DISCLOSURE"],
      reason: "Output Guard detected a private-token-like value in the generated response.",
      findings: [{ type: "SECRET_DISCLOSURE", label: "API_KEY", severity: "high" }],
      safeText: text.replace(/\bsk-[a-z0-9-]{8,}\b/gi, "[REDACTED_SECRET]"),
      redactedText: text.replace(/\bsk-[a-z0-9-]{8,}\b/gi, "[REDACTED_SECRET]"),
      incidentId: "demo-output-secret",
    };
  }
  return {
    allowed: true,
    riskScore: 0.06,
    riskTypes: [],
    reason: "Output Guard passed. No unsafe output detected.",
    findings: [],
    safeText: text,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 200, { ok: true });
    if (req.method !== "POST") return send(res, 405, { message: "Method not allowed" });

    const body = await readBody(req);

    if (req.url === "/api/guard/input") {
      return send(res, 200, classifyInput(body.message));
    }

    if (req.url === "/api/guard/output") {
      return send(res, 200, classifyOutput(body.aiResponse));
    }

    if (req.url === "/api/rag/document/trust-score") {
      return send(res, 200, {
        trustScore: 82,
        trustLevel: "TRUSTED",
        findings: [],
        recommendedAction: "ALLOW",
      });
    }

    return send(res, 404, { message: "Not found" });
  } catch (error) {
    return send(res, 400, {
      message: error instanceof Error ? error.message : "Request failed",
    });
  }
});

const port = Number(process.env.PORT || 3333);
server.listen(port, "0.0.0.0", () => {
  console.log(`SoterAI local demo API listening on http://0.0.0.0:${port}`);
});
