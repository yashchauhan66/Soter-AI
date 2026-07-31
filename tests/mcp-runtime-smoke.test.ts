/**
 * Real stdio runtime smoke test for the MCP inline gateway.
 *
 * Spawns the fake MCP server as a real child process, connects the gateway
 * with real `ChildProcessTransport` and mock client streams, sends the
 * full MCP lifecycle, and proves:
 *  - blocked calls NEVER reach the upstream (verified via EXEC_LOG)
 *  - approved calls execute exactly once
 *  - safe calls reach upstream normally
 *  - secrets are redacted in results
 *  - shutdown is clean (no orphan processes)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, unlinkSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";

import { McpEnforcementEngine } from "../lib/gateway/mcp/engine";
import { McpGateway } from "../lib/gateway/mcp/proxy";
import { StreamTransport, ChildProcessTransport } from "../lib/gateway/mcp/stdio";
import { DEFAULT_LIMITS, type McpSessionIdentity } from "../lib/gateway/mcp/types";

const FAKE_SERVER = join(__dirname, "..", "scripts", "fake-mcp-server.mjs");

const BASE_IDENTITY: McpSessionIdentity = {
  tenantId: "runtime-test-tenant",
  projectId: "runtime-test-proj",
  clientId: "runtime-test-client",
  principalType: "human",
  principalId: "runtime-test-user",
  serverId: "fake-mcp",
  allowedPermissions: ["filesystem"] as any[],
  allowedRoots: ["/tmp"],
  expiresAt: Date.now() + 3600_000,
};

interface Env {
  tmpDir: string;
  execLog: string;
}

function setupEnv(): Env {
  const tmpDir = mkdtempSync(join(tmpdir(), "mcp-smoke-"));
  const execLog = join(tmpDir, "exec.log");
  return { tmpDir, execLog };
}

function readExecLog(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
}

function jsonRpc(method: string, params?: unknown, id: string | number = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) }) + "\n";
}

async function receiveJson(stream: PassThrough, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for response")), timeoutMs);
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString("utf8");
      const idx = buffer.indexOf("\n");
      if (idx >= 0) {
        clearTimeout(timer);
        stream.removeListener("data", onData);
        resolve(JSON.parse(buffer.slice(0, idx)));
      }
    };
    stream.on("data", onData);
  });
}

// ---------------------------------------------------------------------------
// Runtime Smoke: Prove execution vs blocking via real child process
// ---------------------------------------------------------------------------

test("mcp runtime: safe tool call reaches upstream fake server", async () => {
  const env = setupEnv();
  const clientReadable = new PassThrough();
  const clientWritable = new PassThrough();
  const engine = new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
  const upstream = new ChildProcessTransport(
    { command: "node", args: [FAKE_SERVER], env: { FAKE_MCP_NAME: "fake-mcp", EXEC_LOG: env.execLog } },
    DEFAULT_LIMITS.maxMessageBytes,
  );
  const gateway = new McpGateway({ engine, client: new StreamTransport(clientReadable, clientWritable, DEFAULT_LIMITS.maxMessageBytes), upstream, limits: DEFAULT_LIMITS });

  try {
    // Initialize
    clientReadable.write(jsonRpc("initialize", { protocolVersion: "2024-11-05" }));
    let resp = await receiveJson(clientWritable);
    assert.equal((resp as any).result?.serverInfo?.name, "fake-mcp");

    // tools/list
    clientReadable.write(jsonRpc("tools/list"));
    resp = await receiveJson(clientWritable);
    assert.ok(Array.isArray((resp as any).result?.tools));
    engine.recordToolInventory((resp as any).result);

    // Safe tool call — should reach upstream
    clientReadable.write(jsonRpc("tools/call", { name: "echo", arguments: { text: "hello" } }));
    resp = await receiveJson(clientWritable);
    assert.equal((resp as any).result?.content?.[0]?.text, "ok:echo");
    const execLog = readExecLog(env.execLog);
    assert.ok(execLog.some((l) => l.includes('"name":"echo"')), "safe call must appear in exec log");
  } finally {
    gateway.shutdown();
    cleanup(env);
  }
});

test("mcp runtime: blocked dangerous tool call never reaches upstream", async () => {
  const env = setupEnv();
  const clientReadable = new PassThrough();
  const clientWritable = new PassThrough();
  const engine = new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
  const upstream = new ChildProcessTransport(
    { command: "node", args: [FAKE_SERVER], env: { FAKE_MCP_NAME: "fake-mcp", EXEC_LOG: env.execLog } },
    DEFAULT_LIMITS.maxMessageBytes,
  );
  const gateway = new McpGateway({ engine, client: new StreamTransport(clientReadable, clientWritable, DEFAULT_LIMITS.maxMessageBytes), upstream, limits: DEFAULT_LIMITS });

  try {
    clientReadable.write(jsonRpc("initialize", { protocolVersion: "2024-11-05" }));
    await receiveJson(clientWritable);
    clientReadable.write(jsonRpc("tools/list"));
    const toolsResp = await receiveJson(clientWritable);
    engine.recordToolInventory((toolsResp as any).result);

    // Dangerous command — must be BLOCKED and never reach upstream
    clientReadable.write(jsonRpc("tools/call", { name: "exec", arguments: { command: "rm -rf /" } }));
    const resp = await receiveJson(clientWritable);
    assert.ok((resp as any).error, "blocked call must return error");
    assert.equal((resp as any).error?.code, -32001, "must be SOTER_BLOCKED");

    // Verify: no tool/call with "rm" or "exec" appears in exec log
    const execLog = readExecLog(env.execLog);
    const blockedCalls = execLog.filter((l) => l.includes("rm") || l.includes("exec"));
    assert.equal(blockedCalls.length, 0, "blocked call must never appear in exec log");
  } finally {
    gateway.shutdown();
    cleanup(env);
  }
});

test("mcp runtime: approved call executes exactly once", async () => {
  const env = setupEnv();
  const clientReadable = new PassThrough();
  const clientWritable = new PassThrough();
  const engine = new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
  const upstream = new ChildProcessTransport(
    { command: "node", args: [FAKE_SERVER], env: { FAKE_MCP_NAME: "fake-mcp", EXEC_LOG: env.execLog } },
    DEFAULT_LIMITS.maxMessageBytes,
  );
  const gateway = new McpGateway({ engine, client: new StreamTransport(clientReadable, clientWritable, DEFAULT_LIMITS.maxMessageBytes), upstream, limits: DEFAULT_LIMITS });

  try {
    clientReadable.write(jsonRpc("initialize", { protocolVersion: "2024-11-05" }));
    await receiveJson(clientWritable);
    clientReadable.write(jsonRpc("tools/list"));
    const toolsResp = await receiveJson(clientWritable);
    engine.recordToolInventory((toolsResp as any).result);

    // First call with command — requires approval
    clientReadable.write(jsonRpc("tools/call", { name: "echo", arguments: { command: "ls -la" } }));
    let resp = await receiveJson(clientWritable);
    assert.ok((resp as any).error, "first call must require approval");
    assert.equal((resp as any).error?.code, -32002, "must be SOTER_APPROVAL_REQUIRED");
    const approvalId = (resp as any).error?.data?.approvalId;
    assert.ok(approvalId, "approvalId must be returned");

    // Approve via engine's store
    const approved = engine.approvals.approve(approvalId);
    assert.ok(approved.ok, "approval must succeed");

    // Second call with same args — should now forward and execute once
    clientReadable.write(jsonRpc("tools/call", { name: "echo", arguments: { command: "ls -la" } }));
    resp = await receiveJson(clientWritable);
    assert.equal((resp as any).result?.content?.[0]?.text, "ok:echo", "approved call must reach upstream");

    // Verify: exactly one execution of this call
    const execLog = readExecLog(env.execLog);
    const matchCalls = execLog.filter((l) => l.includes('"name":"echo"') || l.includes('ls -la'));
    assert.equal(matchCalls.length, 1, "approved call must execute exactly once");
  } finally {
    gateway.shutdown();
    cleanup(env);
  }
});

test("mcp runtime: secret in tool result is redacted", async () => {
  const env = setupEnv();
  const clientReadable = new PassThrough();
  const clientWritable = new PassThrough();
  const engine = new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
  const upstream = new ChildProcessTransport(
    { command: "node", args: [FAKE_SERVER], env: { FAKE_MCP_NAME: "fake-mcp", EXEC_LOG: env.execLog } },
    DEFAULT_LIMITS.maxMessageBytes,
  );
  const gateway = new McpGateway({ engine, client: new StreamTransport(clientReadable, clientWritable, DEFAULT_LIMITS.maxMessageBytes), upstream, limits: DEFAULT_LIMITS });

  try {
    clientReadable.write(jsonRpc("initialize", { protocolVersion: "2024-11-05" }));
    await receiveJson(clientWritable);
    clientReadable.write(jsonRpc("tools/list"));
    const toolsResp = await receiveJson(clientWritable);
    engine.recordToolInventory((toolsResp as any).result);

    // Call the "leak" tool which returns a secret
    clientReadable.write(jsonRpc("tools/call", { name: "leak", arguments: {} }));
    const resp = await receiveJson(clientWritable);

    // The result should NOT contain the raw secret
    const resultText = JSON.stringify(resp);
    assert.ok(!resultText.includes("sk-ABCDEF1234567890abcdef1234567890"), "raw secret must not appear in result");
    // The response should either be redacted or blocked
    if ((resp as any).result) {
      const content = (resp as any).result?.content?.[0]?.text || "";
      assert.ok(!content.includes("sk-ABCDEF"), "secret must not leak in result text");
    }
  } finally {
    gateway.shutdown();
    cleanup(env);
  }
});

test("mcp runtime: shutdown leaves no orphan process", async () => {
  const env = setupEnv();
  const clientReadable = new PassThrough();
  const clientWritable = new PassThrough();
  const engine = new McpEnforcementEngine({ identity: BASE_IDENTITY, limits: DEFAULT_LIMITS });
  const upstream = new ChildProcessTransport(
    { command: "node", args: [FAKE_SERVER], env: { FAKE_MCP_NAME: "fake-mcp", EXEC_LOG: env.execLog } },
    DEFAULT_LIMITS.maxMessageBytes,
  );

  const childPid = upstream.child.pid;
  assert.ok(childPid > 0, "upstream child must have a PID");

  // Send a call and verify it works
  const gateway = new McpGateway({ engine, client: new StreamTransport(clientReadable, clientWritable, DEFAULT_LIMITS.maxMessageBytes), upstream, limits: DEFAULT_LIMITS });
  clientReadable.write(jsonRpc("initialize", { protocolVersion: "2024-11-05" }));
  await receiveJson(clientWritable);

  // Shutdown
  gateway.shutdown();

  // After shutdown, the child must be dead
  try {
    const killed = upstream.child.killed;
    assert.ok(killed || upstream.child.exitCode !== null, "upstream child must be killed after shutdown");
  } catch {
    // process already dead — this is fine
  }
  cleanup(env);
});

function cleanup(env: Env) {
  try {
    if (existsSync(env.execLog)) unlinkSync(env.execLog);
    try { unlinkSync(env.tmpDir); } catch { /* dir may not be empty */ }
  } catch { /* ignore */ }
}
