import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "CLI Tools: Manual SDK Setup and Local Commands",
  description: "Distinguish the planned npx soter init scaffolder from the implemented local soterai CLI. Set up SDK integrations manually and verify the application boundary.",
  alternates: { canonical: "/docs/cli" },
};

const installCode = `# JavaScript / TypeScript server
npm install @soterai/core
# Python server: choose the package for your application's language.
pip install soter`;
const localCliCode = `# For an already installed @soterai/cli package:
soterai help`;
const envCode = `# Inject into the server process; never put these in browser code.
SOTER_API_KEY=replace_with_your_project_key
SOTER_BASE_URL=https://api.soterai.in`;

export default function CliDocsPage() {
  return (
    <DocsPageShell path="/docs/cli">
      <section className="docs-section">
        <DocsHeading id="status-planned">Scaffolder status: planned</DocsHeading>
        <p className="mt-3 leading-7">The framework scaffolder proposed as <InlineCode>npx soter init</InlineCode> is not implemented in this repository. It is not the command to use for SDK setup. Follow the manual steps below rather than assuming an unscoped registry package is the SoterAI installer.</p>
        <p className="mt-3 leading-7">A separate implemented package, <InlineCode>@soterai/cli</InlineCode>, exposes the <InlineCode>soterai</InlineCode> binary for local broker, scan, hook and vault workflows. That CLI does not generate Next.js, Express or Python integration files. Its package publication and your installed broker are separate from the source contracts documented here.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Manual setup available now</DocsHeading>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7">
          <li>Choose the SDK for your server language. Keep your existing application and dependency workflow.</li>
          <li>Set the project API key in server-side configuration. The SDK clients read environment variables, not environment files; your framework or deployment must load them.</li>
          <li>Implement the model callback, validate requests and add input/output checks before releasing responses.</li>
          <li>Test allowed, redacted, denied and unavailable paths with synthetic data before connecting production traffic.</li>
        </ol>
        <CodeBlock language="bash" title="terminal · choose your language">{installCode}</CodeBlock>
        <CodeBlock language="bash" title="server environment">{envCode}</CodeBlock>
        <p className="mt-3 leading-7">Use <Link href="/docs/nextjs" className="text-cyan underline">Next.js</Link>, <Link href="/docs/express" className="text-cyan underline">Express</Link> or <Link href="/docs/fastapi" className="text-cyan underline">FastAPI</Link> for the request/response wiring. The SDK does not provide end-user authentication, your model provider or a production deployment.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Planned behavior</DocsHeading>
        <p className="mt-3 leading-7">The original scaffolder proposal described these steps. They are design notes, not shipped command behavior or a delivery commitment:</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7">
          <li>Detect Next.js, Express, generic Node.js or Python/FastAPI, with an unknown-framework fallback.</li>
          <li>Ask for a base URL and API key for local server configuration.</li>
          <li>Generate <InlineCode>.env.example</InlineCode> and a framework-specific sample integration file.</li>
          <li>Print instructions for configuring the key and starting the application.</li>
        </ol>
        <p className="mt-3 leading-7">No current scaffolder performs those writes. If you create the files manually, put placeholders in <InlineCode>.env.example</InlineCode>, keep real secrets out of version control and review any generated integration code before use.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Implemented local CLI</DocsHeading>
        <p className="mt-3 leading-7">For an existing installation of <InlineCode>@soterai/cli</InlineCode>, inspect its own help first. The binary is <InlineCode>soterai</InlineCode>, not <InlineCode>soter</InlineCode>.</p>
        <CodeBlock language="bash" title="terminal · installed local CLI">{localCliCode}</CodeBlock>
        <p className="mt-3 leading-7">The dispatcher includes <InlineCode>scan</InlineCode>, <InlineCode>redact</InlineCode>, <InlineCode>broker</InlineCode>, <InlineCode>safe-mode</InlineCode>, <InlineCode>memory export</InlineCode>, <InlineCode>mcp scan</InlineCode>, <InlineCode>git scan</InlineCode>, <InlineCode>hook</InlineCode>, <InlineCode>vault</InlineCode>, <InlineCode>run</InlineCode> and <InlineCode>version</InlineCode>. A top-level <InlineCode>init</InlineCode> is an unknown command; <InlineCode>vault init</InlineCode> initializes the CLI vault, not a framework project.</p>
        <p className="mt-3 leading-7">Broker-backed commands require the local broker and its authentication. Hook installation and vault commands have their own side effects and permissions. They are not a replacement for server-side SDK integration, and a CLI command being implemented does not establish protection for every agent path.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>Alternative: Dashboard wizard</DocsHeading>
        <p className="mt-3 leading-7">The <Link href="/dashboard/integrations" className="text-cyan underline">integration wizard</Link> provides platform snippets and setup guidance. Use the corresponding SDK/framework guide to check current imports, response handling and prerequisites; a copied snippet does not finish authentication, output enforcement or deployment verification.</p>
      </section>
      <section className="docs-section">
        <DocsHeading>What&apos;s next?</DocsHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/docs/quickstart" className="button-primary gap-2">Quickstart Guide <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs/js" className="button-secondary gap-2">JavaScript SDK <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
        <Link href="/docs/generic-chatbot" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Generic Chatbot</Link>
        <Link href="/docs/best-practices" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Security Best Practices →</Link>
      </div>
    </DocsPageShell>
  );
}

