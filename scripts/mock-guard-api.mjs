import { createServer } from "node:http";

const port = Number(process.env.MOCK_GUARD_PORT || 3999);

function guardResult({ allowed, action, text, reason = "mock guard decision" }) {
  return {
    allowed,
    action,
    riskScore: allowed ? 0 : 90,
    riskTypes: allowed ? ["LOW_RISK"] : ["PROMPT_INJECTION"],
    reason,
    safeText: allowed ? text : undefined,
    findings: [],
  };
}

function isRisky(text = "") {
  return /ignore previous instructions|reveal your system prompt|hidden prompt/i.test(text);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, { status: "ok", mock: true });
    }
    if (req.method !== "POST") return send(res, 404, { error: true, message: "Not found." });
    const body = await readJson(req);
    if (req.url === "/api/guard/analyze") {
      const text = String(body.text || "");
      return send(res, 200, isRisky(text)
        ? guardResult({ allowed: false, action: "BLOCK", text, reason: "mock risky analysis" })
        : guardResult({ allowed: true, action: "ALLOW", text }));
    }
    if (!req.headers["x-api-key"]) return send(res, 401, { error: true, message: "Missing x-api-key header." });
    if (req.url === "/api/guard/input") {
      const message = String(body.message || "");
      return send(res, 200, isRisky(message)
        ? guardResult({ allowed: false, action: "BLOCK", text: message, reason: "mock input blocked" })
        : guardResult({ allowed: true, action: "ALLOW", text: message }));
    }
    if (req.url === "/api/guard/output") {
      const output = String(body.aiResponse || "");
      return send(res, 200, isRisky(output)
        ? guardResult({ allowed: false, action: "BLOCK", text: output, reason: "mock output blocked" })
        : guardResult({ allowed: true, action: "ALLOW", text: output }));
    }
    return send(res, 404, { error: true, message: "Not found." });
  } catch (error) {
    return send(res, 500, { error: true, message: error instanceof Error ? error.message : "mock error" });
  }
});

server.listen(port, () => {
  console.log(`mock guard api listening on http://127.0.0.1:${port}`);
});
