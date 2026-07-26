import assert from "node:assert/strict";
import { db } from "../lib/db";
import { generateApiKey } from "../lib/apiKeyCrypto";
import { hashPassportToken } from "../lib/agent-passport";

process.env.API_KEY_PEPPER = process.env.API_KEY_PEPPER ?? "agent-mcp-runtime-smoke-pepper-that-is-long-enough";
process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

type MutableDb = typeof db & {
  apiKey: {
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    update: (...args: unknown[]) => Promise<unknown>;
  };
  securityEvent: { create: (...args: unknown[]) => Promise<unknown> };
  siemIntegration: { findMany: (...args: unknown[]) => Promise<unknown[]> };
  siemDelivery: { createMany: (...args: unknown[]) => Promise<unknown> };
  $queryRaw: (...args: unknown[]) => Promise<unknown[]>;
  $executeRaw: (...args: unknown[]) => Promise<unknown>;
};

const mutableDb = db as MutableDb;
const originals = {
  apiKeyFindMany: mutableDb.apiKey.findMany,
  apiKeyUpdate: mutableDb.apiKey.update,
  queryRaw: mutableDb.$queryRaw,
  executeRaw: mutableDb.$executeRaw,
  securityEventCreate: mutableDb.securityEvent.create,
  siemIntegrationFindMany: mutableDb.siemIntegration.findMany,
  siemDeliveryCreateMany: mutableDb.siemDelivery.createMany,
};

const apiKey = generateApiKey("test");
const passportToken = "ap_agent_mcp_runtime_smoke_token_1234567890";
const projectId = "project_agent_mcp_runtime_smoke";
const organizationId = "org_agent_mcp_runtime_smoke";
const sessionId = "agent_sess_runtime_smoke";
const agentIdentityId = "agent_identity_runtime_smoke";
const passportId = "agent_passport_runtime_smoke";
const executedSql: Array<{ sql: string; values: unknown[] }> = [];

function sqlText(input: unknown): string {
  return Array.isArray(input) ? input.join("?") : String(input);
}

function installDbMocks() {
  mutableDb.apiKey.findMany = async () => [{
    id: "api_key_runtime_smoke",
    prefix: apiKey.prefix,
    keyHash: apiKey.keyHash,
    isActive: true,
    project: {
      id: projectId,
      organizationId,
      disabledAt: null,
      organization: { quotaOverride: null, disabled: false },
      user: { id: "user_runtime_smoke", email: "runtime-smoke@example.test" },
    },
  }];
  mutableDb.apiKey.update = async () => ({ id: "api_key_runtime_smoke" });
  mutableDb.$queryRaw = async (strings: unknown, ...values: unknown[]) => {
    const sql = sqlText(strings);
    if (sql.includes('FROM "AgentSessionPassport"')) {
      const requestedProject = values[0];
      const requestedSession = values[1];
      if (requestedProject !== projectId || requestedSession !== sessionId) return [];
      return [{
        id: passportId,
        projectId,
        agentIdentityId,
        sessionId,
        passportHash: hashPassportToken(passportToken),
        status: "ACTIVE",
        allowedToolsJson: ["browser.read", "rag.search"],
        blockedToolsJson: ["terminal.run", "filesystem.delete"],
        approvalRequiredToolsJson: ["gmail.send", "mcp.tool.call"],
        allowedDomainsJson: [],
        blockedDomainsJson: [],
        dataScopesJson: ["project:read"],
        memoryScopesJson: ["session"],
        riskScore: 20,
        riskLevel: "LOW",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        agentName: "runtime-smoke-agent",
        agentType: "MCP_AGENT",
        agentStatus: "ACTIVE",
        defaultPolicyJson: null,
      }];
    }
    return [];
  };
  mutableDb.$executeRaw = async (strings: unknown, ...values: unknown[]) => {
    executedSql.push({ sql: sqlText(strings), values });
    return 1;
  };
  mutableDb.securityEvent.create = async ({ data }: { data?: { id?: string; createdAt?: Date } } = {}) => ({
    id: data?.id ?? "trust_evt_runtime_smoke",
    createdAt: data?.createdAt ?? new Date(),
  });
  mutableDb.siemIntegration.findMany = async () => [];
  mutableDb.siemDelivery.createMany = async () => ({ count: 0 });
}

function restoreDbMocks() {
  mutableDb.apiKey.findMany = originals.apiKeyFindMany;
  mutableDb.apiKey.update = originals.apiKeyUpdate;
  mutableDb.$queryRaw = originals.queryRaw;
  mutableDb.$executeRaw = originals.executeRaw;
  mutableDb.securityEvent.create = originals.securityEventCreate;
  mutableDb.siemIntegration.findMany = originals.siemIntegrationFindMany;
  mutableDb.siemDelivery.createMany = originals.siemDeliveryCreateMany;
}

function authedRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey.rawKey,
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  installDbMocks();

  try {
    const [{ POST: ledgerPost }, { POST: mcpScanPost }] = await Promise.all([
      import("../app/api/agent/action/ledger/route"),
      import("../app/api/agent/mcp/scan/route"),
    ]);

    const unauthorized = await ledgerPost(authedRequest("http://localhost/api/agent/action/ledger", {
      sessionId,
      agentIdentityId: "spoofed_agent_identity",
      passportId: "spoofed_passport",
      tool: "browser.read",
      action: "read_page",
      target: "https://example.com/docs",
      idempotencyKey: "runtime-smoke-unauthorized",
    }));
    const unauthorizedBody = await unauthorized.json() as { decision?: string; reason?: string };
    assert.equal(unauthorized.status, 403, "missing passport token must block ledger insertion");
    assert.equal(unauthorizedBody.decision, "BLOCK");
    assert.match(unauthorizedBody.reason ?? "", /token/i);
    assert.equal(executedSql.some((entry) => entry.sql.includes('INSERT INTO "AgentActionLedger"')), false, "unauthorized ledger write must not insert");

    const authorized = await ledgerPost(authedRequest("http://localhost/api/agent/action/ledger", {
      sessionId,
      passportToken,
      agentIdentityId: "spoofed_agent_identity",
      passportId: "spoofed_passport",
      tool: "browser.read",
      action: "read_page",
      target: "https://example.com/docs",
      request: { url: "https://example.com/docs" },
      result: { ok: true },
      rollbackAction: { tool: "browser.read", action: "close_page", target: "https://example.com/docs" },
      idempotencyKey: "runtime-smoke-authorized",
    }));
    const authorizedBody = await authorized.json() as { decision?: string; tool?: string; action?: string };
    assert.equal(authorized.status, 201, "valid passport-bound ledger write should be accepted");
    assert.equal(authorizedBody.decision, "ALLOW");
    assert.equal(authorizedBody.tool, "browser.read");
    assert.equal(authorizedBody.action, "read_page");

    const ledgerInsert = executedSql.find((entry) => entry.sql.includes('INSERT INTO "AgentActionLedger"'));
    assert.ok(ledgerInsert, "authorized ledger write must insert");
    assert.ok(ledgerInsert.values.includes(sessionId), "ledger insert must include validated sessionId");
    assert.ok(ledgerInsert.values.includes(agentIdentityId), "ledger insert must include validated agentIdentityId");
    assert.ok(ledgerInsert.values.includes(passportId), "ledger insert must include validated passportId");
    assert.equal(ledgerInsert.values.includes("spoofed_agent_identity"), false, "ledger insert must not persist spoofed agentIdentityId");
    assert.equal(ledgerInsert.values.includes("spoofed_passport"), false, "ledger insert must not persist spoofed passportId");

    const mcpScan = await mcpScanPost(authedRequest("http://localhost/api/agent/mcp/scan", {
      serverName: "runtime-smoke-mcp",
      tools: [
        { name: "read_docs", description: "Read project files and list documentation paths" },
        { name: "run_shell", description: "Execute terminal commands and read secrets from .env" },
      ],
    }));
    const mcpBody = await mcpScan.json() as {
      serverRiskLevel?: string;
      recommendedManifest?: { allowedTools?: string[]; approvalRequired?: string[]; blocked?: string[] };
    };
    assert.equal(mcpScan.status, 200);
    assert.equal(mcpBody.serverRiskLevel, "CRITICAL");
    assert.ok(mcpBody.recommendedManifest?.approvalRequired?.includes("read_docs"));
    assert.ok(mcpBody.recommendedManifest?.blocked?.includes("run_shell"));
    assert.ok(executedSql.some((entry) => entry.sql.includes('INSERT INTO "McpToolScan"')), "MCP scan must persist tool inventory evidence");

    console.log(JSON.stringify({
      ok: true,
      checked: [
        "ledger blocks missing passport token before insert",
        "ledger stores validated passport lineage, not caller-supplied IDs",
        "MCP scanner persists tool inventory evidence",
        "MCP scanner blocks critical command/secret tool metadata",
      ],
      ledgerDecision: authorizedBody.decision,
      mcpServerRisk: mcpBody.serverRiskLevel,
      persistedStatements: executedSql.length,
    }, null, 2));
  } finally {
    restoreDbMocks();
  }
}

main().catch((error) => {
  console.error("Agent/MCP runtime smoke failed:", error);
  process.exit(1);
});
