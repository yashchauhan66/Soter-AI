import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CodeBlock, InlineCode, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Generic Chatbot & Agent Security Guide - Tool Firewall Integration",
  description:
    "Complete guide to protecting any chatbot, RAG bot, browser agent, or AI agent with SoterAI. Includes basic chatbot pattern, agent tool firewall, key rules, and code examples.",
  alternates: { canonical: "/docs/generic-chatbot" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Generic Chatbot & Agent", item: "https://soterai.publicvm.com/docs/generic-chatbot" },
  ],
};

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
  // 🛑 Blocked before LLM
  return { reply: "Message blocked.", blocked: true };
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
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Pattern guide</p>
        <h1 className="mt-3 text-4xl font-bold">Generic Chatbot & Agent Security</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Use this pattern for any chatbot, RAG bot, browser agent, desktop agent, or custom tool-using AI system.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install the SDK</h2>
          <CodeBlock language="bash" title="terminal">{`npm install @soter/core`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Basic chatbot pattern</h2>
          <CodeBlock language="typescript" title="chatbot.js" showLineNumbers>{basicCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Agent with tool firewall</h2>
          <p className="mt-3 leading-7 text-slate-400">
            For agents that call tools, APIs, or access data:
          </p>
          <CodeBlock language="typescript" title="agent-firewall.js" showLineNumbers>{agentCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Key rules</h2>
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
                    <p className="mt-1 text-sm leading-6 text-slate-400">{copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm italic text-slate-500">This reduces risk; it does not guarantee complete protection.</p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What's next?</h2>
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
      </div>
    </main>
  );
}
