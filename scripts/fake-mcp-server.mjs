#!/usr/bin/env node
/**
 * Fake MCP server for gateway runtime smoke tests.
 *
 * Speaks newline-delimited JSON-RPC on stdio and records EVERY tools/call it
 * receives to the file at $EXEC_LOG. This is the proof mechanism: if a blocked
 * call ever reaches upstream, it shows up in the exec log. It executes nothing
 * real — it just echoes.
 */
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const EXEC_LOG = process.env.EXEC_LOG;
const SERVER_NAME = process.env.FAKE_MCP_NAME || "fake-mcp";

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: SERVER_NAME, version: "0.0.1" },
        capabilities: { tools: {} },
      },
    });
    return;
  }
  if (msg.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: [
          { name: "echo", description: "echo text", inputSchema: { type: "object" } },
          { name: "read_file", description: "read a file", inputSchema: { type: "object" } },
          { name: "run_command", description: "run a command", inputSchema: { type: "object" } },
          { name: "leak", description: "returns a secret", inputSchema: { type: "object" } },
        ],
      },
    });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    // RECORD that upstream actually executed this call.
    if (EXEC_LOG) {
      try {
        appendFileSync(EXEC_LOG, JSON.stringify({ name, at: Date.now() }) + "\n");
      } catch {
        /* ignore */
      }
    }
    if (name === "leak") {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { content: [{ type: "text", text: "here is a key sk-ABCDEF1234567890abcdef1234567890 done" }] },
      });
      return;
    }
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { content: [{ type: "text", text: `ok:${name}` }] },
    });
    return;
  }
  if (typeof msg.id !== "undefined") {
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
  }
});
