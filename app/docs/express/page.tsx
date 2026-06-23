import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode, TipBox, WarnBox } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI Express.js Integration Guide - AI Security Middleware",
  description:
    "Complete Express.js integration guide for SoterAI. Learn to protect your Express chatbot with input/output guard middleware, session context, and error handling.",
  alternates: { canonical: "/docs/express" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "Express.js", item: "https://soterai.publicvm.com/docs/express" },
  ],
};

const installCode = `npm install @soter/core express`;
const basicCode = `import express from "express";
import { Soter } from "@soter/core";

const app = express();
app.use(express.json());

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
  projectId: process.env.SOTER_PROJECT_ID,
  baseUrl: process.env.SOTER_BASE_URL,
});

app.post("/chat", async (req, res) => {
  const protection = await soter.protect({
    input: req.body.message,
    context: {
      userId: req.user?.id,
      sessionId: req.session?.id,
    },
  });

  if (!protection.allowed) {
    // 🛑 Blocked before LLM
    return res.status(403).json({
      blocked: true,
      reason: protection.reason,
    });
  }

  // ✅ Continue to LLM with safe text
  const safeInput = protection.safeText ?? req.body.message;
  const llmReply = await callLLM(safeInput);
  
  // Guard model output
  const output = await soter.guardOutput({ text: llmReply });
  
  res.json({
    reply: output.safeText ?? output.redactedText ?? llmReply,
    blocked: !output.allowed,
  });
});`;
const middlewareCode = `import { soterInputMiddleware, soterOutputMiddleware } from "@soter/core/express";

app.post(
  "/chat",
  soterInputMiddleware({ apiKey: process.env.SOTER_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted automatically
    // Blocked requests already got a 403 response
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);`;

export default function ExpressDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">Express.js Integration Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your Express.js chatbot with Soter middleware or direct API calls.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install</h2>
          <CodeBlock language="bash" title="terminal">{installCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Basic usage</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Guard user input, call your LLM with safe text, then guard the model output:
          </p>
          <CodeBlock language="typescript" title="server.js" showLineNumbers>{basicCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Use middleware (recommended)</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Use built-in middleware from <InlineCode>@soter/core/express</InlineCode> for cleaner code:
          </p>
          <CodeBlock language="typescript" title="middleware">{middlewareCode}</CodeBlock>
          <TipBox>
            <InlineCode>req.soter.inputResult</InlineCode> holds the full guard result for inspection.
          </TipBox>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Example project</h2>
          <p className="mt-3 leading-7 text-slate-400">
            See <InlineCode>examples/express-chatbot</InlineCode> for a complete working example.
          </p>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What's next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/js" className="button-primary gap-2">
                JavaScript SDK <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/fastapi" className="button-secondary gap-2">
                FastAPI Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/nextjs" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Next.js Guide</Link>
          <Link href="/docs/fastapi" className="text-sm text-cyan hover:text-cyan/80 transition-colors">FastAPI Guide →</Link>
        </div>
      </div>
    </main>
  );
}
