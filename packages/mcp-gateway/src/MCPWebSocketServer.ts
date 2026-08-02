/**
 * MCP Gateway — WebSocket Server
 *
 * Accepts MCP JSON-RPC connections over WebSocket (ws:// or wss://),
 * forwarding each message through the same enforcement gateway used by
 * the HTTP transport — so tool-call interception, approval workflow,
 * and result secret-scanning apply identically.
 *
 * Security:
 * - Optional bearer-token auth on the HTTP upgrade request
 * - Tenant/project/clientId identity from upgrade headers or `?identity=` JSON param
 * - Per-message size guard via config.maxBodyBytes
 * - Full JSON-RPC validation — malformed frames never reach upstream
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer, IncomingMessage } from "http";
import { createServer } from "http";
import { MCPJsonRpcGateway, type GatewayDeps } from "./MCPJsonRpcGateway";
import type { MCPGatewayConfig } from "./MCPGatewayConfig";
import type { MCPClientIdentity, JsonRpcMessage } from "./MCPJsonRpcTypes";
import { createJsonRpcError, createJsonRpcSuccess, JSON_RPC_ERRORS, isJsonRpcNotification } from "./MCPJsonRpcTypes";

export interface MCPWebSocketServerOptions {
  config: MCPGatewayConfig;
  deps?: GatewayDeps;
  port?: number;
  host?: string;
  authToken?: string;
  /** Optional existing HTTP server to attach the WebSocket upgrade onto. */
  httpServer?: HttpServer;
}

export class MCPWebSocketServer {
  private readonly gateway: MCPJsonRpcGateway;
  private readonly wss: WebSocketServer;
  private readonly httpServer: HttpServer;
  private readonly ownsHttpServer: boolean;
  private readonly port: number;
  private readonly host: string;
  private readonly authToken?: string;
  private readonly maxBodyBytes: number;
  private started = false;

  constructor(options: MCPWebSocketServerOptions) {
    this.gateway = new MCPJsonRpcGateway(options.config, options.deps);
    this.port = options.port ?? 47323;
    this.host = options.host ?? "127.0.0.1";
    this.authToken = options.authToken;
    this.maxBodyBytes = options.config.maxBodyBytes ?? 1_048_576;

    if (options.httpServer) {
      this.httpServer = options.httpServer;
      this.ownsHttpServer = false;
    } else {
      this.httpServer = createServer();
      this.ownsHttpServer = true;
    }

    this.wss = new WebSocketServer({ noServer: true });
    this.httpServer.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.gateway.start();
      if (this.ownsHttpServer) {
        this.httpServer.listen(this.port, this.host, () => {
          this.started = true;
          console.log(`MCP Gateway WebSocket listening on ws://${this.host}:${this.port}`);
          resolve();
        });
      } else {
        this.started = true;
        resolve();
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.gateway.stop();
      this.wss.clients.forEach((ws) => {
        try {
          ws.terminate();
        } catch {
          /* already closed */
        }
      });
      this.wss.close(() => {
        if (this.ownsHttpServer) {
          this.httpServer.close(() => {
            this.started = false;
            console.log("MCP Gateway WebSocket stopped");
            resolve();
          });
        } else {
          this.started = false;
          resolve();
        }
      });
    });
  }

  getGateway(): MCPJsonRpcGateway {
    return this.gateway;
  }

  address(): { port: number; host: string } {
    const addr = this.httpServer.address();
    if (addr && typeof addr === "object") {
      return { port: addr.port, host: addr.address };
    }
    return { port: this.port, host: this.host };
  }

  private handleUpgrade(
    req: IncomingMessage,
    socket: import("stream").Duplex,
    head: Buffer,
  ): void {
    // Authenticate on the upgrade handshake
    if (this.authToken) {
      const authHeader = req.headers["authorization"] ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== this.authToken) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientIdentity = this.parseClientIdentity(req);

    ws.on("message", async (data) => {
      await this.handleMessage(ws, data, clientIdentity);
    });

    ws.on("error", (err) => {
      console.error("MCP Gateway WebSocket client error:", err.message);
    });
  }

  private async handleMessage(
    ws: WebSocket,
    data: import("ws").RawData,
    identity: MCPClientIdentity,
  ): Promise<void> {
    // Per-message size guard
    const byteLength = Buffer.isBuffer(data)
      ? data.length
      : Array.isArray(data)
        ? data.reduce((sum: number, buf: Buffer) => sum + buf.length, 0)
        : (data as ArrayBuffer).byteLength;
    if (byteLength > this.maxBodyBytes) {
      this.send(ws, createJsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR.code, "Message exceeds size limit"));
      return;
    }

    // Parse JSON-RPC frame
    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      this.send(ws, createJsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR.code, JSON_RPC_ERRORS.PARSE_ERROR.message));
      return;
    }

    try {
      // Route through the same enforcement pipeline as the HTTP transport
      const response = await this.gateway.processMessage(message, identity);
      if (response === null || isJsonRpcNotification(message as JsonRpcMessage)) {
        // Notification — no response should be sent back on the wire
        return;
      }
      this.send(ws, response);
    } catch (error) {
      const msg = message as { id?: unknown };
      console.error("MCP Gateway WebSocket processing error:", error);
      this.send(
        ws,
        createJsonRpcError(
          (msg?.id as string | number | null) ?? null,
          JSON_RPC_ERRORS.INTERNAL_ERROR.code,
          JSON_RPC_ERRORS.INTERNAL_ERROR.message,
        ),
      );
    }
  }

  private send(ws: WebSocket, message: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* websocket closed mid-send */
    }
  }

  private parseClientIdentity(req: IncomingMessage): MCPClientIdentity {
    // Prefer headers; fall back to a JSON-encoded ?identity= query param for
    // browser WebSocket clients that cannot set custom headers.
    const url = new URL(req.url ?? "/", `ws://${req.headers.host ?? "localhost"}`);
    const identityParam = url.searchParams.get("identity");
    let paramIdentity: Record<string, string> = {};
    if (identityParam) {
      try {
        paramIdentity = JSON.parse(identityParam);
      } catch {
        /* ignore malformed identity param */
      }
    }

    return {
      tenant: (req.headers["x-soterai-tenant"] as string) ?? paramIdentity.tenant ?? "default",
      project: (req.headers["x-soterai-project"] as string) ?? paramIdentity.project ?? "default",
      clientId:
        (req.headers["x-soterai-client-id"] as string) ??
        paramIdentity.clientId ??
        req.socket.remoteAddress ??
        "unknown",
      userId: (req.headers["x-soterai-user-id"] as string) ?? paramIdentity.userId,
      agentId: (req.headers["x-soterai-agent-id"] as string) ?? paramIdentity.agentId,
    };
  }
}

// Re-export for convenience in tests and adapters
export { createJsonRpcError, createJsonRpcSuccess, JSON_RPC_ERRORS };
