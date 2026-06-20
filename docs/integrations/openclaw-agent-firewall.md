# OpenClaw Agent Firewall Integration

cybersecurityguard Agent Firewall protects OpenClaw-style computer-use agents before they touch the browser, files, email, terminal, clipboard, forms, APIs, MCP tools, RAG documents, and private data.

Prompt scanning alone is not enough. Check every tool/action before execution, scan data before it leaves the user environment, scan tool results, then scan the final response.

## Environment

```bash
CYBERSECURITYGUARD_API_KEY="ck_test_..."
CYBERSECURITYGUARD_BASE_URL="http://localhost:3000"
CYBERSECURITYGUARD_AGENT_FIREWALL_ENABLED="true"
CYBERSECURITYGUARD_FAIL_CLOSED="true"
CYBERSECURITYGUARD_ALLOWED_WORKSPACE_DIR=""
CYBERSECURITYGUARD_BLOCK_DOTENV_READ="true"
CYBERSECURITYGUARD_REQUIRE_APPROVAL_FOR_EMAIL_SEND="true"
CYBERSECURITYGUARD_REQUIRE_APPROVAL_FOR_FILE_WRITE="true"
CYBERSECURITYGUARD_REQUIRE_APPROVAL_FOR_EXTERNAL_POST="true"
CYBERSECURITYGUARD_BLOCK_TERMINAL_DANGEROUS_COMMANDS="true"
```

Backward-compatible aliases are supported for `CYBERGUARD_*`.

## Install

```bash
npm install @soter/core
```

## Start A Session

```ts
import { createAgentFirewallClient } from "@soter/core";

const firewall = createAgentFirewallClient({
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL,
});

const session = await firewall.startAgentSession({
  agentName: "openclaw",
  agentType: "computer_use",
});
```

## Wrap Every Tool Call

```ts
async function beforeOpenClawToolCall(toolName: string, actionName: string, input: unknown) {
  const content = JSON.stringify(input);
  const decision = await firewall.checkAgentAction({
    sessionId: session.sessionId,
    agentName: "openclaw",
    tool: toolName,
    action: actionName,
    target: String((input as { target?: unknown }).target ?? ""),
    content,
    destination: "unknown",
    riskContext: {
      externalDestination: toolName.startsWith("gmail.") || toolName === "browser.submit_form",
      canSendMessage: toolName === "gmail.send",
      canRunCode: toolName === "terminal.run",
      canAccessFiles: toolName.startsWith("filesystem."),
      canModifyData: /write|send|submit|delete|create|update/i.test(actionName),
    },
  });

  if (decision.decision === "BLOCK") {
    return { paused: true, blocked: true, message: decision.reason };
  }

  if (decision.decision === "ASK_APPROVAL") {
    return {
      paused: true,
      approvalRequired: true,
      message: decision.requiredApproval?.message,
      approvalToken: decision.requiredApproval?.approvalToken,
    };
  }

  return {
    paused: false,
    content: decision.safeContent ?? content,
    decision,
  };
}
```

Execute the OpenClaw tool only after this function returns an execution-safe decision. For `REDACT`, pass `decision.safeContent` or a parsed version of it to the tool.

## Permission Manifest

Create one manifest per protected OpenClaw agent. The manifest is merged with the project Agent Firewall policy, and the most restrictive rule wins.

```ts
await fetch(`${process.env.CYBERSECURITYGUARD_BASE_URL}/api/agent/manifest`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    agentName: "openclaw",
    enabled: true,
    manifest: {
      agent: "openclaw",
      allowedTools: ["browser.read", "calendar.read"],
      approvalRequired: ["gmail.send", "browser.submit_form", "filesystem.write"],
      blocked: ["terminal.run", "filesystem.delete", "filesystem.read.env"],
      allowedDomains: ["gmail.com", "calendar.google.com"],
      blockedDomains: [],
      allowedWorkspaceDirs: ["./agent-workspace"],
      blockedFilePatterns: [".env", "*.pem", "id_rsa"],
      dataPolicy: {
        externalSecrets: "BLOCK",
        externalPII: "ASK_APPROVAL",
        failClosed: true,
      },
    },
  }),
});
```

Manifest rules are enforced during `checkAgentAction`. A blocked tool blocks even if the action looks safe, approval-required tools pause execution, and blocked file patterns such as `.env` and private keys are denied before tool execution.

## Data Leak Check

Before sending data to an external website, API, form, or email address:

```ts
const outbound = await firewall.checkDataLeak({
  sessionId: session.sessionId,
  content: payload,
  destination: "external",
  target: "https://api.example.com",
});

if (outbound.decision === "BLOCK") throw new Error(outbound.reason);
if (outbound.decision === "ASK_APPROVAL") return outbound.requiredApproval;
```

## Approval Resolve

High-risk actions return an approval object. Keep the agent paused until a human approves or denies the request.

```ts
const resolved = await firewall.resolveAgentApproval({
  approvalToken,
  decision: "APPROVED",
  editedContent: userEditedSafeContent,
});

if (resolved.decision !== "ALLOW") return;
```

Only execute the exact action that was reviewed. If `editedContent` is provided, execute the edited safe content, not the original content.

Dashboard reviewers can use `/dashboard/agent-firewall` to compare the original redacted content with the safe version, edit the safe content, approve, or deny. Raw approval tokens are not stored; API-based approval resolution uses the one-time token returned by the approval request.

## Test

- Safe browser read: `browser.read` should return `READ_ONLY` or `ALLOW`.
- Email containing an API key should return `BLOCK`.
- Email without secrets should return `ASK_APPROVAL`.
- `terminal.run` with `rm -rf` or `curl ... | bash` should return `BLOCK`.
- `.env` reads should return `BLOCK`.
- A manifest-blocked tool should return `BLOCK`.
- A manifest approval-required tool should return `ASK_APPROVAL`.
- Reusing an approval token should fail after the first resolution.
