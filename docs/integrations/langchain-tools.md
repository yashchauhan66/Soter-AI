# LangChain Tool Firewall Integration

```ts
const searchTool = firewall.createLangChainToolWrapper("web_search", async (args) => {
  return webSearch.invoke(args);
}, {
  sessionId,
  action: "tool_call",
  destination: "external",
  riskContext: { externalDestination: true }
});

const result = await searchTool({ query: userQuery });
if (!result.executed) return result.decision.reason;
```

For tools that send messages, write files, call APIs, or modify databases, set the matching `riskContext` flags so policy decisions are fail-closed and auditable.
