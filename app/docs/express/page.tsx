import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

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
    return res.status(403).json({
      blocked: true,
      reason: protection.reason,
      riskLevel: protection.riskLevel,
    });
  }

  // Continue to the LLM only after Soter allows the input.
});`;
const middlewareCode = `import { soterInputMiddleware, soterOutputMiddleware } from "@soter/core/express";

app.post(
  "/chat",
  soterInputMiddleware({ apiKey: process.env.SOTER_API_KEY! }),
  async (req, res) => {
    // req.body.message is now safe/redacted; blocked requests already responded.
    const reply = await callLLM(req.body.message);
    res.json({ reply });
  },
);`;

export default function ExpressDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Framework guide</p>
        <h1 className="mt-3 text-4xl font-bold">Express.js Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your Express.js chatbot with Soter middleware or direct API calls.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install</h2>
          <CodeBlock language="bash">{installCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Basic Usage</h2>
          <CodeBlock language="typescript">{basicCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Express Middleware</h2>
          <p className="mt-3 text-slate-400">Use the built-in middleware from <InlineCode>@soter/core/express</InlineCode>:</p>
          <CodeBlock language="typescript">{middlewareCode}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">
            <InlineCode>req.soter.inputResult</InlineCode> holds the full guard result. The legacy <InlineCode>req.cyberrakshak.inputResult</InlineCode> is also populated.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Example Project</h2>
          <p className="mt-3 text-slate-400">
            See <InlineCode>examples/express-chatbot</InlineCode> for a complete working example.
          </p>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/nextjs" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Next.js Guide</Link>
          <Link href="/docs/fastapi" className="text-sm text-cyan hover:text-cyan/80 transition-colors">FastAPI Guide →</Link>
        </div>
      </div>
    </main>
  );
}
