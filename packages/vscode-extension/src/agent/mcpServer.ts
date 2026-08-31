/**
 * GAP 2 — SoterAI as an MCP server, for every agent that is not Copilot.
 *
 * `languageModelTools.ts` reaches VS Code chat. This reaches everything else:
 * Claude Desktop, Cline, Continue, any MCP client the user already runs. Same
 * three checks, same verdicts, same `toolLogic.ts` — a second implementation
 * would mean two answers to "is `rm -rf /` dangerous", and the one an agent gets
 * would depend on which client it happened to be.
 *
 * This file is a SEPARATE ENTRY POINT, bundled to `dist/soterai-mcp-server.js`
 * and spawned as a plain Node child process. It must never import `vscode`:
 * there is no extension host here, and `require("vscode")` would throw before
 * the first message is read. `toolLogic.ts` is pure for the same reason.
 *
 * Transport is MCP stdio: newline-delimited JSON-RPC 2.0 on stdin/stdout.
 * Deliberately hand-rolled rather than pulled from `@modelcontextprotocol/sdk` —
 * the VSIX bundles no runtime dependencies, and three read-only tools do not
 * justify a dependency in a security product's supply chain.
 *
 * SECURITY POSTURE. Reads stdin, writes stdout. It opens no socket, spawns no
 * child, touches no file, and makes no network call, so an agent that talks to
 * it cannot reach anything through it. Input is bounded before parsing, because
 * the peer is an AI agent and an unbounded `JSON.parse` on agent-supplied bytes
 * is a denial-of-service waiting to happen. Nothing is logged: stdout is the
 * protocol channel, so any stray write to it would corrupt the stream.
 */
import { AGENT_TOOLS, AGENT_TOOL_COVERAGE } from "./toolLogic";

/** Protocol revision this server implements. */
const PROTOCOL_VERSION = "2024-11-05";

/**
 * The provider id VS Code registers this server under. Must equal
 * `contributes.mcpServerDefinitionProviders[].id` in package.json, or
 * `registerMcpServerDefinitionProvider` throws.
 *
 * It lives here rather than next to the registration code because that module
 * imports `vscode`, and this constant has to be assertable from a plain unit
 * test — the same reason the whole server is pure.
 */
export const MCP_PROVIDER_ID = "soterai.guard-tools";

/** Where esbuild emits this file inside the VSIX. */
export const MCP_SERVER_RELATIVE_PATH = "dist/soterai-mcp-server.js";

/**
 * Hard cap on one JSON-RPC line. Generous for a scan request, small enough that
 * a runaway agent cannot exhaust memory. Oversized lines are dropped with an
 * error reply rather than parsed.
 */
const MAX_LINE_BYTES = 1024 * 1024;

/** JSON Schemas the client shows the model. Kept next to the descriptions. */
export const MCP_TOOL_DEFINITIONS = [
    {
        name: "soterai_scan_text",
        description:
            "Check text for secrets, prompt injection, and jailbreak attempts before sending it to a model, " +
            "writing it to a file, or including it in a commit. Returns a verdict and, when secrets are present, " +
            "a redacted copy safe to use instead. Also catches content hidden by zero-width characters, homoglyphs, " +
            "leetspeak or base64. ADVISORY: this returns a verdict, it cannot block your action.",
        inputSchema: {
            type: "object",
            properties: {
                text: { type: "string", description: "The text to check." },
            },
            required: ["text"],
        },
    },
    {
        name: "soterai_check_command",
        description:
            "Check a shell command for destructive or credential-stealing behaviour before running it: " +
            "recursive deletes, fork bombs, piping a download into a shell, reverse shells, reading " +
            "~/.aws/credentials or SSH keys, privileged containers, destructive kubectl. " +
            "ADVISORY and pattern-based: it cannot see what a script the command invokes will do.",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The exact command line you intend to run." },
            },
            required: ["command"],
        },
    },
    {
        name: "soterai_check_dependency",
        description:
            "Check a package before installing it: typosquatting, unpinned versions, install-from-URL, " +
            "and piped-shell install commands. Accepts a whole install command or a name and version. " +
            "ADVISORY and offline — local heuristics only, no CVE database is queried.",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "A full install command, e.g. \"npm install expres\"." },
                name: { type: "string", description: "Package name, if you do not have a command." },
                version: { type: "string", description: "Version or range. Defaults to \"latest\"." },
            },
        },
    },
] as const;

interface JsonRpcRequest {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
}

/** A reply to send, or `undefined` for a notification that needs none. */
export type McpReply = Record<string, unknown> | undefined;

function ok(id: unknown, result: unknown): McpReply {
    return { jsonrpc: "2.0", id, result };
}

function fail(id: unknown, code: number, message: string): McpReply {
    return { jsonrpc: "2.0", id, error: { code, message } };
}

/**
 * Handle one parsed JSON-RPC message.
 *
 * Exported and pure so the whole protocol surface is testable without spawning a
 * process or wiring streams — the transport below is then thin enough to read in
 * one sitting.
 *
 * Notifications (no `id`) get no reply, per JSON-RPC 2.0. Returning an error
 * object for one would put an unsolicited message on the stream and confuse a
 * strict client.
 */
export function handleMcpMessage(message: unknown): McpReply {
    if (!message || typeof message !== "object") return fail(null, -32600, "Invalid Request");
    const { id, method, params } = message as JsonRpcRequest;
    const isNotification = id === undefined || id === null;

    switch (method) {
        case "initialize":
            return ok(id, {
                protocolVersion: PROTOCOL_VERSION,
                // Only `tools`. Declaring resources or prompts we do not serve
                // would make a client advertise capabilities that then fail.
                capabilities: { tools: {} },
                serverInfo: { name: "soterai-guard", version: "1.0.0" },
                instructions:
                    "SoterAI checks text, shell commands and dependencies for security risks before you act on them. " +
                    AGENT_TOOL_COVERAGE,
            });

        case "notifications/initialized":
        case "initialized":
            return undefined;

        case "ping":
            return isNotification ? undefined : ok(id, {});

        case "tools/list":
            return ok(id, { tools: MCP_TOOL_DEFINITIONS });

        case "tools/call": {
            const call = params as { name?: unknown; arguments?: unknown } | undefined;
            const tool = AGENT_TOOLS.find((candidate) => candidate.name === call?.name);
            if (!tool) return fail(id, -32602, `Unknown tool: ${String(call?.name)}`);
            try {
                const result = tool.run(call?.arguments ?? {});
                return ok(id, {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    // A `block` verdict is NOT a protocol error. The call
                    // succeeded and the answer is "do not do this"; reporting it
                    // as isError would tell the agent the check itself failed,
                    // which invites a retry or a shrug.
                    isError: false,
                });
            } catch (error) {
                // A detector throwing must not take the server down: the agent
                // would lose every subsequent check, silently.
                return fail(id, -32603, `SoterAI check failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        default:
            return isNotification ? undefined : fail(id, -32601, `Method not found: ${String(method)}`);
    }
}

/**
 * Run the stdio loop. Returns when stdin closes.
 *
 * Streams are injectable so the transport itself is testable: the alternative is
 * spawning a real process to assert that a line in produces a line out, which is
 * slower and proves less.
 */
export function runMcpServer(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout,
): Promise<void> {
    return new Promise((resolve) => {
        let buffer = "";
        let discardingOversizedFrame = false;

        const write = (reply: McpReply): void => {
            if (!reply) return;
            output.write(JSON.stringify(reply) + "\n");
        };

        input.setEncoding?.("utf8");
        input.on("data", (chunk: string | Buffer) => {
            let incoming = typeof chunk === "string" ? chunk : chunk.toString("utf8");

            // Once a frame crosses the cap, discard through its newline. Clearing
            // only the current buffer would reinterpret the next chunk (the tail
            // of the same attacker-controlled frame) as a fresh JSON-RPC request.
            if (discardingOversizedFrame) {
                const boundary = incoming.indexOf("\n");
                if (boundary < 0) return;
                discardingOversizedFrame = false;
                incoming = incoming.slice(boundary + 1);
            }

            buffer += incoming;

            let newline = buffer.indexOf("\n");
            while (newline >= 0) {
                const frame = buffer.slice(0, newline);
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf("\n");
                if (Buffer.byteLength(frame, "utf8") > MAX_LINE_BYTES) {
                    write(fail(null, -32600, `Message exceeds ${MAX_LINE_BYTES} bytes and was discarded`));
                    continue;
                }
                const line = frame.trim();
                if (!line) continue;
                let parsed: unknown;
                try {
                    parsed = JSON.parse(line);
                } catch {
                    write(fail(null, -32700, "Parse error"));
                    continue;
                }
                write(handleMcpMessage(parsed));
            }

            // Cap the remaining unterminated frame after complete messages have
            // been consumed. One large transport chunk may legitimately contain
            // thousands of individually small newline-delimited requests.
            if (Buffer.byteLength(buffer, "utf8") > MAX_LINE_BYTES) {
                buffer = "";
                discardingOversizedFrame = true;
                write(fail(null, -32600, `Message exceeds ${MAX_LINE_BYTES} bytes and was discarded`));
            }
        });

        input.on("end", () => resolve());
        input.on("close", () => resolve());
        // A broken pipe is the client going away, which is a normal shutdown for
        // a stdio server — not an error worth a non-zero exit code.
        input.on("error", () => resolve());
    });
}

// Only start when this file IS the entry point. The bundled server and the unit
// tests import the same module, and a top-level `runMcpServer()` would make the
// test suite hang waiting on a stdin that never closes.
if (require.main === module) {
    void runMcpServer();
}
