import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "Chatbot & Agent Security: Tool Firewall Guide",
  description: "Server-side chatbot and agent patterns with input/output checks, explicit tool decisions, approval boundaries and withheld responses on guard failures.",
  alternates: { canonical: "/docs/generic-chatbot" },
};

const envCode = `# Set in the server environment, not the browser or mobile application.
SOTER_API_KEY=replace_with_your_project_key
# Optional; the SDK uses this origin by default.
SOTER_BASE_URL=https://api.soterai.in`;
const basicCode = `import { Soter, type SoterContext } from "@soterai/core";
import { callLLM } from "./llm"; // Your adapter: (text) => Promise<string>

// Application transport policy: validate raw JSON BEFORE SDK normalization.
const strictGuardFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) {
    const raw = await response.clone().json();
    const permits = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        typeof raw.allowed !== "boolean" ||
        ![...permits, "BLOCK", "HUMAN_REVIEW"].includes(raw.action) ||
        raw.allowed !== permits.includes(raw.action)) {
      throw new Error("Invalid guard verdict");
    }
    const decision = ["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)
      ? "REDACT" : raw.action;
    if (raw.decision !== undefined && raw.decision !== decision) {
      throw new Error("Inconsistent guard decision");
    }
    if (["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)) {
      const replacement = raw.safeText ?? raw.redactedText;
      if (typeof replacement !== "string" || !replacement.trim()) {
        throw new Error("Missing usable guard replacement");
      }
    }
  }
  return response; // Preserve status/body for the SDK's normal error handling.
};

const soter = new Soter({ timeoutMs: 8000, retries: 0, fetch: strictGuardFetch });

// Call from your authenticated transport; context comes from server state.
export async function chat(userMessage: string, context: SoterContext = {}) {
  if (typeof userMessage !== "string" || !userMessage.trim() || userMessage.length > 8000) {
    return { blocked: true, reply: "Invalid message." };
  }
  try {
    const input = await soter.protect({ input: userMessage, context });
    if (!soter.shouldCallLLM(input)) {
      return { blocked: true, reply: "Message withheld." };
    }
    const safeInput = input.safeText ?? input.redactedText ??
      (input.action === "ALLOW" ? userMessage : undefined);
    if (typeof safeInput !== "string" || !safeInput.trim()) {
      return { blocked: true, reply: "Message withheld." };
    }
    const llmReply = await callLLM(safeInput);
    const output = await soter.guardOutput({
      text: llmReply, userId: context.userId, sessionId: context.sessionId,
    });
    if (!soter.shouldCallLLM(output)) {
      return { blocked: true, reply: "Response withheld." };
    }
    const reply = output.safeText ?? output.redactedText ??
      (output.action === "ALLOW" ? llmReply : undefined);
    return typeof reply === "string" && reply.trim()
      ? { blocked: false, reply }
      : { blocked: true, reply: "Response withheld." };
  } catch {
    return { blocked: true, reply: "Chat temporarily unavailable." };
  }
}`;
const agentCode = `import { Soter, createAgentFirewallClient } from "@soterai/core";
import { callTool } from "./tools"; // Your fixed-destination ticket adapter

const apiKey = process.env.SOTER_API_KEY;
if (!apiKey) throw new Error("Set SOTER_API_KEY on the server");
const options = { apiKey, baseUrl: process.env.SOTER_BASE_URL, timeoutMs: 8000, retries: 0 };
// Application transport policy: validate raw JSON BEFORE SDK normalization.
const strictGuardFetch: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) {
    const raw = await response.clone().json();
    const permits = ["ALLOW", "ALLOW_WITH_REDACTION", "REWRITE"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        typeof raw.allowed !== "boolean" ||
        ![...permits, "BLOCK", "HUMAN_REVIEW"].includes(raw.action) ||
        raw.allowed !== permits.includes(raw.action)) {
      throw new Error("Invalid guard verdict");
    }
    const decision = ["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)
      ? "REDACT" : raw.action;
    if (raw.decision !== undefined && raw.decision !== decision) {
      throw new Error("Inconsistent guard decision");
    }
    if (["ALLOW_WITH_REDACTION", "REWRITE"].includes(raw.action)) {
      const replacement = raw.safeText ?? raw.redactedText;
      if (typeof replacement !== "string" || !replacement.trim()) {
        throw new Error("Missing usable guard replacement");
      }
    }
  }
  return response; // Preserve status/body for the SDK's normal error handling.
};

const soter = new Soter({ ...options, fetch: strictGuardFetch });
const firewall = createAgentFirewallClient(options);

// One isolated agent action. Reuse a server-bound session for a longer run.
export async function runAgentAction(ticketPayload: string) {
  if (typeof ticketPayload !== "string" || !ticketPayload.trim() || ticketPayload.length > 20000) {
    return { blocked: true, reply: "Invalid ticket content." };
  }
  try {
    const session = await firewall.startAgentSession({
      agentName: "support-bot", agentType: "chatbot",
    });
    const action = await firewall.checkAgentAction({
      sessionId: session.sessionId,
      agentName: "support-bot",
      tool: "api.call",
      action: "post_ticket",
      target: "https://tickets.example.test/api/tickets", // Replace with your allowlisted target.
      content: ticketPayload, // The API accepts a string, not an arbitrary object.
      destination: "external",
      riskContext: { externalDestination: true, canModifyData: true, canSendMessage: true },
    });

    // A write cannot satisfy READ_ONLY. This example has no sandbox or approval UI.
    if (action.decision !== "ALLOW" && action.decision !== "REDACT") {
      return { blocked: true, reply: "Action withheld or awaiting review." };
    }
    const content = action.decision === "REDACT" ? action.safeContent :
      action.safeContent ?? ticketPayload;
    if (typeof content !== "string" || !content.trim()) {
      return { blocked: true, reply: "Action withheld." };
    }
    // Execute this exact checked action/target with this content only.
    const toolResult = await callTool(content);
    const output = await soter.guardOutput({ text: toolResult, sessionId: session.sessionId });
    if (!soter.shouldCallLLM(output)) {
      return { blocked: true, reply: "Tool response withheld." };
    }
    const reply = output.safeText ?? output.redactedText ??
      (output.action === "ALLOW" ? toolResult : undefined);
    return typeof reply === "string" && reply.trim()
      ? { blocked: false, reply }
      : { blocked: true, reply: "Tool response withheld." };
  } catch {
    // A tool timeout can leave an uncertain side effect. Do not auto-retry the write.
    return { blocked: true, reply: "Action could not be completed safely." };
  }
}`;

export default function GenericChatbotDocsPage() {
  return (
    <DocsPageShell path="/docs/generic-chatbot">
      <section className="docs-section">
        <DocsHeading>Step 1: Install the SDK</DocsHeading>
        <p className="mt-3 leading-7">Use this pattern when your stack has no framework-specific guide. The SDK declares Node.js 18.18 or newer. You supply the transport, authenticated session, model adapter and tool executor.</p>
        <CodeBlock language="bash" title="terminal">{`npm install @soterai/core`}</CodeBlock>
        <CodeBlock language="bash" title="server environment">{envCode}</CodeBlock>
        <p className="mt-3 leading-7"><InlineCode>Soter</InlineCode> reads the process environment; it does not load environment files. <InlineCode>createAgentFirewallClient</InlineCode> requires explicit client options. Missing configuration must stop startup rather than enable an unguarded fallback.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 2: Basic chatbot pattern</DocsHeading>
        <p className="mt-3 leading-7">Gate the model call on the input verdict, then gate the public reply on the output verdict. Both examples use an application-owned <InlineCode>strictGuardFetch</InlineCode> for text guards before SDK normalization: only a raw boolean true with <InlineCode>ALLOW</InlineCode>, <InlineCode>ALLOW_WITH_REDACTION</InlineCode> or <InlineCode>REWRITE</InlineCode> permits continuation, and transformed results require nonblank replacement text. <InlineCode>BLOCK</InlineCode>, <InlineCode>HUMAN_REVIEW</InlineCode>, malformed grants and inconsistent decisions stop. The agent firewall keeps its separate decision contract.</p>
        <CodeBlock language="typescript" title="chatbot.ts" showLineNumbers>{basicCode}</CodeBlock>
        <p className="mt-3 leading-7">Pass <InlineCode>context.userId</InlineCode> and a stable <InlineCode>context.sessionId</InlineCode> from trusted application state. These fields correlate activity; they do not authenticate an end user. The example&apos;s 8,000-character cap matches the guard server default and can be made stricter by your application.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Step 3: Agent with tool firewall</DocsHeading>
        <p className="mt-3 leading-7">Text guarding does not authorize tools. Check the proposed action immediately before executing it, using the real destination, target and side-effect flags. The authenticated endpoints are <InlineCode>/api/agent/session/start</InlineCode> and <InlineCode>/api/agent/action/check</InlineCode>.</p>
        <CodeBlock language="typescript" title="agent-firewall.ts" showLineNumbers>{agentCode}</CodeBlock>
        <p className="mt-3 leading-7">Replace the reserved example target and implement <InlineCode>callTool</InlineCode> so it uses only that checked destination and content. An output denial hides the tool result; it cannot undo a ticket already created. Never let a model switch the target or arguments after approval.</p>
        <DocsHeading level={3}>Handle each tool decision</DocsHeading>
        <dl className="mt-4 space-y-4 leading-7">
          <div><dt className="font-semibold">ALLOW / REDACT</dt><dd>Execute only the checked action. For REDACT, require and use <InlineCode>safeContent</InlineCode>; do not fall back to the original payload when it is absent.</dd></div>
          <div><dt className="font-semibold">BLOCK / ASK_APPROVAL</dt><dd>Stop. An approval prompt is not approval. Keep the approval token and reviewed action in a trusted server workflow; an authorized reviewer must resolve the request before the exact reviewed action can run.</dd></div>
          <div><dt className="font-semibold">READ_ONLY / SANDBOX_ONLY</dt><dd>Use an executor that actually enforces the restriction, or stop. The sample stops because its ticket-writing executor is neither read-only nor sandboxed.</dd></div>
          <div><dt className="font-semibold">Unknown result / request failure</dt><dd>Withhold the action and return an application-owned error. An unavailable decision is not an allow.</dd></div>
        </dl>
        <p className="mt-3 leading-7"><InlineCode>resolveAgentApproval</InlineCode> checks a project-scoped token, pending status and expiry on the server. It records a resolution, not tool execution. Your application must authorize the reviewer, bind the approved content to the reviewed action and prevent duplicate execution. Do not set <InlineCode>userApproved: true</InlineCode> merely because the agent asked.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Key rules</DocsHeading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-7">
          <li>Check tools before side effects and guard both chat directions. RAG source access and retrieval inspection need the separate RAG integration.</li>
          <li>Use explicit timeouts and bounded retries. JavaScript defaults to zero retries; <InlineCode>retries: 2</InlineCode> is an optional policy choice for transient failures, not a requirement. Avoid automatically replaying state-changing actions.</li>
          <li>Keep the key server-side. Require user authentication, enforce per-user limits and encode output for its display context.</li>
          <li>Log decision metadata rather than raw prompts, completions, tool arguments or full guard objects. A field called <InlineCode>safeText</InlineCode> is not a privacy certification.</li>
          <li>These checks reduce risk within the paths you integrate. They do not secure arbitrary agent execution, guarantee detection or certify compliance.</li>
        </ul>
        <DocsHeading level={3}>Verify continuation, not only detection</DocsHeading>
        <p className="mt-3 leading-7">Count model and tool calls while testing every decision. A blocked input must make zero model calls; an approval or sandbox-only decision must make zero unrestricted tool calls. Inject output denials, missing replacement text, network failures and model errors. Assert that no withheld text appears in the public response.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/cli" className="button-primary gap-2">CLI Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/best-practices" className="button-secondary gap-2">Security Best Practices <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/wordpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← WordPress</Link>
        <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">CLI →</Link>
      </div>
    </DocsPageShell>
  );
}

