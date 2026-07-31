/**
 * MCP gateway configuration & usability helpers.
 *
 * Provides a safe path for routing an MCP client through SoterAI: generate a
 * client config that points at the gateway, register upstream servers, and
 * write config only with an explicit backup + approval (never silently
 * overwrite). Also exposes a privacy-safe status/coverage snapshot.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import type { McpSessionIdentity } from "./types";

export interface UpstreamRegistration {
  serverId: string;
  command: string;
  args?: string[];
  allowedPermissions?: string[];
  allowedRoots?: string[];
}

/** Client config entry that routes a server through the SoterAI gateway. */
export interface GeneratedClientEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface GeneratedClientConfig {
  mcpServers: Record<string, GeneratedClientEntry>;
  /** Human-readable warning: any server NOT listed here bypasses SoterAI. */
  bypassWarning: string;
}

/**
 * Build a client config that launches the SoterAI gateway in front of each
 * registered upstream server. The client talks to the gateway; the gateway
 * talks to the real server.
 */
export function generateClientConfig(
  registrations: UpstreamRegistration[],
  gateway: { command: string; baseArgs?: string[] } = { command: "node", baseArgs: ["scripts/mcp-gateway.mjs"] },
): GeneratedClientConfig {
  const mcpServers: Record<string, GeneratedClientEntry> = {};
  for (const reg of registrations) {
    mcpServers[reg.serverId] = {
      command: gateway.command,
      args: [
        ...(gateway.baseArgs ?? []),
        "--server-id",
        reg.serverId,
        "--upstream-command",
        reg.command,
        ...(reg.args ?? []).flatMap((a) => ["--upstream-arg", a]),
      ],
      env: { SOTERAI_MCP_GATEWAY: "1" },
    };
  }
  return {
    mcpServers,
    bypassWarning:
      "SoterAI only enforces MCP servers routed through the gateway command above. " +
      "Any MCP server the client launches directly (not listed here) BYPASSES SoterAI " +
      "and is unprotected. Verify with the gateway status/coverage output.",
  };
}

export interface SafeWriteResult {
  written: boolean;
  backupPath?: string;
  reason?: string;
  rollbackInstructions: string;
}

/**
 * Write a client config only after backing up the existing file and only when
 * explicitly approved. Refuses otherwise.
 */
export function writeClientConfigSafely(input: {
  configPath: string;
  config: unknown;
  approved: boolean;
}): SafeWriteResult {
  const rollback = input.configPath + ".soterai.bak";
  const rollbackInstructions = existsSync(input.configPath)
    ? `To roll back, restore the backup: copy "${rollback}" over "${input.configPath}".`
    : `To roll back, delete "${input.configPath}" (there was no prior config).`;

  if (!input.approved) {
    return {
      written: false,
      reason: "not approved: refusing to modify MCP client configuration without explicit approval",
      rollbackInstructions,
    };
  }

  let backupPath: string | undefined;
  if (existsSync(input.configPath)) {
    backupPath = rollback;
    copyFileSync(input.configPath, backupPath);
  }
  writeFileSync(input.configPath, JSON.stringify(input.config, null, 2), "utf8");
  return { written: true, backupPath, rollbackInstructions };
}

export function readConfigFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// Server registry + status snapshot
// ---------------------------------------------------------------------------

export class ServerRegistry {
  private readonly servers = new Map<string, UpstreamRegistration>();

  register(reg: UpstreamRegistration): void {
    this.servers.set(reg.serverId, reg);
  }

  get(serverId: string): UpstreamRegistration | undefined {
    return this.servers.get(serverId);
  }

  list(): UpstreamRegistration[] {
    return [...this.servers.values()];
  }
}

export interface GatewayStatus {
  status: "ok";
  coverage: "INLINE_ENFORCEMENT" | "NO_SESSION";
  session: {
    tenantId: string;
    projectId: string;
    serverId: string;
    principalType: string;
    expiresAt: number;
    active: boolean;
  } | null;
  enforcedMethods: string[];
  unsupported: string[];
  bypassWarning: string;
}

export function buildStatus(identity?: McpSessionIdentity, now = Date.now()): GatewayStatus {
  return {
    status: "ok",
    coverage: identity ? "INLINE_ENFORCEMENT" : "NO_SESSION",
    session: identity
      ? {
          tenantId: identity.tenantId,
          projectId: identity.projectId,
          serverId: identity.serverId,
          principalType: identity.principalType,
          expiresAt: identity.expiresAt,
          active: !identity.revoked && now < identity.expiresAt,
        }
      : null,
    enforcedMethods: ["tools/call (pre-execution)", "tools/list (inventory)", "initialize (identity binding)", "tool results (post-inspection)"],
    unsupported: [
      "WebSocket MCP transport",
      "Servers launched by the client outside the gateway (bypass)",
    ],
    bypassWarning:
      "Only stdio and HTTP MCP servers routed through this gateway are enforced. " +
      "WebSocket transports and any directly-launched server are NOT protected.",
  };
}
