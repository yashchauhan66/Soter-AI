import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

export const metadata: Metadata = {
  title: "SoterAI WordPress Plugin Guide - AI Security for CMS Chatbots",
  description:
    "Complete WordPress integration guide for SoterAI. Install the plugin, configure settings, use shortcodes, and protect your WordPress chatbot with PHP and REST API input/output guarding.",
  alternates: { canonical: "/docs/wordpress" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.publicvm.com" },
    { "@type": "ListItem", position: 2, name: "Docs", item: "https://soterai.publicvm.com/docs" },
    { "@type": "ListItem", position: 3, name: "WordPress", item: "https://soterai.publicvm.com/docs/wordpress" },
  ],
};

const phpCode = `$in = soter_guard_input( $user_message );
if ( $in['blocked'] ) {
    $reply = $in['safe_text'];
} else {
    $ai   = my_chatbot_generate( $in['safe_text'] );
    $out  = soter_guard_output( $ai );
    $reply = $out['safe_text'] ?? $ai;
}`;
const shortcodeCode = `[soter_chatbot_guard]    // local proxy + optional badge
[soter_security_badge]   // badge only`;
const jsCode = `const res = await fetch("/wp-json/soter/v1/guard-input", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-WP-Nonce": soterNonce,
  },
  body: JSON.stringify({ text: userMessage }),
});
const { blocked, safe_text, decision } = await res.json();`;

export default function WordpressDocsPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="container-docs">
        <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-cyan">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">WordPress Plugin Guide</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your WordPress chatbot by guarding input and output server-side through the SoterAI REST API.
        </p>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 1: Install the plugin</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7 text-slate-400">
            <li>Copy the plugin folder into <InlineCode>wp-content/plugins/</InlineCode>, or upload via <strong>Plugins → Add New → Upload Plugin</strong>.</li>
            <li>Activate <strong>SoterAI Guard</strong> from the Plugins page.</li>
          </ol>
          <p className="mt-4 text-sm text-slate-400">Package a zip from the repo root:</p>
          <CodeBlock language="bash" title="terminal">{`npm run package:wordpress   # produces dist/soter-guard.zip`}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 2: Configure settings</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Navigate to <strong>Settings → SoterAI Guard</strong> to configure:
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Setting</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Notes</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {[
                  ["API Base URL", "Your SoterAI host URL or self-hosted URL"],
                  ["API Key", "ck_live_… Stored server-side, shown only masked"],
                  ["Project ID", "Optional; forwarded as metadata"],
                  ["Enable Input Guard", "Guard incoming visitor messages"],
                  ["Enable Output Guard", "Guard chatbot responses"],
                  ["Enable Security Badge", 'Show "Protected by SoterAI" badge'],
                  ["Block message", "Shown when a request is blocked"],
                  ["Public rate limit", "Per-IP per-minute cap on REST proxy routes"],
                ].map(([setting, notes]) => (
                  <tr key={setting} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-medium text-slate-300">{setting}</td>
                    <td className="px-4 py-2.5">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 3: Use shortcodes</h2>
          <CodeBlock language="html" title="wordpress editor">{shortcodeCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 4: PHP integration (server-side)</h2>
          <CodeBlock language="php" title="functions.php" showLineNumbers>{phpCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Step 5: Frontend via local proxy</h2>
          <p className="mt-3 leading-7 text-slate-400">
            The frontend JavaScript calls the <strong>local</strong> WordPress REST route, never the SoterAI API directly:
          </p>
          <CodeBlock language="javascript" title="frontend.js" showLineNumbers>{jsCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <h2 className="text-2xl font-bold">Troubleshooting</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Auth error on test", "Re-enter the API key (the masked value is a placeholder)"],
              ["Base URL rejected", "Must start with https://"],
              ["429 from proxy", "Lower traffic or raise the per-IP rate limit"],
              ["Guard unreachable", "Input guarding fails open (passes through) so the site keeps working"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <p className="font-semibold text-sm">{title}</p>
                <p className="mt-1 text-sm text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <h2 className="text-xl font-bold">What&apos;s next?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/generic-chatbot" className="button-primary gap-2">
                Generic Chatbot Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/zendesk" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Zendesk</Link>
          <Link href="/docs/generic-chatbot" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Generic Chatbot →</Link>
        </div>
      </div>
    </main>
  );
}
