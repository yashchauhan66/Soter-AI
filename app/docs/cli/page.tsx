import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export default function CliDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Tool guide</p>
        <h1 className="mt-3 text-4xl font-bold">Soter CLI</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          <InlineCode>npx soter init</InlineCode> — a convenience tool for framework detection and project scaffolding.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Status: Planned</h2>
          <p className="mt-3 text-slate-400">
            The CLI init command is planned but not yet implemented. The SDK, examples, and documentation
            provide clear integration paths — manual setup takes less than 2 minutes for most developers.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Planned Behavior</h2>
          <p className="mt-3 text-slate-400">When implemented, <InlineCode>npx soter init</InlineCode> would:</p>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">1.</span> <strong>Detect framework</strong> — Next.js, Express, Node.js, Python/FastAPI, or unknown
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">2.</span> <strong>Prompt for config</strong> — Base URL and API key (stored in <InlineCode>.env</InlineCode>, never committed)
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">3.</span> <strong>Generate files</strong> — <InlineCode>.env.example</InlineCode> with <InlineCode>SOTER_BASE_URL</InlineCode> and <InlineCode>SOTER_API_KEY</InlineCode>, plus a sample integration file
            </div>
            <div className="rounded-lg border border-slate-800 p-4">
              <span className="font-semibold text-white">4.</span> <strong>Print next steps</strong> — Copy <InlineCode>.env.example</InlineCode> to <InlineCode>.env</InlineCode>, fill in API key, run the app
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Planned Package Structure</h2>
          <CodeBlock language="text">{`packages/cli/
├── package.json        # bin: { "soter": "./dist/cli.js" }
├── src/
│   ├── cli.ts          # Main CLI entry point
│   ├── detect.ts       # Framework detection
│   ├── scaffold.ts     # File generation
│   └── prompts.ts      # User prompts
└── tsconfig.json`}</CodeBlock>
          <p className="mt-3 text-sm text-slate-400">Dependencies: <InlineCode>commander</InlineCode>, <InlineCode>inquirer</InlineCode>, <InlineCode>chalk</InlineCode></p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Alternative: Dashboard Wizard</h2>
          <p className="mt-3 text-slate-400">
            While the CLI is not yet available, the <Link href="/dashboard/integrations" className="text-cyan underline">integration wizard</Link> in the dashboard
            already provides copy-paste snippets for all supported languages and frameworks.
          </p>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/generic-chatbot" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Generic Chatbot</Link>
          <Link href="/docs/best-practices" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Security Best Practices →</Link>
        </div>
      </div>
    </main>
  );
}
