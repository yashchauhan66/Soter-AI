import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const basicCode = `import { Soter } from "@soter/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

// Guard input → call LLM → guard output
const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  return { reply: result.safeText ?? "Message blocked.", blocked: true };
}

const llmReply = await callLLM(result.safeText ?? userMessage);
const outputResult = await soter.guardOutput({ text: llmReply });

return {
  reply: outputResult.safeText ?? outputResult.redactedText ?? llmReply,
  blocked: !outputResult.allowed,
};`;
const agentCode = `import { createAgentFirewallClient } from "@soter/core";

const firewall = createAgentFirewallClient({
  apiKey: process.env.SOTER_API_KEY,
  baseUrl: process.env.SOTER_BASE_URL,
});

// Start an agent session
const session = await firewall.startAgentSession({
  agentName: "support-bot",
  agentType: "chatbot",
});

// Check every tool call before execution
const action = await firewall.checkAgentAction({
  sessionId: session.sessionId,
  tool: "api.call",
  action: "post_ticket",
  content: ticketPayload,
  destination: "external",
  riskContext: { externalDestination: true, canModifyData: true },
});

if (action.decision === "BLOCK") return action.reason;
if (action.decision === "ASK_APPROVAL") {
  return action.requiredApproval?.message;
}

// Only execute after firewall allows it
const toolResult = await callTool(action.safeContent ?? ticketPayload);

// Guard the final output
const final = await soter.protect({ input: toolResult });
return final.safeText ?? final.reason;`;

export default function GenericChatbotDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Pattern guide</p>
        <h1 className="mt-3 text-4xl font-bold">Generic Chatbot & Agent</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use this pattern for any chatbot, RAG bot, browser agent, desktop agent, or custom tool-using AI system.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Installation</h2>
          <CodeBlock language="bash">{`npm install @soter/core`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Basic Chatbot Pattern</h2>
          <CodeBlock language="typescript">{basicCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Agent with Tool Firewall</h2>
          <p className="mt-3 text-slate-400">For agents that call tools, APIs, or access data:</p>
          <CodeBlock language="typescript">{agentCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Quick Decision Flow</h2>
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <code className="block text-xs leading-6 text-slate-500">
              User Input → Soter Guard → Safe Text → LLM/Agent → Output → Soter Output Guard → Safe Response
              {"\n"}               ↓                               ↓
              {"\n"}          Blocked (no LLM)              Blocked/Redacted
            </code>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Key Rules</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li>Never execute a tool before the firewall approves it.</li>
            <li>Always guard both input and output.</li>
            <li>Set <InlineCode>retries: 2</InlineCode> for transient error tolerance.</li>
            <li>API key stays server-side only.</li>
            <li>This reduces risk; it does not guarantee complete protection.</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/wordpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← WordPress</Link>
          <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">CLI →</Link>
        </div>
      </div>
    </main>
  );
}
