/**
 * stdio transport for the MCP gateway.
 *
 * MCP's stdio transport is newline-delimited JSON-RPC. The gateway speaks it
 * on its own stdin/stdout to the client, and spawns the upstream MCP server as
 * a child process (shell:false, no shell interpolation) and speaks it on the
 * child's stdio. This is the real runtime that lets a client be routed through
 * SoterAI by pointing its config at the gateway command instead of the server.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { LineFramer } from "./jsonrpc";
import type { RawTransport } from "./proxy";

export class StreamTransport implements RawTransport {
  private readonly framer: LineFramer;
  private lineHandler: ((line: string) => void) | null = null;
  private closeHandler: (() => void) | null = null;

  constructor(
    private readonly readable: NodeJS.ReadableStream,
    private readonly writable: NodeJS.WritableStream,
    maxLineBytes: number,
  ) {
    this.framer = new LineFramer(maxLineBytes);
    this.readable.setEncoding?.("utf8");
    this.readable.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      this.framer.push(
        text,
        (line) => this.lineHandler?.(line),
        () => {
          /* overflow: drop buffer; caller sees no line, stays safe */
        },
      );
    });
    this.readable.on("end", () => this.closeHandler?.());
    this.readable.on("close", () => this.closeHandler?.());
    this.readable.on("error", () => this.closeHandler?.());
  }

  send(line: string): void {
    try {
      this.writable.write(line + "\n");
    } catch {
      /* peer gone; shutdown flows via close handlers */
    }
  }

  onLine(handler: (line: string) => void): void {
    this.lineHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  close(): void {
    try {
      (this.writable as NodeJS.WritableStream & { end?: () => void }).end?.();
    } catch {
      /* ignore */
    }
  }
}

export interface UpstreamSpec {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class ChildProcessTransport extends StreamTransport {
  readonly child: ChildProcessWithoutNullStreams;

  constructor(spec: UpstreamSpec, maxLineBytes: number) {
    const child = spawn(spec.command, spec.args ?? [], {
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: false, // never interpolate through a shell
    }) as ChildProcessWithoutNullStreams;
    super(child.stdout, child.stdin, maxLineBytes);
    this.child = child;
    // stderr from the upstream server is diagnostic only; never forwarded to
    // the client and never scanned for secrets.
    child.stderr?.on("data", () => {});
  }

  override close(): void {
    super.close();
    try {
      this.child.kill();
    } catch {
      /* ignore */
    }
  }
}
