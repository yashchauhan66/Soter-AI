import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "SoterAI Generic Chatbot & Agent Security Guide - Tool Firewall Integration",
  description:
    "Complete guide to protecting any chatbot, RAG bot, browser agent, or AI agent with SoterAI. Includes basic chatbot pattern, agent tool firewall, key rules, and code examples.",
  alternates: { canonical: "/docs/generic-chatbot" },
};

const basicCode = `import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

// Guard input → call LLM → guard output
const result = await soter.protect({
  input: userMessage,
  context: { userId: "user_123", sessionId: "session_123" },
});

if (!result.allowed) {
  // 🛑 Blocked before LLM
  return { reply: "Message blocked.", blocked: true };
}

const llmReply = await callLLM(result.safeText ?? userMessage);
const outputResult = await soter.guardOutput({ text: llmReply });

return {
  reply: outputResult.safeText ?? outputResult.redactedText ?? llmReply,
  blocked: !outputResult.allowed,
};`;

const agentCode = `import { Soter, createAgentFirewallClient } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

const firewall = createAgentFirewallClient({
  apiKey: process.env.SOTER_API_KEY,
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

// Guard the final output before returning it
const final = await soter.guardOutput({ text: toolResult });
return final.safeText ?? final.redactedText ?? toolResult;`;

export default function GenericChatbotDocsPage() {
  return (
    <DocsPageShell path="/docs/generic-chatbot">

        <section className="docs-section">
          <DocsHeading>Step 1: Install the SDK</DocsHeading>
          <CodeBlock language="bash" title="terminal">{`npm install @soterai/core`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 2: Basic chatbot pattern</DocsHeading>
          <CodeBlock language="typescript" title="chatbot.js" showLineNumbers>{basicCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 3: Agent with tool firewall</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            For agents that call tools, APIs, or access data:
          </p>
          <CodeBlock language="typescript" title="agent-firewall.js" showLineNumbers>{agentCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Key rules</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Approve tools first", "Never execute a tool before the firewall approves it."],
              ["Guard both ways", "Always guard both input and output, not just one."],
              ["Use retries", "Set retries: 2 for transient error tolerance."],
              ["Keep API key server-side", "Never expose the API key in browser or mobile code."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={16} aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm italic text-slate-300">This reduces risk; it does not guarantee complete protection.</p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/cli" className="button-primary gap-2">
                CLI Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/best-practices" className="button-secondary gap-2">
                Security Best Practices <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/wordpress" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← WordPress</Link>
          <Link href="/docs/cli" className="text-sm text-cyan hover:text-cyan/80 transition-colors">CLI →</Link>
        </div>
    </DocsPageShell>
  );
}
