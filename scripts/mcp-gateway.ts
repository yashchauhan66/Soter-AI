#!/usr/bin/env node
/**
 * SoterAI inline MCP gateway — startup command.
 *
 * Sits between an MCP client (spoken on this process's stdin/stdout) and an
 * upstream MCP server (spawned as a child process) and enforces policy on
 * every tools/call BEFORE it reaches the server.
 *
 * Usage:
 *   tsx scripts/mcp-gateway.ts --server-id <id> --upstream-command <cmd> \
 *       [--upstream-arg <a>]... [--protection-mode strict]
 *   tsx scripts/mcp-gateway.ts --status
 *
 * Identity/tenant binding is read from the environment (set by the SoterAI
 * client integration): SOTERAI_TENANT, SOTERAI_PROJECT, SOTERAI_CLIENT_ID,
 * SOTERAI_PRINCIPAL, SOTERAI_PRINCIPAL_TYPE, SOTERAI_SESSION_TTL_MS,
 * SOTERAI_ALLOWED_PERMISSIONS (csv), SOTERAI_ALLOWED_ROOTS (csv).
 *
 * Evidence is emitted to stderr as privacy-safe JSON lines (no raw content).
 */
import { startStdioGateway, buildStatus } from "../lib/gateway/mcp";
import type { McpSessionIdentity, PrincipalType } from "../lib/gateway/mcp/types";
import type { MCPPermission, ProtectionMode } from "@soterai/guard-core";

function parseArgs(argv: string[]) {
  const out: { serverId?: string; command?: string; args: string[]; status?: boolean; mode?: string } = { args: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--status") out.status = true;
    else if (a === "--server-id") out.serverId = argv[++i];
    else if (a === "--upstream-command") out.command = argv[++i];
    else if (a === "--upstream-arg") out.args.push(argv[++i]);
    else if (a === "--protection-mode") out.mode = argv[++i];
  }
  return out;
}

function csv(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.status) {
    process.stdout.write(JSON.stringify(buildStatus(undefined), null, 2) + "\n");
    return;
  }

  if (!opts.serverId || !opts.command) {
    process.stderr.write("soterai-mcp-gateway: --server-id and --upstream-command are required\n");
    process.exit(2);
    return;
  }

  const ttl = Number(process.env.SOTERAI_SESSION_TTL_MS ?? 3_600_000);
  const identity: McpSessionIdentity = {
    tenantId: process.env.SOTERAI_TENANT ?? "local-tenant",
    projectId: process.env.SOTERAI_PROJECT ?? "local-project",
    clientId: process.env.SOTERAI_CLIENT_ID ?? `client_${process.pid}`,
    principalType: (process.env.SOTERAI_PRINCIPAL_TYPE as PrincipalType) ?? "human",
    principalId: process.env.SOTERAI_PRINCIPAL ?? "local-user",
    serverId: opts.serverId,
    allowedPermissions: csv(process.env.SOTERAI_ALLOWED_PERMISSIONS) as MCPPermission[],
    allowedRoots: csv(process.env.SOTERAI_ALLOWED_ROOTS),
    expiresAt: Date.now() + ttl,
  };

  const { gateway } = startStdioGateway({
    identity,
    upstream: { command: opts.command, args: opts.args },
    protectionMode: (opts.mode as ProtectionMode) ?? "standard",
    onEvidence: (decision) => {
      // Privacy-safe: decision carries only label-level evidence + redacted preview.
      process.stderr.write(JSON.stringify({ evt: "mcp_decision", decision }) + "\n");
    },
  });

  const stop = () => {
    gateway.shutdown();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main();
