# MCP Agent Firewall Integration

Wrap every MCP tool before invocation:

```ts
const protectedTool = firewall.wrapMcpTool("filesystem.write", async (args, decision) => {
  return mcp.callTool("filesystem.write", {
    ...args,
    content: decision.safeContent ?? args.content
  });
}, {
  sessionId,
  action: "mcp_tool_call",
  destination: "local",
  riskContext: { canModifyData: true, canAccessFiles: true }
});

const result = await protectedTool({ path: "notes.md", content: "safe notes" });
if (!result.executed) return result.decision;
```

MCP servers should never receive raw tool arguments until cybersecurityguard returns an execution-safe decision.
