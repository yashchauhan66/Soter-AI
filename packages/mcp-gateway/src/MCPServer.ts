/**
 * MCP Gateway — HTTP Server
 *
 * HTTP server that accepts MCP JSON-RPC connections from clients,
 * forwards them through the enforcement gateway to upstream MCP servers.
 *
 * Features:
 * - Health/status endpoint
 * - Server registration
 * - Graceful shutdown
 * - Circuit breaking
 * - Rate limiting
 * - CORS support
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { MCPJsonRpcGateway, type GatewayDeps } from "./MCPJsonRpcGateway";
import type { MCPGatewayConfig } from "./MCPGatewayConfig";
import type { MCPClientIdentity } from "./MCPJsonRpcTypes";

export interface MCPServerOptions {
  config: MCPGatewayConfig;
  deps?: GatewayDeps;
  port?: number;
  host?: string;
  authToken?: string;
}

export class MCPServer {
  private readonly gateway: MCPJsonRpcGateway;
  private readonly server: Server;
  private readonly port: number;
  private readonly host: string;
  private readonly authToken?: string;
  private started = false;

  constructor(options: MCPServerOptions) {
    this.gateway = new MCPJsonRpcGateway(options.config, options.deps);
    this.port = options.port ?? 47322;
    this.host = options.host ?? "127.0.0.1";
    this.authToken = options.authToken;
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.gateway.start();
      this.server.listen(this.port, this.host, () => {
        this.started = true;
        console.log(`MCP Gateway listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.gateway.stop();
      this.server.close(() => {
        this.started = false;
        console.log("MCP Gateway stopped");
        resolve();
      });
    });
  }

  getGateway(): MCPJsonRpcGateway {
    return this.gateway;
  }

  address(): { port: number; host: string } {
    const addr = this.server.address();
    if (addr && typeof addr === "object") {
      return { port: addr.port, host: addr.address };
    }
    return { port: this.port, host: this.host };
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const path = url.pathname;

      // Health endpoint
      if (path === "/health" || path === "/status") {
        return this.jsonResponse(res, 200, {
          status: "ok",
          gateway: "running",
          sessions: this.gateway.getSessionManager().size,
          circuitState: "closed",
          uptime: process.uptime(),
        });
      }

      // Version endpoint
      if (path === "/version") {
        return this.jsonResponse(res, 200, {
          version: "0.1.0",
          name: "SoterAI MCP Gateway",
        });
      }

      // Evidence endpoint
      if (path === "/evidence") {
        return this.jsonResponse(res, 200, {
          evidence: this.gateway.getEvidenceLog().slice(-100),
        });
      }

      // Sessions endpoint
      if (path === "/sessions") {
        const sessions = this.gateway.getSessionManager().getActiveSessions();
        return this.jsonResponse(res, 200, {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            tenant: s.clientIdentity.tenant,
            project: s.clientIdentity.project,
            clientId: s.clientIdentity.clientId,
            serverIdentity: s.serverIdentity,
            state: s.state,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
          })),
        });
      }

      // Approval endpoint
      if (path === "/approvals") {
        const approvals = this.gateway.getApprovalManager().getPendingForTenant("*");
        return this.jsonResponse(res, 200, {
          count: approvals.length,
        });
      }

      // Lockdown endpoint
      if (path === "/lockdown") {
        if (req.method === "POST") {
          let body = "";
          for await (const chunk of req) body += chunk;
          const parsed = JSON.parse(body || "{}");
          this.gateway.getApprovalManager().setEmergencyLockdown(parsed.active !== false);
          return this.jsonResponse(res, 200, {
            lockdown: parsed.active !== false,
          });
        }
        return this.jsonResponse(res, 405, { error: "Method not allowed" });
      }

      // JSON-RPC endpoint
      if (path === "/mcp" || path === "/") {
        if (req.method !== "POST") {
          return this.jsonResponse(res, 405, { error: "Method not allowed" });
        }

        // Authenticate
        const authHeader = req.headers["authorization"] ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (this.authToken && token !== this.authToken) {
          return this.jsonResponse(res, 401, { error: "Unauthorized" });
        }

        // Parse client identity from headers
        const clientIdentity = this.parseClientIdentity(req);

        // Read body
        let body = "";
        for await (const chunk of req) body += chunk;

        // Parse JSON-RPC message
        let message: unknown;
        try {
          message = JSON.parse(body);
        } catch {
          return this.jsonResponse(res, 400, {
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          });
        }

        // Process through gateway
        const response = await this.gateway.processMessage(message, clientIdentity);

        if (response === null) {
          // Notification - no response
          return this.jsonResponse(res, 202, {});
        }

        return this.jsonResponse(res, 200, response, {
          "x-soterai-gateway": "mcp",
        });
      }

      return this.jsonResponse(res, 404, { error: "Not found" });
    } catch (error) {
      console.error("MCP Gateway error:", error);
      return this.jsonResponse(res, 500, {
        error: "Internal server error",
        jsonrpc: "2.0",
        id: null,
        errorCode: -32603,
      });
    }
  }

  private parseClientIdentity(req: IncomingMessage): MCPClientIdentity {
    return {
      tenant: req.headers["x-soterai-tenant"] as string ?? "default",
      project: req.headers["x-soterai-project"] as string ?? "default",
      clientId: req.headers["x-soterai-client-id"] as string ?? req.socket.remoteAddress ?? "unknown",
      userId: req.headers["x-soterai-user-id"] as string,
      agentId: req.headers["x-soterai-agent-id"] as string,
    };
  }

  private jsonResponse(
    res: ServerResponse,
    status: number,
    data: unknown,
    extraHeaders?: Record<string, string>,
  ): void {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Soterai-Tenant, X-Soterai-Project, X-Soterai-Client-Id",
      ...extraHeaders,
    };
    res.writeHead(status, headers);
    res.end(JSON.stringify(data));
  }
}
