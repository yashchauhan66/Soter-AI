/**
 * Test helper: expose the real child-process MCP server over real HTTP.
 *
 * `scripts/fake-mcp-server.mjs` speaks newline-delimited JSON-RPC on stdio. The
 * HTTP gateway proxies to an HTTP URL. This bridge is the smallest honest way to
 * put the two together for runtime verification: a REAL child process behind a
 * REAL HTTP listener, with an exec log that records every `tools/call` the
 * child actually executed.
 *
 * It is a test fixture only — nothing here ships.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createInterface, type Interface } from "node:readline";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FAKE_SERVER = join(__dirname, "..", "..", "scripts", "fake-mcp-server.mjs");

export interface ChildMcpBridge {
  /** Base URL of the HTTP listener in front of the child process. */
  url: string;
  child: ChildProcessWithoutNullStreams;
  /** Path of the exec log the child appends every executed tools/call to. */
  execLog: string;
  /** JSON-RPC messages the bridge received from the gateway. */
  received: Array<Record<string, unknown>>;
  /** Lines of the exec log — proof of what the child really executed. */
  readExecLog(): string[];
  /** Terminate the HTTP listener and the child process. */
  close(): Promise<void>;
  /** True once close() has fully torn everything down. */
  isClosed(): boolean;
}

export interface ChildMcpBridgeOptions {
  /** serverInfo.name the child reports during initialize. */
  serverName?: string;
  /** Reply timeout for a single JSON-RPC round trip. */
  timeoutMs?: number;
}

/**
 * Start a real child MCP server fronted by a real HTTP server.
 *
 * The listener speaks both response shapes the gateway supports:
 *  - `Accept: application/json`     → a single JSON-RPC response body
 *  - `Accept: text/event-stream`    → the same response as SSE frames
 */
export async function startChildMcpBridge(
  opts: ChildMcpBridgeOptions = {},
): Promise<ChildMcpBridge> {
  const tmpDir = mkdtempSync(join(tmpdir(), "mcp-http-smoke-"));
  const execLog = join(tmpDir, "exec.log");
  const timeoutMs = opts.timeoutMs ?? 5000;

  const child = spawn("node", [FAKE_SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, EXEC_LOG: execLog, FAKE_MCP_NAME: opts.serverName ?? "fake-mcp" },
  }) as ChildProcessWithoutNullStreams;

  const waiters = new Map<string, (msg: Record<string, unknown>) => void>();
  const rl: Interface = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
    const waiter = waiters.get(String(msg.id));
    if (waiter) {
      waiters.delete(String(msg.id));
      waiter(msg);
    }
  });

  const received: Array<Record<string, unknown>> = [];

  function ask(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const key = String(msg.id);
      const timer = setTimeout(() => {
        waiters.delete(key);
        reject(new Error(`child did not answer id=${key} within ${timeoutMs}ms`));
      }, timeoutMs);
      waiters.set(key, (answer) => {
        clearTimeout(timer);
        resolve(answer);
      });
      child.stdin.write(JSON.stringify(msg) + "\n");
    });
  }

  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "bad json" }));
      return;
    }
    received.push(body);

    let answer: Record<string, unknown>;
    try {
      answer = await ask(body);
    } catch (err) {
      res.writeHead(504, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
      return;
    }

    const wantsSse = (req.headers.accept ?? "").includes("text/event-stream");
    if (wantsSse) {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(`event: message\ndata: ${JSON.stringify(answer)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(answer));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;

  let closed = false;
  return {
    url: `http://127.0.0.1:${port}`,
    child,
    execLog,
    received,
    readExecLog(): string[] {
      if (!existsSync(execLog)) return [];
      return readFileSync(execLog, "utf8").trim().split("\n").filter(Boolean);
    },
    isClosed: () => closed,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      rl.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (child.exitCode === null && !child.killed) {
        const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        try {
          child.stdin.end();
        } catch {
          /* already gone */
        }
        child.kill();
        // The bail-out timer must be cleared on the happy path, or it outlives
        // close() and shows up as a leaked Timeout in the shutdown-hygiene test.
        let bail: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            exited,
            new Promise<void>((resolve) => {
              bail = setTimeout(resolve, 3000);
            }),
          ]);
        } finally {
          if (bail) clearTimeout(bail);
        }
      }
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}
